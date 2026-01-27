
# Sprint 3: Formas de Pagamento Expandidas

## Visao Geral

Este sprint implementa um sistema completo de formas de pagamento configuraveis, vendas mistas (multiplas formas de pagamento na mesma venda), parcelamento e integracao PIX com QR Code automatico.

## Arquitetura da Solucao

```text
┌─────────────────────────────────────────────────────────────┐
│                         PDV                                  │
├─────────────────────────────────────────────────────────────┤
│  Carrinho  →  PaymentDialog  →  Formas de Pagamento         │
│                    │                                         │
│         ┌─────────┼─────────┐                               │
│         ▼         ▼         ▼                               │
│    Dinheiro    Cartao      PIX                              │
│    (troco)   (parcelas)  (QR Code)                          │
│         └─────────┼─────────┘                               │
│                   ▼                                          │
│            sale_payments (1:N)                               │
│                   │                                          │
│                   ▼                                          │
│            Finalizacao                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Migracao do Banco de Dados

### Novas Tabelas

**payment_methods** - Formas de pagamento configuraveis por tenant

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | Chave primaria |
| tenant_id | UUID | Referencia ao tenant |
| code | TEXT | Codigo unico (ex: dinheiro, pix) |
| name | TEXT | Nome de exibicao |
| type | TEXT | Tipo (money, card_credit, card_debit, pix, voucher, credit) |
| requires_change | BOOLEAN | Exige calculo de troco |
| allows_installments | BOOLEAN | Permite parcelamento |
| max_installments | INTEGER | Maximo de parcelas |
| fee_percentage | NUMERIC(5,2) | Taxa percentual |
| active | BOOLEAN | Ativo/Inativo |
| display_order | INTEGER | Ordem de exibicao |

**sale_payments** - Pagamentos por venda (suporta vendas mistas)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | Chave primaria |
| sale_id | UUID | Referencia a venda |
| payment_method_id | UUID | Referencia a forma de pagamento |
| payment_method_code | TEXT | Codigo da forma (fallback) |
| amount | NUMERIC(12,2) | Valor pago nesta forma |
| change_amount | NUMERIC(12,2) | Troco (se dinheiro) |
| installments | INTEGER | Numero de parcelas |
| authorization_code | TEXT | Codigo de autorizacao (cartao) |

**customer_credits** - Vale-compra e creditos de clientes

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | Chave primaria |
| tenant_id | UUID | Referencia ao tenant |
| customer_id | UUID | Referencia ao cliente |
| amount | NUMERIC(12,2) | Valor do credito |
| used_amount | NUMERIC(12,2) | Valor ja utilizado |
| origin_type | TEXT | Origem (return, promotion, purchase) |
| origin_id | UUID | ID da origem |
| expires_at | DATE | Data de validade |

### Funcao de Seed para Formas Padrao

Criar formas de pagamento padrao automaticamente para novos tenants:
- Dinheiro (money, requires_change: true)
- Cartao de Credito (card_credit, allows_installments: true, max: 12)
- Cartao de Debito (card_debit)
- PIX (pix)
- Fiado/Crediario (credit)

### RLS Policies

Todas as tabelas seguem o padrao multi-tenant existente com `user_belongs_to_tenant()`.

---

## 2. Hooks React Query

### usePaymentMethods.ts

```typescript
// Funcionalidades:
- usePaymentMethods(): Listar formas de pagamento ativas
- useCreatePaymentMethod(): Criar nova forma
- useUpdatePaymentMethod(): Atualizar forma
- useTogglePaymentMethod(): Ativar/desativar
- useSeedDefaultPaymentMethods(): Popular formas padrao
```

### useCustomerCredits.ts

```typescript
// Funcionalidades:
- useCustomerCredits(customerId): Listar creditos do cliente
- useAvailableCredit(customerId): Calcular credito disponivel
- useCreateCredit(): Criar novo credito
- useUseCredit(): Utilizar credito em venda
```

---

## 3. Componentes de UI

### src/components/pdv/PaymentDialog.tsx

Dialog principal para selecao de pagamento com:
- Lista de formas de pagamento disponiveis
- Suporte a pagamento misto (adicionar multiplas formas)
- Calculo de troco para dinheiro
- Selecao de parcelas para cartao
- Exibicao de QR Code PIX
- Validacao de valor total

### src/components/pdv/PaymentMethodCard.tsx

Card individual para cada forma de pagamento:
- Icone e nome da forma
- Input de valor
- Campo de parcelas (se aplicavel)
- Campo de troco (se dinheiro)

### src/components/pdv/ChangeCalculator.tsx

Calculadora de troco para pagamentos em dinheiro:
- Input de valor recebido
- Exibicao do troco
- Sugestoes de valores (R$10, R$20, R$50, R$100)

### src/components/pdv/InstallmentsSelector.tsx

Seletor de parcelas para cartao de credito:
- Dropdown com opcoes de parcelas
- Exibicao de valor por parcela
- Indicacao de juros (se configurado)

### src/components/pdv/PixPaymentSection.tsx

Secao de pagamento PIX:
- Geracao automatica de QR Code
- Botao para copiar codigo copia-e-cola
- Timer de validade (opcional)

---

## 4. Alteracoes no PDV

### Novo Fluxo de Pagamento

1. Usuario clica em "Finalizar Venda (F2)"
2. Abre PaymentDialog com o total da venda
3. Usuario seleciona forma(s) de pagamento
4. Para cada forma, informa o valor
5. Sistema valida que soma = total
6. Venda e finalizada com multiplos registros em sale_payments

### Atualizacoes no PDV.tsx

- Substituir Select simples por botao que abre PaymentDialog
- Passar array de pagamentos para createSale
- Mostrar resumo de pagamentos na confirmacao
- Suporte a atalhos: F5 para PIX rapido

### Atualizacoes no useSales.ts

- Modificar CreateSaleInput para aceitar array de payments
- Inserir registros em sale_payments
- Registrar movimentacoes de caixa separadas por forma
- Manter retrocompatibilidade com payment_method unico

---

## 5. Pagina de Configuracao

### Adicionar em Settings.tsx

Nova secao "Formas de Pagamento":
- Listagem de formas configuradas
- Botao para criar nova forma
- Toggle para ativar/desativar
- Edicao de taxas e limites de parcelas

---

## 6. Estrutura de Arquivos

```text
src/
├── hooks/
│   ├── usePaymentMethods.ts    # NOVO
│   └── useCustomerCredits.ts   # NOVO
├── components/
│   └── pdv/
│       ├── PaymentDialog.tsx       # NOVO
│       ├── PaymentMethodCard.tsx   # NOVO
│       ├── ChangeCalculator.tsx    # NOVO
│       ├── InstallmentsSelector.tsx # NOVO
│       └── PixPaymentSection.tsx   # NOVO
├── pages/
│   ├── PDV.tsx                 # MODIFICAR
│   └── Settings.tsx            # MODIFICAR
└── lib/
    └── validations.ts          # MODIFICAR (novos schemas)

