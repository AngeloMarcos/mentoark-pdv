# Corrigir edição de produto: campo perde o foco ao digitar/apagar

## Diagnóstico (confirmado no código)

O problema é de front-end, não de banco. Em `src/components/products/ProductFormDialog.tsx` o componente `Section` está declarado **dentro** da função do formulário (linha 243). A cada tecla digitada o estado muda, o React cria um novo tipo de componente `Section` e desmonta/remonta todos os campos dentro dele. Resultado: o cursor sai do campo (a "seleção" some) e o texto parece bugar — principalmente ao apagar, quando o valor precisa ser reconstruído.

Dois efeitos secundários encontrados no mesmo fluxo:

- **Preço de Venda não pode ser apagado**: ao limpar o campo o valor vira `0`, que é reexibido como `0,00` e joga o cursor para o fim (`ProductFormDialog` linha 358 + `CurrencyInput`).
- **Preço de Custo / Atacado**: o cursor sempre pula para o fim porque o valor é reformatado a cada tecla; ao apagar tudo o campo se reformata em vez de ficar vazio.

## O que será feito

1. Mover `Section` para fora do componente (declaração de módulo), eliminando a remontagem a cada tecla. Mesmo tratamento para qualquer outro componente declarado inline no arquivo.
2. Em `CurrencyInput`, manter um rascunho local enquanto o campo está em foco (igual ao `QuantityInput`), para que apagar deixe o campo realmente vazio e o cursor permaneça no lugar; o valor formatado é reaplicado no blur.
3. Permitir que "Preço de Venda" fique vazio durante a edição (guardar `null` no estado em vez de forçar `0`), mantendo a validação "preço deve ser maior que zero" no envio.
4. Remover a chamada de `pause()` executada durante a renderização em `FiscalProductTab` (efeito colateral em render), movendo-a para um `useEffect`, para o leitor de código de barras não interferir na digitação da aba Fiscal.

## Verificação

Abrir a edição de um produto real no preview, digitar e apagar em Nome, Preço de Custo, Preço de Venda e Estoque, confirmando que o foco e o cursor permanecem no campo e que os valores salvos continuam corretos.
