
# Plano de Implementacao - Melhorias Essenciais Nexus Retail Cloud

## Analise do Estado Atual

### JA IMPLEMENTADO (Sprints 1 e 2)

**Sprint 1 - Codigo de Barras e Impressao:**
- Tabela `product_barcodes` com suporte a multiplos codigos por produto
- Validacao EAN8/EAN13 com digito verificador
- Geracao automatica de codigos internos
- Hook `useBarcodes` completo
- Busca por codigo de barras no PDV
- Impressao de etiquetas em lote
- Tabela `printer_configs` para impressoras
- Hook `usePrinter` para configuracoes
- Componente `ReceiptPreview` para cupom nao-fiscal
- Componente `PixQRCode` para geracao de QR PIX

**Sprint 2 - Controle de Caixa:**
- Tabelas `cash_registers`, `cash_sessions`, `cash_movements`
- Abertura/fechamento de caixa com fundo inicial
- Sangria e suprimento
- Historico de sessoes
- Funcao `calculate_expected_balance`

---

## FUNCIONALIDADES FALTANTES (Por Prioridade)

### SPRINT 3: Formas de Pagamento Expandidas (Proxima Prioridade)

**Novas Tabelas:**

```sql
-- Formas de pagamento configuraveis
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- money, card_credit, card_debit, pix, check, credit, voucher
  requires_change BOOLEAN DEFAULT false,
  allows_installments BOOLEAN DEFAULT false,
  max_installments INTEGER DEFAULT 1,
  fee_percentage NUMERIC(5,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  UNIQUE(tenant_id, code)
);

-- Pagamentos da venda (vendas mistas)
CREATE TABLE sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id),
  payment_method_id UUID REFERENCES payment_methods(id),
  payment_method_code TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  change_amount NUMERIC(12,2) DEFAULT 0,
  installments INTEGER DEFAULT 1,
  authorization_code TEXT
);

-- Credito de clientes (vale-compra)
CREATE TABLE customer_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  amount NUMERIC(12,2) NOT NULL,
  used_amount NUMERIC(12,2) DEFAULT 0,
  origin_type TEXT NOT NULL, -- return, promotion, purchase
  origin_id UUID,
  expires_at DATE
);
```

**Hooks a Criar:**
- `src/hooks/usePaymentMethods.ts` - CRUD de formas de pagamento
- `src/hooks/useCustomerCredits.ts` - Creditos de clientes

**Componentes a Criar:**
- `src/components/pdv/PaymentSelector.tsx` - Selecao de multiplas formas
- `src/components/pdv/MixedPaymentDialog.tsx` - Pagamento misto
- `src/components/pdv/ChangeCalculator.tsx` - Calculo de troco

**Modificacoes:**
- PDV.tsx: Novo fluxo de pagamento com multiplas opcoes
- useSales.ts: Suporte a multiplos pagamentos por venda

---

### SPRINT 4: Estoque Avancado

**Novas Tabelas:**

```sql
-- Lotes de produtos
CREATE TABLE product_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  product_id UUID NOT NULL REFERENCES products(id),
  lot_number TEXT NOT NULL,
  manufacture_date DATE,
  expiry_date DATE,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12,2),
  status TEXT DEFAULT 'active',
  UNIQUE(tenant_id, product_id, lot_number)
);

-- Inventarios/Balanco
CREATE TABLE inventory_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, in_progress, completed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL
);

-- Itens do inventario
CREATE TABLE inventory_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id UUID NOT NULL REFERENCES inventory_counts(id),
  product_id UUID NOT NULL REFERENCES products(id),
  expected_quantity NUMERIC(12,3) NOT NULL,
  counted_quantity NUMERIC(12,3),
  difference NUMERIC(12,3),
  adjustment_reason TEXT
);
```

**Alteracoes em products:**

```sql
ALTER TABLE products ADD COLUMN wholesale_price NUMERIC(12,2);
ALTER TABLE products ADD COLUMN wholesale_min_qty NUMERIC(12,3);
ALTER TABLE products ADD COLUMN weighted_avg_cost NUMERIC(12,2);
ALTER TABLE products ADD COLUMN controls_lot BOOLEAN DEFAULT false;
```

**Hooks a Criar:**
- `src/hooks/useLots.ts` - Controle de lotes
- `src/hooks/useInventory.ts` - Inventario e balanco

**Componentes a Criar:**
- `src/components/stock/LotManager.tsx`
- `src/components/stock/ExpiryAlerts.tsx`
- `src/components/import/ProductImporter.tsx` - Importacao CSV/Excel
- `src/components/import/ProductExporter.tsx`

**Paginas a Criar:**
- `src/pages/Inventory.tsx`

---

### SPRINT 5: Relatorios Essenciais

**Novas Tabelas:**

```sql
-- Comissoes de vendedores
CREATE TABLE seller_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL,
  sale_id UUID NOT NULL REFERENCES sales(id),
  percentage NUMERIC(5,2) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending'
);
```

**Hooks a Criar:**
- `src/hooks/useReports.ts` - Relatorios diversos

**Componentes a Criar:**
- `src/components/reports/ProductRankingReport.tsx`
- `src/components/reports/ProfitMarginReport.tsx`
- `src/components/reports/ABCCurveReport.tsx`
- `src/components/reports/CashFlowReport.tsx`
- `src/components/reports/DREReport.tsx`

