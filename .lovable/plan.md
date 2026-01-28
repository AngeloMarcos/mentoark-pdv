

# Plano: Sistema de Fidelidade e Pontos

## Resumo Executivo

Implementar um programa de fidelidade completo com acumulo automatico de pontos por compra, resgate de pontos como desconto, configuracao de regras por tenant, e visualizacao do saldo de pontos na ficha do cliente.

---

## Analise do Estado Atual

### Ja Implementado
- Sistema de **creditos de loja** (vouchers/troca) via `customer_credits`
- Historico de compras por cliente com total gasto e ticket medio
- Estrutura de clientes com CRUD completo

### Falta Implementar
- Acumulo automatico de pontos por vendas
- Configuracao de regras: R$ 1 = X pontos
- Regras de resgate: Y pontos = R$ 1 desconto
- Exibicao de saldo de pontos na ficha do cliente
- Uso de pontos como forma de pagamento no PDV

---

## Arquitetura da Solucao

```text
┌─────────────────────────────────────────────────────────────────┐
│                  Sistema de Fidelidade                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐          ┌──────────────────┐            │
│   │   Configuracao   │          │  Saldo Cliente   │            │
│   │   (Settings)     │          │   (Customers)    │            │
│   │                  │          │                  │            │
│   │ R$1 = 10 pts     │          │  Pontos: 1.250   │            │
│   │ 100 pts = R$1    │          │  = R$ 12,50      │            │
│   └──────────────────┘          └──────────────────┘            │
│                                                                  │
│   ┌──────────────────────────────────────────────────┐          │
│   │              Fluxo de Pontos                      │          │
│   │                                                   │          │
│   │   Venda → Acumula Pontos → Saldo Atualizado      │          │
│   │   PDV → Resgata Pontos → Desconto Aplicado       │          │
│   └──────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Estrutura de Dados

### Nova Tabela: customer_points

```sql
CREATE TABLE public.customer_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('earn', 'redeem', 'expire', 'manual')),
  sale_id UUID REFERENCES sales(id),
  description TEXT,
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customer_points_customer ON customer_points(customer_id);
CREATE INDEX idx_customer_points_tenant ON customer_points(tenant_id);
```

### Expansao da Tabela tenants.settings

Adicionar campos de configuracao do programa de fidelidade:

```json
{
  "loyalty_enabled": true,
  "loyalty_points_per_currency": 10,
  "loyalty_currency_per_points": 100,
  "loyalty_min_redeem_points": 100,
  "loyalty_points_expiration_days": 365
}
```

---

## 2. Funcoes de Banco de Dados

### Calcular Saldo de Pontos

```sql
CREATE OR REPLACE FUNCTION public.get_customer_points(p_customer_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE 
      WHEN movement_type = 'earn' THEN points
      WHEN movement_type = 'redeem' THEN -points
      WHEN movement_type = 'expire' THEN -points
      WHEN movement_type = 'manual' THEN points
      ELSE 0
    END
  ), 0)::INTEGER
  FROM public.customer_points
  WHERE customer_id = p_customer_id
  AND (expires_at IS NULL OR expires_at >= CURRENT_DATE);
