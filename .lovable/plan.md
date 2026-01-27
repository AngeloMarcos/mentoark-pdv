

# Sprint 4: Estoque Avancado - Plano de Implementacao

## Resumo Executivo

Implementacao do sistema avancado de estoque incluindo controle de lotes com validade, inventario/balanco com ajustes automaticos, custo medio ponderado e importacao/exportacao de produtos.

---

## 1. Migracao do Banco de Dados

### Novas Tabelas

**product_lots** - Controle de lotes por produto
```sql
CREATE TABLE product_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  manufacture_date DATE,
  expiry_date DATE,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12,2),
  status TEXT DEFAULT 'active', -- active, expired, blocked
  supplier_info TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, product_id, lot_number)
);
```

**inventory_counts** - Cabecalho de inventarios/balancos
```sql
CREATE TABLE inventory_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, in_progress, completed, cancelled
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  completed_by UUID,
  total_products INTEGER DEFAULT 0,
  total_difference_value NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**inventory_count_items** - Itens do inventario
```sql
CREATE TABLE inventory_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id UUID NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  expected_quantity NUMERIC(12,3) NOT NULL,
  counted_quantity NUMERIC(12,3),
  difference NUMERIC(12,3),
  difference_value NUMERIC(12,2),
  adjustment_reason TEXT,
  counted_by UUID,
  counted_at TIMESTAMPTZ
);
```

### Alteracoes na Tabela Products

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_min_qty NUMERIC(12,3) DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weighted_avg_cost NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS controls_lot BOOLEAN DEFAULT false;
```

### Funcoes SQL

**update_weighted_avg_cost** - Recalcula custo medio ponderado
```sql
CREATE OR REPLACE FUNCTION update_weighted_avg_cost(
  p_product_id UUID,
  p_incoming_qty NUMERIC,
  p_incoming_cost NUMERIC
) RETURNS NUMERIC
```

**get_expiring_products** - Retorna produtos proximos ao vencimento
```sql
CREATE OR REPLACE FUNCTION get_expiring_products(
  p_tenant_id UUID,
  p_days_ahead INTEGER DEFAULT 30
) RETURNS TABLE(...)
```

### RLS Policies

Todas as tabelas seguem o padrao multi-tenant:
- `product_lots`: user_belongs_to_tenant()
- `inventory_counts`: user_belongs_to_tenant()
- `inventory_count_items`: via FK para inventory_counts

---

## 2. Hooks React Query

### src/hooks/useLots.ts

```typescript
// Funcionalidades:
- useLots(productId?): Listar lotes
- useCreateLot(): Criar novo lote com atualizacao de custo medio
- useUpdateLot(): Atualizar lote
- useAdjustLotQuantity(): Ajustar quantidade
- useExpiringLots(daysAhead): Lotes proximos ao vencimento
- useExpiredLots(): Lotes ja vencidos
```

### src/hooks/useInventory.ts

```typescript
// Funcionalidades:
- useInventoryCounts(): Listar inventarios
- useInventoryCount(id): Detalhes com itens
- useCreateInventoryCount(): Criar novo inventario
- useStartInventoryCount(): Iniciar contagem (popula itens)
- useUpdateCountItem(): Atualizar item contado
- useCompleteInventoryCount(): Finalizar e aplicar ajustes
- useCancelInventoryCount(): Cancelar inventario
```

### src/hooks/useProductImport.ts

```typescript
// Funcionalidades:
- useParseCSV(): Parser de CSV
- useImportProducts(): Importar produtos
- useExportProducts(): Exportar para CSV
- useDownloadTemplate(): Baixar template
```

---

## 3. Componentes de UI

### src/components/stock/LotManager.tsx

Gerenciador de lotes para um produto:
- Lista de lotes com indicadores visuais de validade
- Formulario para adicionar novo lote
- Cores: verde (>30 dias), amarelo (15-30 dias), vermelho (<15 dias)
- Historico de movimentacoes por lote

### src/components/stock/ExpiryAlerts.tsx

Dashboard de produtos vencendo:
- Cards agrupados por urgencia
- Filtro por periodo (7, 15, 30, 60 dias)
- Acoes rapidas (bloquear lote)
- Badge de contagem por cor

