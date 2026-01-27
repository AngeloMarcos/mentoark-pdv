
# Plano de Implementacao - Nexus Retail Cloud POS

## Analise do Sistema Atual

O sistema atual ja possui:
- Autenticacao e multi-tenancy funcionais
- PDV basico com carrinho e finalizacao
- Produtos com estoque basico
- Sistema de mesas e comandas
- Relatorios simples de vendas
- Financeiro basico (entradas/saidas)
- Clientes com historico de compras

## Estrutura do Plano

Devido a magnitude do projeto (12+ modulos, 100+ funcionalidades), este plano sera dividido em **6 Sprints** priorizados conforme solicitado.

---

## SPRINT 1: Codigo de Barras e Impressao (2 semanas)

### 1.1 Codigo de Barras Completo

**Tabelas de Banco de Dados:**

```sql
-- Multiplos codigos por produto
CREATE TABLE product_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  barcode_type TEXT DEFAULT 'EAN13', -- EAN8, EAN13, INTERNAL
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, barcode)
);
```

**Funcionalidades:**
- Hook `useBarcodes` para CRUD de codigos
- Geracao automatica de codigos internos (8 digitos + check digit)
- Validacao EAN8/EAN13 com digito verificador
- Busca rapida no PDV por barcode
- Componente `BarcodeGenerator` usando biblioteca `jsbarcode`
- Componente `BarcodeScanner` para input de leitor

**Arquivos a criar:**
- `src/hooks/useBarcodes.ts`
- `src/components/barcode/BarcodeGenerator.tsx`
- `src/components/barcode/BarcodeScanner.tsx`
- `src/components/barcode/BarcodeLabelPrint.tsx`

**Modificacoes no PDV:**
- Input de busca processa automaticamente codigos de barras
- Evento de teclado captura leitores fisicos

### 1.2 Sistema de Impressao

**Tabelas:**

```sql
-- Configuracoes de impressora por tenant
CREATE TABLE printer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  printer_type TEXT NOT NULL, -- thermal, label, fiscal
  connection_type TEXT NOT NULL, -- usb, network, bluetooth
  ip_address TEXT,
  port INTEGER,
  paper_width INTEGER DEFAULT 80, -- mm
  is_default BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Funcionalidades:**
- Impressao de cupom nao-fiscal via ESC/POS
- Componente `ReceiptPreview` com formatacao termica
- Geracao de QR Code PIX (copia-e-cola e QRCode)
- Hook `usePrinter` para envio de comandos
- Impressao de etiquetas de codigo de barras em lote

**Arquivos:**
- `src/hooks/usePrinter.ts`
- `src/components/print/ReceiptPreview.tsx`
- `src/components/print/PixQRCode.tsx`
- `src/lib/escpos-commands.ts`

**Observacao sobre Fiscal (NFC-e/SAT):**
- Integracao fiscal requer API externa (Focus NFe, Nuvem Fiscal)
- Sera implementado como Edge Function para comunicacao
- Usuario precisara fornecer certificado digital e credenciais

---

## SPRINT 2: Controle de Caixa Avancado (1.5 semanas)

### 2.1 Estrutura de Caixa

**Tabelas:**

```sql
-- Caixas/PDVs
CREATE TABLE cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Sessoes de caixa
CREATE TABLE cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  register_id UUID NOT NULL REFERENCES cash_registers(id),
  user_id UUID NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(12,2),
  expected_balance NUMERIC(12,2),
  difference NUMERIC(12,2),
  difference_reason TEXT,
  status TEXT DEFAULT 'open', -- open, closed
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Movimentacoes de caixa
CREATE TABLE cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  session_id UUID NOT NULL REFERENCES cash_sessions(id),
  movement_type TEXT NOT NULL, -- opening, sale, supply, withdrawal, closing
  payment_method TEXT,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  sale_id UUID REFERENCES sales(id),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Funcionalidades:**
- Abertura de caixa com fundo inicial obrigatorio
- Sangria (retirada) e Suprimento (entrada) durante o dia
- Fechamento com conferencia por forma de pagamento
- Registro de diferenca (sobra/falta) com motivo obrigatorio
- Historico completo de caixas
- Multiplos caixas simultaneos por loja
- Relatorio detalhado de movimentacoes

**Arquivos:**
- `src/hooks/useCashRegister.ts`
- `src/pages/CashRegister.tsx`
- `src/components/cash/OpenCashDialog.tsx`
- `src/components/cash/CloseCashDialog.tsx`
- `src/components/cash/CashMovementDialog.tsx`
- `src/components/cash/CashSessionSummary.tsx`

**Modificacoes:**
- PDV verifica se existe sessao aberta antes de permitir vendas
- Vendas sao vinculadas a sessao ativa
- Navegacao adiciona item "Caixa"

---

## SPRINT 3: Formas de Pagamento Expandidas (1.5 semanas)

### 3.1 Estrutura de Pagamentos