**Paginas a Criar:**
- `src/pages/Reports.tsx` - Hub de relatorios

**Utilidades:**
- `src/lib/pdf-generator.ts`
- `src/lib/excel-exporter.ts`

---

### SPRINT 6: Gestao de Clientes/Fornecedores e Contas

**Novas Tabelas:**

```sql
-- Fornecedores
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT,
  address JSONB,
  active BOOLEAN DEFAULT true
);

-- Contas a pagar
CREATE TABLE payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  supplier_id UUID REFERENCES suppliers(id),
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending'
);

-- Contas a receber
CREATE TABLE receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID REFERENCES customers(id),
  sale_id UUID REFERENCES sales(id),
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending'
);

-- Pontos de fidelidade
CREATE TABLE loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  points INTEGER NOT NULL,
  type TEXT NOT NULL, -- earned, redeemed
  sale_id UUID REFERENCES sales(id)
);
```

**Alteracoes em customers:**

```sql
ALTER TABLE customers ADD COLUMN address JSONB;
ALTER TABLE customers ADD COLUMN credit_limit NUMERIC(12,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN current_balance NUMERIC(12,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN loyalty_points INTEGER DEFAULT 0;
```

**Edge Functions a Criar:**
- `supabase/functions/viacep/index.ts` - Consulta CEP
- `supabase/functions/cnpj-lookup/index.ts` - Consulta CNPJ

**Hooks a Criar:**
- `src/hooks/useSuppliers.ts`
- `src/hooks/usePayables.ts`
- `src/hooks/useReceivables.ts`
- `src/hooks/useLoyalty.ts`

**Paginas a Criar:**
- `src/pages/Suppliers.tsx`
- `src/pages/Payables.tsx`
- `src/pages/Receivables.tsx`

---

### SPRINT 7: Seguranca e Permissoes

**Novas Tabelas:**

```sql
-- Perfis de acesso
CREATE TABLE permission_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'
);

-- Log de auditoria
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Hooks a Criar:**
- `src/hooks/usePermissions.ts`
- `src/hooks/useAuditLog.ts`

**Componentes a Criar:**
- `src/components/auth/PasswordPrompt.tsx` - Para acoes sensiveis

---

### SPRINT 8: Melhorias no PDV

**Funcionalidades:**
- Atalhos de teclado expandidos (F1-F12)
- Busca por categoria
- Ultimas vendas com reimpressao
- Cancelamento com motivo obrigatorio
- Devolucao e troca de produtos
- Orcamento/Pre-venda

**Tabelas:**

```sql
-- Pre-vendas/Orcamentos
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID REFERENCES customers(id),
  status TEXT DEFAULT 'draft', -- draft, converted, cancelled
  valid_until DATE,
  total NUMERIC(12,2) NOT NULL,
  converted_sale_id UUID REFERENCES sales(id)
);

-- Alteracao em sales para cancelamento
ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'completed';
ALTER TABLE sales ADD COLUMN cancelled_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN cancellation_reason TEXT;
```

---

## CORRECOES PENDENTES IDENTIFICADAS

### 1. Link do Caixa no Menu de Navegacao

O menu lateral nao tem link para a pagina `/cash-register`. Precisa adicionar em `AppLayout.tsx`:

```typescript
{ path: "/cash-register", label: "Caixa", icon: DollarSign }
```

### 2. Integracao PDV com Sessao de Caixa

O PDV deveria verificar se ha caixa aberto antes de permitir vendas e vincular vendas a sessao ativa.

### 3. Registro de Vendas como Movimentacao de Caixa

Ao finalizar venda, registrar movimento na `cash_movements` com `session_id`.

---

## PROXIMA IMPLEMENTACAO RECOMENDADA

Baseado na prioridade solicitada, a proxima implementacao deve ser:

1. **Corrigir Menu de Navegacao** - Adicionar link para Caixa
2. **Integrar PDV com Caixa** - Vincular vendas a sessoes
3. **Sprint 3: Formas de Pagamento** - Expandir opcoes de pagamento

### Arquivos a Modificar Imediatamente:

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/layout/AppLayout.tsx` | Adicionar item "Caixa" no menu |
| `src/pages/PDV.tsx` | Verificar sessao de caixa ativa antes de vendas |
| `src/hooks/useSales.ts` | Vincular `session_id` nas vendas |

### Estimativa de Esforco:

| Sprint | Complexidade | Estimativa |
|--------|-------------|------------|
| Correcoes | Baixa | 1-2 horas |
| Sprint 3 | Media | 1.5 semanas |
| Sprint 4 | Alta | 2 semanas |
| Sprint 5 | Media | 1.5 semanas |
| Sprint 6 | Alta | 2 semanas |
| Sprint 7 | Media | 1 semana |
| Sprint 8 | Media | 1.5 semanas |

**Total estimado: 9-10 semanas**

---

## ORDEM DE IMPLEMENTACAO

1. Correcoes pendentes (menu, integracao caixa)
2. Sprint 3: Formas de pagamento
3. Sprint 4: Estoque avancado
4. Sprint 5: Relatorios
5. Sprint 6: Clientes/Fornecedores
6. Sprint 7: Seguranca
7. Sprint 8: Melhorias PDV

Confirme para iniciar pela **correcao do menu e integracao do PDV com o caixa**, seguido do **Sprint 3: Formas de Pagamento Expandidas**.