### src/components/stock/InventoryWizard.tsx

Wizard de 4 passos para inventario:
1. Criar inventario (nome, filtros)
2. Contagem (busca/scanner, input de quantidade)
3. Revisao (diferencas destacadas, motivos)
4. Confirmacao (resumo, aplicar ajustes)

### src/components/stock/InventoryCountItem.tsx

Card de item na contagem:
- Produto com codigo e nome
- Quantidade esperada (do sistema)
- Input para quantidade contada
- Diferenca calculada automaticamente
- Campo de motivo (obrigatorio se diferenca != 0)

### src/components/import/ProductImporter.tsx

Modal de importacao:
- Drag & drop ou seletor de arquivo
- Preview dos dados parseados
- Mapeamento de colunas
- Validacao visual (erros destacados em vermelho)
- Opcoes: criar novos / atualizar existentes / ignorar duplicados
- Barra de progresso

### src/components/import/ProductExporter.tsx

Modal de exportacao:
- Selecao de campos para exportar
- Filtros (categoria, status ativo)
- Formato: CSV
- Download automatico

---

## 4. Nova Pagina: Inventario

### src/pages/Inventory.tsx

Pagina dedicada para gestao de inventarios:
- Listagem com status (badge colorido)
- Botao "Novo Inventario"
- Continuar inventario em andamento
- Historico de inventarios finalizados
- Estatisticas (total ajustado, valor)

---

## 5. Modificacoes em Stock.tsx

### Novas Abas

```typescript
<TabsList>
  <TabsTrigger value="low-stock">Estoque Baixo</TabsTrigger>
  <TabsTrigger value="movements">Movimentacoes</TabsTrigger>
  <TabsTrigger value="expiring">Vencendo</TabsTrigger>  // NOVA
  <TabsTrigger value="lots">Lotes</TabsTrigger>          // NOVA
</TabsList>
```

### Melhorias

- Card de alerta para produtos vencendo no topo
- Filtro de lotes por produto
- Badge indicando produtos com controle de lote

---

## 6. Modificacoes em Products.tsx

### Novos Campos no Formulario

```typescript
// Adicionar ao formulario de criacao/edicao:
- Toggle "Controla Lote" (controls_lot)
- Preco Atacado (wholesale_price)
- Quantidade Minima Atacado (wholesale_min_qty)
- Custo Medio Ponderado (readonly, apenas exibicao)
```

### Botoes de Importacao/Exportacao

```typescript
// Adicionar no header:
<Button onClick={() => setImportDialogOpen(true)}>
  <Upload /> Importar
</Button>
<Button onClick={() => setExportDialogOpen(true)}>
  <Download /> Exportar
</Button>
```

---

## 7. Estrutura de Arquivos

```text
src/
├── hooks/
│   ├── useLots.ts              # NOVO
│   ├── useInventory.ts         # NOVO
│   └── useProductImport.ts     # NOVO
├── components/
│   ├── stock/
│   │   ├── LotManager.tsx      # NOVO
│   │   ├── ExpiryAlerts.tsx    # NOVO
│   │   ├── InventoryWizard.tsx # NOVO
│   │   └── InventoryCountItem.tsx # NOVO
│   └── import/
│       ├── ProductImporter.tsx # NOVO
│       └── ProductExporter.tsx # NOVO
├── pages/
│   ├── Stock.tsx               # MODIFICAR
│   ├── Products.tsx            # MODIFICAR
│   └── Inventory.tsx           # NOVO
└── lib/
    ├── validations.ts          # MODIFICAR
    └── csv-utils.ts            # NOVO

supabase/
└── migrations/
    └── [timestamp]_advanced_stock.sql  # NOVO
```

---

## 8. Detalhes Tecnicos

### Interfaces Principais

