

# Sprint 5: Relatorios Essenciais

## Resumo Executivo

Este sprint implementa um sistema completo de relatorios gerenciais com analise de margem de lucro, ranking de produtos por varios criterios, exportacao para Excel/CSV e PDF, filtros avancados por periodo e categoria, e graficos interativos.

---

## Arquitetura da Solucao

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Central de Relatorios                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│   │   Vendas     │   │  Produtos    │   │ Financeiro   │       │
│   │  Detalhado   │   │  Ranking     │   │   DRE        │       │
│   └──────────────┘   └──────────────┘   └──────────────┘       │
│          │                  │                  │                │
│          ▼                  ▼                  ▼                │
│   ┌──────────────────────────────────────────────────┐         │
│   │              Filtros Avancados                    │         │
│   │   Periodo | Categoria | Pagamento | Vendedor     │         │
│   └──────────────────────────────────────────────────┘         │
│                           │                                     │
│   ┌──────────────────────────────────────────────────┐         │
│   │              Exportacao                           │         │
│   │          CSV  |  Excel  |  PDF                   │         │
│   └──────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Novos Hooks de Relatorios

### src/hooks/useReports.ts

```typescript
// Funcionalidades principais:
- useSalesDetailedReport(filters): Vendas detalhadas com itens
- useProductProfitReport(filters): Ranking por margem de lucro
- useProductRevenueReport(filters): Ranking por faturamento
- useProductQuantityReport(filters): Ranking por quantidade vendida
- useCategoryReport(filters): Vendas agrupadas por categoria
- usePaymentMethodReport(filters): Analise por forma de pagamento
- useDailyReport(filters): Resumo diario com comparativos
- useFinancialDRE(filters): Demonstrativo de resultado simplificado
```

### Interfaces de Filtros

```typescript
interface ReportFilters {
  startDate: Date;
  endDate: Date;
  category?: string;
  paymentMethod?: string;
  userId?: string;  // Vendedor
  limit?: number;   // Top N produtos
}

interface ProductProfitReport {
  product_id: string;
  product_name: string;
  category: string | null;
  quantity_sold: number;
  revenue: number;         // Receita total
  cost: number;            // Custo total (CMV)
  gross_profit: number;    // Lucro bruto
  profit_margin: number;   // Margem % = (receita - custo) / receita
}
```

---

## 2. Utilitarios de Exportacao

### src/lib/export-utils.ts

```typescript
// Exportacao CSV
- exportToCSV(data, columns, filename): Gera e baixa CSV
- formatCSVRow(row, columns): Formata linha com escape correto

// Exportacao PDF (usando jsPDF)
- exportToPDF(title, data, columns, options): Gera PDF
- addTableToPDF(doc, data, columns): Adiciona tabela ao PDF
- addSummaryToPDF(doc, summary): Adiciona resumo/totais

// Helpers de formatacao
- formatCurrency(value): Formata moeda BRL
- formatPercent(value): Formata percentual
- formatDate(date): Formata data pt-BR
```

### Nova Dependencia

```bash
npm install jspdf jspdf-autotable
# ou usar html2canvas para PDF mais simples
```

---

## 3. Componentes de UI

### src/components/reports/ReportFilters.tsx

Barra de filtros reutilizavel:
- Seletor de periodo com presets (Hoje, Esta Semana, Este Mes, Ultimo Mes, Personalizado)
- Filtro por categoria (dropdown)
- Filtro por forma de pagamento (dropdown)
- Botao de aplicar filtros
- Indicador de filtros ativos

### src/components/reports/DateRangePicker.tsx

Seletor de periodo avancado:
- Dois calendarios lado a lado
- Presets rapidos (7 dias, 30 dias, etc.)
- Validacao de range maximo

### src/components/reports/ExportButtons.tsx

Grupo de botoes de exportacao:
- Botao CSV (icone FileSpreadsheet)
- Botao PDF (icone FileText)
- Loading state durante geracao
- Desabilitado se sem dados

### src/components/reports/ReportTable.tsx

Tabela padronizada para relatorios:
- Headers fixos
- Ordenacao por coluna
- Paginacao client-side
- Totalizadores no footer
- Responsivo com scroll horizontal

### src/components/reports/ProfitMarginCard.tsx

Card de margem de lucro:
- Nome do produto
- Barra de progresso colorida (margem)
- Valores de receita, custo, lucro
- Indicador visual (verde >30%, amarelo 15-30%, vermelho <15%)

### src/components/reports/SummaryCards.tsx

Cards de resumo para topo dos relatorios:
- Total de vendas
- Ticket medio
- Lucro bruto total
- Margem media

---

## 4. Nova Pagina: Central de Relatorios

### src/pages/Reports.tsx

Pagina hub com acesso a todos os relatorios:

```text
┌─────────────────────────────────────────┐
│  Central de Relatorios                  │
├─────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Vendas  │ │Produtos │ │Financeiro│   │
│  │Detalhado│ │ Ranking │ │   DRE   │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Por      │ │ Por     │ │Fechamento│   │
│  │Categoria│ │Pagamento│ │  Caixa  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────┘
```

