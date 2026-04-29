
# Catálogo & Estoque robustos + Exportação Excel

## Objetivo
Tornar as telas **Produtos** e **Estoque** mais robustas, fáceis de usar e adicionar **exportação em Excel (.xlsx)** real (hoje só existe CSV) — em ambas as telas, com filtros aplicados e múltiplas abas.

---

## 1. Exportação em Excel (.xlsx) — núcleo

### Biblioteca
- Adicionar `xlsx` (SheetJS) — leve, sem dependências, funciona no browser.
- Criar utilitário `src/lib/xlsx-utils.ts` com:
  - `exportToXLSX(filename, sheets)` — aceita múltiplas abas
  - Cada aba: `{ name, columns: ExportColumn[], data }`
  - Formatação automática: moeda BRL, datas pt-BR, números com 2 casas
  - Largura de coluna automática (auto-fit)
  - Cabeçalho em negrito + cor de fundo laranja (cor primária da marca)

### Onde aparece
- **Produtos** (`/products`): botão "Exportar" passa a abrir um menu com 3 opções:
  - Exportar CSV (mantido)
  - **Exportar Excel (.xlsx)** (novo) — abas: `Produtos`, `Códigos de Barras`, `Resumo`
  - Imprimir / PDF
- **Estoque** (`/stock`): novo botão **"Exportar Excel"** no header, com abas:
  - `Posição de Estoque` (todos os produtos: nome, código, categoria, estoque atual, mín, unidade, custo, preço, valor em estoque)
  - `Estoque Baixo`
  - `Sem Estoque`
  - `Movimentações` (filtra pela aba "movimentações" — últimos 90 dias)
  - `Lotes & Validade` (lote, produto, qtd, validade, dias para vencer)
  - `Resumo` (KPIs: total produtos, valor em estoque, baixo/sem estoque, vencendo)

---

## 2. Catálogo (Produtos) — UX mais robusta

### Filtros e visualização
- Adicionar barra de filtros acima da lista:
  - Categoria (select com categorias existentes)
  - Status (Ativos / Inativos / Todos)
  - Estoque (Todos / Baixo / Sem estoque / Com estoque)
  - Faixa de preço (min/max opcional)
- Toggle de visualização **Lista ↔ Tabela compacta** (tabela densa para gerenciar muitos itens rapidamente)
- Indicador de quantos produtos estão sendo exibidos / total
- Botão "Limpar filtros"

### Seleção em massa
- Checkbox "Selecionar todos visíveis" no topo
- Ações em lote: **Ativar/Desativar**, **Imprimir etiquetas**, **Exportar selecionados**

### Pequenos ganhos
- Mostrar badge "Estoque baixo" / "Sem estoque" no card do produto
- Ordenação: nome, preço, estoque, criação (dropdown)

---

## 3. Estoque — UX mais robusta

### Filtros na aba Movimentações
- Período (presets: Hoje, 7 dias, 30 dias, customizado) usando `getPeriodPresets`
- Tipo de movimento (Compra / Venda / Ajuste +/- / Todos)
- Busca por produto

### Filtros na aba Estoque Baixo
- Toggle: Mostrar também "Sem estoque"
- Ordenar por: maior déficit, nome, categoria

### Aba "Posição de Estoque" (NOVA)
- Tabela com TODOS os produtos ativos: nome, categoria, estoque atual, mínimo, unidade, custo médio, valor em estoque, status (OK/Baixo/Zerado)
- Busca + filtro por categoria
- Esta aba é a base do export "Posição de Estoque"

### Lotes
- Filtros adicionais: "Apenas vencendo em 30 dias", "Apenas vencidos"
- Mostrar dias para vencer com cor (vermelho/amarelo/verde)

### Quick actions
- No card de produto com estoque baixo: botão "Repor" abre dialog de movimentação já pré-preenchido com sugestão de quantidade (`min_stock - stock_current`)

---

## 4. Componente reutilizável

Criar `src/components/export/ExcelExportButton.tsx`:
- Dropdown com ícone Excel
- Recebe função `getSheets()` para gerar abas dinamicamente (lazy — só roda no clique)
- Toast de sucesso com nome do arquivo gerado
- Loading state durante geração

---

## Arquivos afetados

**Novos:**
- `src/lib/xlsx-utils.ts` — engine de export Excel
- `src/components/export/ExcelExportButton.tsx` — botão reutilizável
- `src/components/products/ProductFilters.tsx` — filtros do catálogo
- `src/components/stock/StockPositionTab.tsx` — nova aba de posição

**Editados:**
- `src/pages/Products.tsx` — filtros, toggle vista, ações em lote, botão Excel
- `src/pages/Stock.tsx` — filtros nas abas, nova aba Posição, botão Excel, quick "Repor"
- `src/components/import/ProductExporter.tsx` — adicionar opção Excel além de CSV
- `package.json` — adicionar `xlsx`

**Não tocados:**
- Esquema do banco (sem migrations)
- Hooks de dados (`useProducts`, `useStock`, `useLots`) — só consumimos o que já existe
- Lógica fiscal e do PDV

---

## Detalhes técnicos

- `xlsx` (SheetJS Community) gera arquivos .xlsx 100% no browser, sem servidor
- Formato numérico via `cell.z = 'R$ #,##0.00'` para moeda, `'dd/mm/yyyy'` para datas
- Auto-fit de coluna calculado a partir do maior conteúdo (limitado a 50 chars)
- Cabeçalho estilizado: `s: { font: { bold: true }, fill: { fgColor: { rgb: "EA580C" } } }` (laranja da marca)
- Nome do arquivo: `produtos_2026-04-29.xlsx`, `estoque_completo_2026-04-29.xlsx`
- Tudo client-side, respeita RLS atual (só exporta o que o usuário já enxerga)

---

## Fora de escopo (deixar para depois se quiser)
- Importação de Excel (hoje só CSV) — pode virar Sprint separado
- Histórico de exports / agendamento
- Templates de Excel personalizáveis pelo cliente

Confirma que posso seguir com este plano?