```typescript
interface ProductLot {
  id: string;
  tenant_id: string;
  product_id: string;
  lot_number: string;
  manufacture_date: string | null;
  expiry_date: string | null;
  quantity: number;
  cost_price: number | null;
  status: "active" | "expired" | "blocked";
  supplier_info: string | null;
  notes: string | null;
  created_at: string;
  product?: { name: string; unit: string };
}

interface InventoryCount {
  id: string;
  tenant_id: string;
  name: string;
  status: "draft" | "in_progress" | "completed" | "cancelled";
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  completed_by: string | null;
  total_products: number;
  total_difference_value: number;
  notes: string | null;
  created_at: string;
  items?: InventoryCountItem[];
}

interface InventoryCountItem {
  id: string;
  count_id: string;
  product_id: string;
  expected_quantity: number;
  counted_quantity: number | null;
  difference: number | null;
  difference_value: number | null;
  adjustment_reason: string | null;
  counted_by: string | null;
  counted_at: string | null;
  product?: { name: string; unit: string; cost_price: number; barcode: string };
}
```

### Custo Medio Ponderado

Formula aplicada ao registrar entrada com lote:

```
Novo CMP = (Estoque Atual × CMP Atual + Qtd Entrada × Custo Entrada) 
           / (Estoque Atual + Qtd Entrada)
```

### Validacoes de Lote

- Numero do lote unico por produto/tenant
- Data de validade nao pode ser anterior a hoje ao criar
- Quantidade nao pode ser negativa
- Lotes zerados permanecem para historico

### Ajustes de Inventario

Ao completar inventario:
1. Calcular diferenca por item (contado - esperado)
2. Para cada diferenca:
   - Se positiva: criar `stock_movement` tipo `adjustment_plus`
   - Se negativa: criar `stock_movement` tipo `adjustment_minus`
3. Atualizar `stock_current` via RPC atomico
4. Exigir motivo obrigatorio para diferencas
5. Registrar usuario e timestamp

---

## 9. Fluxo do Inventario

```text
DRAFT ─────────────▶ IN_PROGRESS ─────────────▶ COMPLETED
  │                       │                        
  │  (criar)              │  (iniciar contagem)    │  (aplicar ajustes)
  │                       │                        
  │                       ▼                        
  │               ┌───────────────┐                
  │               │  CANCELLED    │                
  │               └───────────────┘                
  │                       ▲
  └───────────────────────┘
```

---

## 10. Ordem de Implementacao

1. **Migracao SQL** - Criar tabelas e funcoes
2. **Atualizar types.ts** - Regenerar tipos
3. **Hook useLots** - CRUD de lotes
4. **Componentes LotManager e ExpiryAlerts**
5. **Modificar Stock.tsx** - Novas abas
6. **Hook useInventory** - CRUD de inventarios
7. **Componentes de Inventario** - Wizard e itens
8. **Nova pagina Inventory.tsx**
9. **Hook useProductImport** - Parser e importacao
10. **Componentes Import/Export**
11. **Modificar Products.tsx** - Novos campos e botoes
12. **Atualizar App.tsx** - Rota /inventory
13. **Validacoes e testes**

---

## 11. Consideracoes de UX

- Cores claras para status de validade:
  - Verde: >30 dias ate vencer
  - Amarelo: 15-30 dias
  - Vermelho: <15 dias ou vencido
- Inventario pode ser pausado (status in_progress)
- Confirmacao dupla antes de aplicar ajustes
- Preview de dados antes de importar
- Template de importacao com exemplos
- Feedback visual durante processamento
- Indicador de produtos com controle de lote

---

## 12. Secao Tecnica Detalhada

### Migracao SQL Completa

A migracao incluira:
- Criacao das 3 tabelas novas com constraints
- Alteracao da tabela products (4 colunas)
- Funcao update_weighted_avg_cost
- Funcao get_expiring_products
- RLS policies para todas as tabelas
- Indices para performance (tenant_id, product_id, expiry_date)

### Atualizacao do useStock.ts

Adicionar hooks para:
- useCreateStockMovementWithLot(): Movimento vinculado a lote
- useStockMovementsByLot(lotId): Historico por lote

### CSV Utils

Utilitario para parse e geracao de CSV:
- parseCSV(): Converte string CSV para array de objetos
- generateCSV(): Converte array para string CSV
- downloadCSV(): Dispara download do arquivo
- Tratamento de encoding UTF-8