**Tabelas:**

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
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Parcelas de vendas
CREATE TABLE sale_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id),
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, paid, overdue
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pagamentos da venda (para vendas mistas)
CREATE TABLE sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id),
  payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
  amount NUMERIC(12,2) NOT NULL,
  change_amount NUMERIC(12,2) DEFAULT 0,
  installments INTEGER DEFAULT 1,
  authorization_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
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
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Funcionalidades:**
- Ate 8 formas de pagamento configuraveis
- Venda mista (multiplas formas na mesma venda)
- PIX com QR Code gerado (integracao Mercado Pago opcional)
- Parcelamento com/sem juros
- Crediario proprio com controle de parcelas
- Vale/Credito de clientes
- Desconto automatico de taxa de cartao

**Arquivos:**
- `src/hooks/usePaymentMethods.ts`
- `src/hooks/useInstallments.ts`
- `src/hooks/useCustomerCredits.ts`
- `src/components/pdv/PaymentSelector.tsx`
- `src/components/pdv/MixedPaymentDialog.tsx`
- `src/components/pdv/InstallmentsCalculator.tsx`

**Modificacoes no PDV:**
- Novo fluxo de pagamento com multiplas opcoes
- Calculo automatico de troco
- Validacao de limite de credito do cliente

---

## SPRINT 4: Estoque Avancado (2 semanas)

### 4.1 Controle Completo de Estoque

**Tabelas:**

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
  status TEXT DEFAULT 'active', -- active, expired, blocked
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, product_id, lot_number)
);

-- Transferencias entre lojas
CREATE TABLE stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  origin_store_id UUID NOT NULL,
  destination_store_id UUID NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, in_transit, completed, cancelled
  requested_by UUID NOT NULL,
  approved_by UUID,
  completed_by UUID,
  requested_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  notes TEXT
);

-- Itens da transferencia
CREATE TABLE stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id),
  product_id UUID NOT NULL REFERENCES products(id),
  lot_id UUID REFERENCES product_lots(id),
  quantity NUMERIC(12,3) NOT NULL,
  received_quantity NUMERIC(12,3)
);

-- Inventarios/Balanco
CREATE TABLE inventory_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, in_progress, completed, cancelled
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Itens do inventario
CREATE TABLE inventory_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id UUID NOT NULL REFERENCES inventory_counts(id),
  product_id UUID NOT NULL REFERENCES products(id),
  expected_quantity NUMERIC(12,3) NOT NULL,
  counted_quantity NUMERIC(12,3),
  difference NUMERIC(12,3),
  adjustment_reason TEXT,
  counted_by UUID,
  counted_at TIMESTAMPTZ
);
```

**Modificacoes na tabela products:**

```sql
ALTER TABLE products ADD COLUMN wholesale_price NUMERIC(12,2);
ALTER TABLE products ADD COLUMN wholesale_min_qty NUMERIC(12,3);
ALTER TABLE products ADD COLUMN weighted_avg_cost NUMERIC(12,2);
ALTER TABLE products ADD COLUMN last_purchase_cost NUMERIC(12,2);
ALTER TABLE products ADD COLUMN last_purchase_date TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN controls_lot BOOLEAN DEFAULT false;
```

**Funcionalidades:**
- Alertas automaticos de estoque minimo (ja parcial)
- Alertas de produtos vencendo
- Controle de lote e validade
- Inventario com ajustes
- Custo medio ponderado automatico
- Importacao/Exportacao Excel/CSV
- Preco varejo e atacado

**Arquivos:**
- `src/hooks/useLots.ts`
- `src/hooks/useInventory.ts`
- `src/hooks/useStockTransfer.ts`
- `src/pages/Inventory.tsx`
- `src/pages/StockTransfer.tsx`
- `src/components/stock/LotManager.tsx`
- `src/components/stock/ExpiryAlerts.tsx`
- `src/components/import/ProductImporter.tsx`
- `src/components/import/ProductExporter.tsx`
- `src/lib/csv-parser.ts`
- `src/lib/excel-parser.ts`

---

## SPRINT 5: Relatorios Essenciais (1.5 semanas)

### 5.1 Analytics e Relatorios

**Tabelas:**

```sql
-- Comissoes de vendedores
CREATE TABLE seller_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL,
  sale_id UUID NOT NULL REFERENCES sales(id),
  percentage NUMERIC(5,2) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, paid
  paid_at TIMESTAMPTZ,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Metas de vendedores
CREATE TABLE seller_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL,
  achieved_amount NUMERIC(12,2) DEFAULT 0,
  commission_percentage NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Novos Relatorios:**
- Ranking de produtos (mais/menos vendidos)
- Vendas por periodo, vendedor, forma de pagamento
- Margem de lucro por produto e por venda
- Fluxo de caixa detalhado
- Curva ABC de produtos
- Comissoes de vendedores
- DRE simplificado
- Exportacao Excel/PDF

