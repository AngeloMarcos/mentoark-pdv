
# Revisao do Controle de Estoque: Erros e Melhorias

## Problemas Identificados

### 1. Problema de Transacao Nao-Atomica (CRITICO)
**Arquivo:** `src/hooks/useStock.ts` (linhas 82-110)

A criacao de movimentacao e atualizacao de estoque sao operacoes separadas. Se o RPC falhar apos inserir a movimentacao, teremos dados inconsistentes.

```text
FLUXO ATUAL (PROBLEMA):
┌─────────────────┐    ┌─────────────────┐
│ INSERT movimento │ -> │ RPC estoque     │
│    (sucesso)    │    │    (falha!)     │
└─────────────────┘    └─────────────────┘
       ↓                       ↓
  Movimentacao         Estoque nao
  registrada           atualizado
     = INCONSISTENCIA
```

**Solucao:** Usar transacao database ou rollback manual.

### 2. Falta de Tratamento de Estoque Negativo
**Arquivo:** `src/hooks/useStock.ts`

A funcao `decrement_stock` no banco permite estoque negativo. Deveria haver validacao antes de permitir ajustes negativos.

### 3. Estado do Formulario Nao Resetado em Erro
**Arquivo:** `src/pages/Stock.tsx` (linha 41)

Se `createMovement.mutateAsync` falhar, o dialogo fecha mas o formulario nao e resetado corretamente.

### 4. Falta Feedback Visual de Carregamento no Botao
**Arquivo:** `src/pages/Stock.tsx` (linha 69)

O botao "Nova Movimentacao" nao mostra estado de loading dos produtos sendo carregados.

### 5. Produtos Inativos Aparecem na Lista
**Arquivo:** `src/pages/Stock.tsx` (linha 124)

A query `useProducts()` retorna todos os produtos, incluindo inativos, no select de movimentacao.

### 6. Falta Data/Hora nas Movimentacoes
**Arquivo:** `src/pages/Stock.tsx` (linhas 103-110)

Nao exibe quando a movimentacao foi realizada.

### 7. Sem Paginacao ou Scroll Virtual
**Arquivo:** `src/pages/Stock.tsx` (linha 102)

Usa `slice(0, 50)` hardcoded. Com muitas movimentacoes, nao ha como ver o historico completo.

### 8. Falta Filtros nas Movimentacoes
Nao e possivel filtrar por tipo, produto ou periodo.

### 9. Card de Resumo sem Icone
**Arquivo:** `src/pages/Stock.tsx` (linha 61)

O card "Valor em Estoque" nao tem icone, diferente dos outros.

### 10. Mensagem Vazia quando Nao Ha Movimentacoes
Nao ha estado vazio para a aba de movimentacoes.

---

## Plano de Melhorias

### Fase 1: Correcoes Criticas

#### 1.1 Tratamento de Erro com Rollback
Modificar `useCreateStockMovement` para deletar a movimentacao se o RPC falhar.

```typescript
// Pseudo-codigo
try {
  const movement = await insertMovement();
  try {
    await updateStock();
  } catch (stockError) {
    await deleteMovement(movement.id); // Rollback
    throw stockError;
  }
} catch (error) {
  throw error;
}
```

#### 1.2 Validacao de Estoque Negativo
Adicionar verificacao antes de ajustes negativos:
- Buscar estoque atual do produto
- Verificar se quantidade disponivel e suficiente
- Exibir erro amigavel se nao for possivel

### Fase 2: Melhorias de UX

#### 2.1 Filtrar Produtos Ativos no Select
Modificar a query para buscar apenas produtos ativos na selecao.

#### 2.2 Adicionar Data/Hora nas Movimentacoes
Exibir timestamp formatado em cada card de movimentacao.

#### 2.3 Adicionar Icone no Card de Valor
Incluir icone de moeda/dinheiro no card "Valor em Estoque".

#### 2.4 Estado Vazio para Movimentacoes
Adicionar mensagem quando nao ha movimentacoes registradas.

#### 2.5 Reset do Formulario Correto
Garantir que o formulario so e resetado apos sucesso.

### Fase 3: Funcionalidades Adicionais

#### 3.1 Filtros de Movimentacoes
Adicionar filtros por:
- Tipo de movimentacao (compra, ajuste+, ajuste-)
- Produto especifico
- Periodo (data inicial/final)

#### 3.2 Botao "Carregar Mais"
Substituir slice fixo por paginacao real.

#### 3.3 Validacao de Estoque Minimo ao Negativo
Alertar usuario se ajuste negativo deixar estoque abaixo do minimo.

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/hooks/useStock.ts` | Rollback, validacao estoque negativo, invalidar stock summary |
| `src/pages/Stock.tsx` | UX, filtros, data/hora, estados vazios |
| `src/lib/validations.ts` | (opcional) Schema para validacao de estoque |

---

## Detalhes Tecnicos

### Modificacoes em useStock.ts

```typescript
// 1. Adicionar query para buscar estoque atual
const checkAvailableStock = async (productId: string) => {
  const { data } = await supabase
    .from('products')
    .select('stock_current')
    .eq('id', productId)
    .single();
  return data?.stock_current ?? 0;
};

// 2. Rollback em caso de falha
mutationFn: async (input) => {
  // ... validacao
  
  // Verificar estoque para ajustes negativos
  if (input.movement_type === 'adjustment_minus') {
    const currentStock = await checkAvailableStock(input.product_id);
    if (currentStock < input.quantity) {
      throw new Error(`Estoque insuficiente. Disponivel: ${currentStock}`);
    }
  }
  
  // Criar movimentacao
  const { data: movement, error } = await supabase
    .from('stock_movements')
    .insert({ ... })
    .select()
    .single();
  
  if (error) throw error;
  
  // Tentar atualizar estoque
  try {
    if (quantityDelta > 0) {
      await supabase.rpc('increment_stock', { ... });
    } else {
      await supabase.rpc('decrement_stock', { ... });
    }
  } catch (stockError) {
    // ROLLBACK: Deletar movimentacao criada
    await supabase
      .from('stock_movements')
      .delete()
      .eq('id', movement.id);
    throw stockError;
  }
  
  return movement;
}

// 3. Invalidar tambem o resumo de estoque
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
  queryClient.invalidateQueries({ queryKey: ['stock', 'summary'] });
  queryClient.invalidateQueries({ queryKey: ['products'] });
  toast.success('Movimentacao registrada com sucesso!');
}
```

### Modificacoes em Stock.tsx

```typescript
// 1. Buscar apenas produtos ativos
const { data: products = [] } = useProducts();
const activeProducts = products.filter(p => p.active);

// 2. Adicionar formatacao de data
const formatDate = (dateStr: string) => 
  new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

// 3. Estado vazio para movimentacoes
{movements.length === 0 ? (
  <Card>
    <CardContent className="py-8 text-center text-muted-foreground">
      Nenhuma movimentacao registrada
    </CardContent>
  </Card>
) : ( ... )}

// 4. Adicionar data na exibicao
<div className="text-xs text-muted-foreground">
  {formatDate(m.created_at)}
</div>
```

---

## Prioridade de Implementacao

1. **Alta**: Rollback de transacao (evita dados inconsistentes)
2. **Alta**: Validacao de estoque negativo (evita erros de negocio)
3. **Media**: UX melhorias (icone, data, estados vazios)
4. **Media**: Filtrar produtos ativos
5. **Baixa**: Filtros avancados e paginacao