---

## 5. Modificacoes na Pagina SalesReport.tsx

### Melhorias

1. **Filtros avancados**: Adicionar filtro por categoria e forma de pagamento
2. **Presets de periodo**: Botoes rapidos (Hoje, Semana, Mes)
3. **Exportacao**: Botoes para CSV e PDF
4. **Graficos adicionais**: 
   - Grafico de pizza por forma de pagamento
   - Grafico de barras por categoria
5. **Margem de lucro**: Nova secao mostrando lucro e margem

### Novo Layout

```text
┌─────────────────────────────────────────┐
│  [Filtros Avancados]  [Exportar ▼]      │
├─────────────────────────────────────────┤
│  Cards: Total | Lucro | Margem | Ticket │
├─────────────────────────────────────────┤
│  Tabs: Resumo | Por Produto | Por Dia   │
└─────────────────────────────────────────┘
```

---

## 6. Estrutura de Arquivos

```text
src/
├── hooks/
│   └── useReports.ts              # NOVO
├── lib/
│   └── export-utils.ts            # NOVO
├── components/
│   └── reports/
│       ├── ReportFilters.tsx      # NOVO
│       ├── DateRangePicker.tsx    # NOVO
│       ├── ExportButtons.tsx      # NOVO
│       ├── ReportTable.tsx        # NOVO
│       ├── ProfitMarginCard.tsx   # NOVO
│       └── SummaryCards.tsx       # NOVO
├── pages/
│   ├── Reports.tsx                # NOVO (hub central)
│   └── SalesReport.tsx            # MODIFICAR
└── App.tsx                        # MODIFICAR (nova rota)
```

---

## 7. Detalhes Tecnicos

### Calculo de Margem de Lucro

```typescript
// Para cada produto vendido no periodo:
interface ProductSaleData {
  product_id: string;
  quantity: number;       // Soma de quantidades vendidas
  revenue: number;        // Soma de totais (sale_items.total)
  cost: number;           // Soma de (quantity * cost_price ou weighted_avg_cost)
}

// Calculo:
grossProfit = revenue - cost;
profitMargin = revenue > 0 ? ((grossProfit / revenue) * 100) : 0;
```

### Query para Ranking de Produtos

```typescript
// 1. Buscar vendas no periodo
const salesInRange = await supabase
  .from("sales")
  .select("id")
  .eq("tenant_id", tenantId)
  .gte("datetime", startDate)
  .lte("datetime", endDate);

// 2. Buscar itens das vendas com dados do produto
const saleItems = await supabase
  .from("sale_items")
  .select(`
    quantity,
    total,
    unit_price,
    product_id,
    products:product_id (
      name,
      category,
      cost_price,
      weighted_avg_cost
    )
  `)
  .in("sale_id", salesIds);

// 3. Agregar por produto e calcular margem
```

### Exportacao CSV

```typescript
function exportToCSV(data: any[], columns: Column[], filename: string) {
  const BOM = "\uFEFF";
  const headers = columns.map(c => c.label).join(";");
  const rows = data.map(row => 
    columns.map(c => formatCell(row[c.key], c.format)).join(";")
  );
  const content = [headers, ...rows].join("\n");
  
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  // Trigger download
}
```

### Exportacao PDF com jsPDF