**Arquivos:**
- `src/hooks/useReports.ts`
- `src/pages/Reports.tsx` (hub de relatorios)
- `src/components/reports/ProductRankingReport.tsx`
- `src/components/reports/ProfitMarginReport.tsx`
- `src/components/reports/ABCCurveReport.tsx`
- `src/components/reports/CommissionReport.tsx`
- `src/components/reports/DREReport.tsx`
- `src/components/reports/CashFlowReport.tsx`
- `src/lib/pdf-generator.ts`
- `src/lib/excel-exporter.ts`

---

## SPRINT 6: Funcionalidades Adicionais (2+ semanas)

### 6.1 Gestao de Clientes e Fornecedores

**Tabelas:**

```sql
-- Fornecedores
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  document TEXT, -- CNPJ
  email TEXT,
  phone TEXT,
  address JSONB,
  contact_name TEXT,
  payment_terms TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
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
  status TEXT DEFAULT 'pending',
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
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
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pontos de fidelidade
CREATE TABLE loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  points INTEGER NOT NULL,
  type TEXT NOT NULL, -- earned, redeemed, expired
  sale_id UUID REFERENCES sales(id),
  description TEXT,
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Modificacoes em customers:**

```sql
ALTER TABLE customers ADD COLUMN address JSONB;
ALTER TABLE customers ADD COLUMN credit_limit NUMERIC(12,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN current_balance NUMERIC(12,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN loyalty_points INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN customer_group_id UUID;
```

**Funcionalidades:**
- Limite de credito com alerta no PDV
- Busca de endereco por CEP (ViaCEP)
- Busca de CNPJ (ReceitaWS)
- Programa de fidelidade com pontos
- Contas a pagar/receber
- Controle de inadimplencia

### 6.2 Kits e Combos

**Tabelas:**

```sql
-- Kits/Combos
CREATE TABLE product_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  product_id UUID NOT NULL REFERENCES products(id), -- produto "pai"
  name TEXT NOT NULL,
  description TEXT,
  kit_price NUMERIC(12,2) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Componentes do kit
CREATE TABLE product_kit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES product_kits(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1
);
```

### 6.3 Seguranca e Permissoes

**Tabelas:**

```sql
-- Perfis de acesso
CREATE TABLE permission_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL, -- Admin, Gerente, Caixa, Vendedor
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Log de auditoria
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL,
  action TEXT NOT NULL, -- create, update, delete
  entity_type TEXT NOT NULL, -- product, sale, stock, etc
  entity_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Funcionalidades:**
- Perfis: Admin, Gerente, Caixa, Vendedor
- Permissoes granulares por modulo
- Log de alteracoes criticas
- Autenticacao por senha para acoes sensiveis

### 6.4 Melhorias no PDV

**Funcionalidades:**
- Atalhos de teclado (F1-F12)
- Busca por categoria
- Ultimas vendas com reimpressao
- Cancelamento com motivo obrigatorio
- Devolucao e troca de produtos
- Orcamento/Pre-venda

### 6.5 Integracao com APIs Externas

**Edge Functions:**
- `supabase/functions/viacep` - Consulta CEP
- `supabase/functions/cnpj-lookup` - Consulta CNPJ
- `supabase/functions/pix-qrcode` - Geracao PIX (Mercado Pago)
- `supabase/functions/nfe-emit` - Emissao NFe (Focus NFe)

---

## Resumo de Arquivos por Sprint

| Sprint | Novos Arquivos | Migrations | Prioridade |
|--------|---------------|------------|------------|
| 1 | ~12 arquivos | 2 tabelas | ALTA |
| 2 | ~8 arquivos | 3 tabelas | ALTA |
| 3 | ~8 arquivos | 4 tabelas | ALTA |
| 4 | ~12 arquivos | 5 tabelas | MEDIA |
| 5 | ~10 arquivos | 2 tabelas | MEDIA |
| 6 | ~20 arquivos | 10+ tabelas | BAIXA |

---

## Consideracoes Tecnicas

### Performance
- Indices em todas as colunas de busca e foreign keys
- Paginacao em todas as listagens
- Cache com React Query ja implementado
- Considerar particionamento de tabelas grandes (sales, stock_movements)

### Seguranca
- Todas as tabelas com RLS multi-tenant
- Validacao com Zod em todas as entradas
- Transacoes atomicas para operacoes criticas
- Audit log para alteracoes sensiveis

### Padroes de Codigo
- Hooks seguindo padrao existente (useXxx.ts)
- Componentes em pastas por feature
- Tipos TypeScript para todas as entidades
- Skeleton loaders para todos os estados de carregamento

---

## Proximos Passos Recomendados

1. **Comecar pelo Sprint 1** - Codigo de barras e impressao sao fundamentais para operacao do PDV
2. **Sprint 2 imediatamente apos** - Controle de caixa e essencial para gestao financeira
3. **Sprints 3-4** podem ser paralelos se necessario
4. **Sprint 5-6** podem ser incrementais apos estabilizacao

**Estimativa total**: 10-12 semanas de desenvolvimento
**Recomendacao**: Implementar em fases com validacao do usuario entre sprints