$$;
```

### Creditar Pontos em Venda

```sql
CREATE OR REPLACE FUNCTION public.credit_loyalty_points(
  p_tenant_id UUID,
  p_customer_id UUID,
  p_sale_id UUID,
  p_sale_amount NUMERIC
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
  v_points_per_currency INTEGER;
  v_points_to_credit INTEGER;
  v_expiration_days INTEGER;
BEGIN
  -- Busca configuracoes do tenant
  SELECT settings INTO v_settings FROM tenants WHERE id = p_tenant_id;
  
  -- Verifica se fidelidade esta habilitada
  IF NOT COALESCE((v_settings->>'loyalty_enabled')::BOOLEAN, FALSE) THEN
    RETURN 0;
  END IF;
  
  v_points_per_currency := COALESCE((v_settings->>'loyalty_points_per_currency')::INTEGER, 10);
  v_expiration_days := COALESCE((v_settings->>'loyalty_points_expiration_days')::INTEGER, 365);
  
  -- Calcula pontos: arredonda para baixo
  v_points_to_credit := FLOOR(p_sale_amount * v_points_per_currency / 100);
  
  IF v_points_to_credit > 0 THEN
    INSERT INTO customer_points (tenant_id, customer_id, points, movement_type, sale_id, description, expires_at)
    VALUES (
      p_tenant_id, 
      p_customer_id, 
      v_points_to_credit, 
      'earn', 
      p_sale_id,
      'Pontos por compra',
      CURRENT_DATE + v_expiration_days
    );
  END IF;
  
  RETURN v_points_to_credit;
END;
$$;
```

---

## 3. Novos Hooks

### src/hooks/useLoyalty.ts

```typescript
// Buscar saldo de pontos do cliente
export function useCustomerPoints(customerId?: string)

// Buscar historico de movimentacoes de pontos
export function usePointsHistory(customerId?: string)

// Resgatar pontos (criar movimento de resgate)
export function useRedeemPoints()

// Adicionar pontos manualmente (admin)
export function useAddManualPoints()

// Buscar configuracoes de fidelidade do tenant
export function useLoyaltySettings()

// Atualizar configuracoes de fidelidade
export function useUpdateLoyaltySettings()
```

---

## 4. Modificacoes no Fluxo de Venda

### Integracao com useSales.ts

Ao finalizar uma venda com cliente identificado:

```typescript
// Apos criar a venda com sucesso
if (input.customer_id && loyaltyEnabled) {
  await supabase.rpc("credit_loyalty_points", {
    p_tenant_id: currentTenant.id,
    p_customer_id: input.customer_id,
    p_sale_id: sale.id,
    p_sale_amount: input.net_total,
  });
}
```

---

## 5. Componentes de UI

### src/components/loyalty/PointsBalance.tsx

Card que mostra saldo de pontos:
- Total de pontos disponiveis
- Valor equivalente em R$
- Botao para ver historico

### src/components/loyalty/PointsHistoryDialog.tsx

Modal com historico de movimentacoes:
- Data, tipo (ganhou/resgatou), quantidade
- Venda associada (se houver)
- Filtros por periodo

### src/components/loyalty/RedeemPointsDialog.tsx

Modal para resgate de pontos:
- Saldo disponivel
- Quantidade a resgatar
- Valor de desconto equivalente
- Validacao de minimo

### src/components/loyalty/LoyaltySettingsCard.tsx

Card para configurar programa (em Settings):
- Toggle habilitar/desabilitar
- Pontos por R$ gasto
- Valor do resgate
- Validade dos pontos

---

## 6. Modificacoes em Paginas Existentes

### Customers.tsx

Adicionar coluna/badge com saldo de pontos:

```text
┌─────────────────────────────────────────────────────────────┐
│ Nome        │ Telefone     │ Pontos   │ Acoes              │
├─────────────────────────────────────────────────────────────┤
│ Joao Silva  │ 11 99999     │ 1.250 🎁│ [📜] [✏️] [🗑️]   │
│ Maria...    │ 11 88888     │ 350 🎁  │ [📜] [✏️] [🗑️]   │
└─────────────────────────────────────────────────────────────┘
```

### CustomerHistoryDialog.tsx

Adicionar aba ou secao de pontos:
- Saldo atual
- Historico de pontos
- Botao para adicionar pontos manualmente

### Settings.tsx

Nova secao "Programa de Fidelidade":
- Ativar/desativar
- Configurar regras de acumulo e resgate

### PDV.tsx (PaymentDialog)

Adicionar opcao de pagamento com pontos:
- Mostrar saldo se cliente selecionado
- Permitir usar pontos como parte do pagamento
- Calcular desconto automaticamente

---

## 7. Estrutura de Arquivos

```text
src/
├── hooks/
│   └── useLoyalty.ts                    # NOVO
├── components/
│   └── loyalty/
│       ├── PointsBalance.tsx            # NOVO
│       ├── PointsHistoryDialog.tsx      # NOVO
│       ├── RedeemPointsDialog.tsx       # NOVO
│       └── LoyaltySettingsCard.tsx      # NOVO
├── pages/
│   ├── Customers.tsx                    # MODIFICAR
│   └── Settings.tsx                     # MODIFICAR
└── components/
    ├── customers/
    │   └── CustomerHistoryDialog.tsx    # MODIFICAR
    └── pdv/
        └── PaymentDialog.tsx            # MODIFICAR

supabase/
└── migrations/
    └── [timestamp]_loyalty_points.sql   # NOVO
```

---

## 8. Fluxo de Uso

### Acumulo de Pontos

```text
  Cliente faz compra de R$ 100
           │
           ▼
  Venda finalizada com customer_id
           │
           ▼
  Funcao credit_loyalty_points() 
           │
  R$ 100 × 10 pts/R$ = 1.000 pts
           │
           ▼
  Registro em customer_points
           │
           ▼
  Saldo do cliente atualizado
```

### Resgate de Pontos

```text
  Cliente no PDV com 2.000 pontos
           │
           ▼
  Seleciona "Usar Pontos" no pagamento
           │
           ▼
  Escolhe resgatar 1.000 pts
           │
  1.000 pts ÷ 100 = R$ 10 desconto
           │
           ▼
  Desconto aplicado no total
           │
           ▼
  Registro de resgate em customer_points
```

---

## 9. Configuracoes Padrao

| Parametro | Valor Padrao | Descricao |
|-----------|--------------|-----------|
| loyalty_enabled | false | Programa ativo |
| loyalty_points_per_currency | 10 | Pontos por R$ 1 gasto |
| loyalty_currency_per_points | 100 | Pontos para R$ 1 desconto |
| loyalty_min_redeem_points | 100 | Minimo para resgate |
| loyalty_points_expiration_days | 365 | Validade em dias |

---

## 10. Ordem de Implementacao

1. **Migracao SQL** - Criar tabela e funcoes
2. **src/hooks/useLoyalty.ts** - Hooks de dados
3. **Componentes loyalty/** - UI de exibicao
4. **Modificar Customers.tsx** - Mostrar pontos
5. **Modificar CustomerHistoryDialog** - Aba de pontos
6. **Modificar Settings.tsx** - Configuracoes
7. **Modificar useSales.ts** - Creditacao automatica
8. **Modificar PaymentDialog** - Resgate no PDV
9. **Testes e ajustes**

---

## 11. Consideracoes de UX

- **Feedback Visual**: Toast ao ganhar/resgatar pontos
- **Clareza**: Sempre mostrar equivalencia pts ↔ R$
- **Validacoes**: Impedir resgate abaixo do minimo
- **Expiracao**: Alertar sobre pontos proximos de expirar
- **Historico**: Permitir ver todas movimentacoes

---

## 12. Beneficios Esperados

| Melhoria | Impacto |
|----------|---------|
| Fidelizacao | Incentiva retorno do cliente |
| Ticket medio | Estimula compras maiores |
| Dados | Melhora rastreamento de clientes |
| Competitividade | Recurso comum em varejo |