```typescript
import { jsPDF } from "jspdf";
import "jspdf-autotable";

function exportToPDF(
  title: string, 
  data: any[], 
  columns: Column[],
  summary?: Summary
) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${formatDate(new Date())}`, 14, 30);
  
  // Table
  doc.autoTable({
    head: [columns.map(c => c.label)],
    body: data.map(row => columns.map(c => formatCell(row[c.key], c.format))),
    startY: 40,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [24, 95, 53] },
  });
  
  // Summary (se houver)
  if (summary) {
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.text(`Total: ${formatCurrency(summary.total)}`, 14, finalY);
  }
  
  doc.save(`${filename}.pdf`);
}
```

---

## 8. Relatorios Disponiveis

### 8.1 Vendas Detalhado

Colunas:
- Data/Hora
- Venda #
- Cliente
- Forma Pagamento
- Valor Bruto
- Desconto
- Valor Liquido

### 8.2 Ranking de Produtos (por Faturamento)

Colunas:
- Posicao
- Produto
- Categoria
- Qtd Vendida
- Faturamento
- % do Total

### 8.3 Ranking de Produtos (por Margem)

Colunas:
- Posicao
- Produto
- Categoria
- Faturamento
- Custo (CMV)
- Lucro Bruto
- Margem %

Cards de Alerta:
- Produtos com margem negativa
- Produtos com margem abaixo de 15%

### 8.4 Vendas por Categoria

Colunas:
- Categoria
- Qtd Produtos
- Qtd Vendas
- Faturamento
- % do Total

Grafico de pizza visual

### 8.5 Vendas por Forma de Pagamento

Colunas:
- Forma
- Qtd Vendas
- Valor Total
- % do Total

Grafico de barras horizontal

### 8.6 DRE Simplificado

```text
(+) Receita Bruta de Vendas
(-) Descontos Concedidos
(=) Receita Liquida
(-) Custo dos Produtos Vendidos (CMV)
(=) Lucro Bruto
(-) Despesas Operacionais
(=) Resultado Operacional
```

---

## 9. Presets de Periodo

```typescript
const periodPresets = [
  { label: "Hoje", getValue: () => ({ start: today, end: today }) },
  { label: "Ontem", getValue: () => ({ start: yesterday, end: yesterday }) },
  { label: "Esta Semana", getValue: () => ({ start: startOfWeek, end: today }) },
  { label: "Semana Passada", getValue: () => ({ start: lastWeekStart, end: lastWeekEnd }) },
  { label: "Este Mes", getValue: () => ({ start: startOfMonth, end: today }) },
  { label: "Mes Passado", getValue: () => ({ start: lastMonthStart, end: lastMonthEnd }) },
  { label: "Ultimos 30 dias", getValue: () => ({ start: subDays(today, 30), end: today }) },
  { label: "Ultimos 90 dias", getValue: () => ({ start: subDays(today, 90), end: today }) },
];
```

---

## 10. Consideracoes de UX

1. **Performance**: Limitar queries a 1000 registros maximo
2. **Loading states**: Skeleton durante carregamento de dados
3. **Empty states**: Mensagem amigavel quando nao houver dados
4. **Responsivo**: Tabelas com scroll horizontal em mobile
5. **Feedback de exportacao**: Toast de sucesso/erro
6. **Cores consistentes**: 
   - Verde para lucro/positivo
   - Vermelho para prejuizo/negativo
   - Amarelo para alertas

---

## 11. Ordem de Implementacao

1. **Instalar jsPDF** - Dependencia para PDF
2. **src/lib/export-utils.ts** - Utilitarios de exportacao
3. **src/hooks/useReports.ts** - Hooks de dados
4. **Componentes de UI** - ReportFilters, ExportButtons, etc.
5. **Modificar SalesReport.tsx** - Adicionar funcionalidades
6. **Nova pagina Reports.tsx** - Hub central de relatorios
7. **Atualizar App.tsx** - Nova rota /reports
8. **Atualizar navegacao** - Link no menu lateral
9. **Testes e ajustes** - Validar calculos e exportacoes

---

## 12. Estimativa

| Tarefa | Complexidade | Tempo |
|--------|-------------|-------|
| Instalar dependencias | Baixa | 10 min |
| export-utils.ts | Media | 2h |
| useReports.ts | Alta | 3h |
| Componentes reports/ | Media | 3h |
| Modificar SalesReport.tsx | Alta | 3h |
| Nova pagina Reports.tsx | Media | 2h |
| Graficos adicionais | Media | 2h |
| Testes e ajustes | Media | 2h |

**Total estimado: 17-19 horas**

---

## 13. Secao Tecnica: Implementacao PDF

### Instalacao

```bash
npm install jspdf jspdf-autotable @types/jspdf
```

### Estrutura do PDF

```typescript
// Configuracao do documento
const doc = new jsPDF({
  orientation: "portrait",  // ou "landscape" para tabelas largas
  unit: "mm",
  format: "a4",
});

// Adicionar logo (opcional)
// doc.addImage(logoBase64, "PNG", 14, 10, 30, 10);

// Titulo
doc.setFontSize(16);
doc.setFont("helvetica", "bold");
doc.text("Relatorio de Vendas", 14, 25);

// Subtitulo com periodo
doc.setFontSize(10);
doc.setFont("helvetica", "normal");
doc.text(`Periodo: ${formatDate(startDate)} a ${formatDate(endDate)}`, 14, 32);

// Tabela com autoTable
(doc as any).autoTable({
  head: [["Produto", "Qtd", "Faturamento", "Margem"]],
  body: data.map(row => [
    row.name,
    row.quantity.toString(),
    formatCurrency(row.revenue),
    formatPercent(row.margin),
  ]),
  startY: 40,
  theme: "striped",
  headStyles: { 
    fillColor: [24, 95, 53],  // Cor primaria
    textColor: 255,
  },
  alternateRowStyles: { fillColor: [245, 245, 245] },
  margin: { left: 14, right: 14 },
});

// Rodape com totais
const finalY = (doc as any).lastAutoTable.finalY + 10;
doc.setFont("helvetica", "bold");
doc.text(`Total Faturamento: ${formatCurrency(totalRevenue)}`, 14, finalY);
doc.text(`Lucro Bruto: ${formatCurrency(totalProfit)}`, 14, finalY + 7);

// Salvar
doc.save(`relatorio-vendas-${formatDate(new Date())}.pdf`);
```

---

## 14. Atualizacoes no Menu de Navegacao

Adicionar no AppLayout.tsx:

```typescript
const navLinks = [
  // ... existentes ...
  { to: "/reports", label: "Relatórios", icon: BarChart3 },
];
```