supabase/
└── migrations/
    └── [timestamp]_payment_methods.sql  # NOVO
```

---

## 7. Detalhes Tecnicos

### Interface de Pagamento

```typescript
interface SalePayment {
  payment_method_id?: string;
  payment_method_code: string;
  amount: number;
  change_amount?: number;
  installments?: number;
  authorization_code?: string;
}

interface CreateSaleInput {
  items: SaleItem[];
  payments: SalePayment[];  // NOVO - substituir payment_method
  customer_id?: string | null;
  session_id?: string | null;
  discount_total?: number;
  notes?: string;
}
```

### Validacoes

- Soma dos pagamentos deve ser igual ou maior que o total
- Troco so permitido para forma tipo "money"
- Parcelas respeitam max_installments configurado
- Credito do cliente nao pode exceder saldo disponivel

### Movimentacoes de Caixa

Para vendas mistas, criar uma movimentacao para cada forma:
```typescript
// Exemplo: Venda de R$100 (R$50 dinheiro + R$50 cartao)
await supabase.from("cash_movements").insert([
  { movement_type: "sale", payment_method: "dinheiro", amount: 50 },
  { movement_type: "sale", payment_method: "cartao_credito", amount: 50 },
]);
```

---

## 8. Ordem de Implementacao

1. **Migracao SQL** - Criar tabelas payment_methods, sale_payments, customer_credits
2. **Hook usePaymentMethods** - CRUD de formas de pagamento
3. **Seed de formas padrao** - Criar formas automaticamente
4. **Componentes de pagamento** - PaymentDialog e subcomponentes
5. **Integracao PDV** - Substituir fluxo de pagamento
6. **Modificar useSales** - Suporte a multiplos pagamentos
7. **Pagina de configuracao** - Gerenciar formas em Settings
8. **Hook useCustomerCredits** - Sistema de vale-compra

---

## 9. Consideracoes de UX

- Manter opcao de pagamento simples (apenas 1 forma) rapido
- PIX deve gerar QR Code instantaneamente
- Mostrar resumo claro antes de finalizar
- Atalho F2 continua funcionando para pagamento rapido
- Troco calculado automaticamente ao informar valor recebido

---

## 10. Estimativa

| Tarefa | Complexidade | Tempo |
|--------|-------------|-------|
| Migracao SQL | Baixa | 30 min |
| usePaymentMethods | Media | 2h |
| Componentes PDV | Alta | 4h |
| Integracao PDV | Alta | 3h |
| useSales modificacao | Media | 2h |
| Settings pagina | Media | 2h |
| useCustomerCredits | Media | 2h |
| Testes e ajustes | Media | 3h |

**Total estimado: 18-20 horas**
