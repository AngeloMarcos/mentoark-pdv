# Reforma Tributária no MentoArk PDV (IBS, CBS e IS)

Este documento explica como configurar as alíquotas, como rodar os testes de
desempenho e como gerar e conferir o XML da NFC-e com os campos da reforma.

> **Aviso.** O sistema calcula e destaca os tributos, mas não substitui o
> contador. Enquadramento (CST, cClassTrib, reduções, IS) é decisão fiscal da
> empresa. O XML gerado hoje é do provedor **simulado**, sem validade fiscal.

## 1. O que a lei diz (resumo do que o sistema implementa)

| Tema | Regra | Fonte |
| --- | --- | --- |
| Tributos novos | CBS (federal), IBS (estadual + municipal) e IS (seletivo) | EC 132/2023, LC 214/2025 |
| 2026 | Ano-teste: CBS 0,9% + IBS 0,1%, apenas destacados no documento | LC 214/2025 |
| 2027 em diante | CBS com alíquota cheia, fim de PIS/Cofins, início do IS | LC 214/2025 |
| 2029 a 2032 | ICMS e ISS reduzidos gradualmente; IBS sobe na mesma proporção | EC 132/2023 |
| 2033 | ICMS e ISS extintos | EC 132/2023 |
| Base de cálculo | Valor da operação, **já sem os descontos incondicionais**; IBS e CBS não entram na própria base; o IS entra | LC 214/2025, art. 12 |
| Imposto Seletivo | Só para bens e serviços prejudiciais à saúde ou ao meio ambiente (fumo, bebidas alcoólicas e açucaradas, veículos, minerais...) | LC 214/2025 |
| ICMS-ST | Continua existindo enquanto houver ICMS (até 2032). IBS e CBS não têm substituição tributária nos moldes do ICMS | — |

Duas consequências práticas:

- **Desconto vem antes do imposto.** O motor reduz a base pelo desconto do item
  e só então aplica as alíquotas. Aplicar o desconto depois do IBS geraria base
  maior que a legal.
- **Combustíveis não pagam IS**: têm regime monofásico de IBS/CBS (CST 620).
  O IS é configurável por NCM ou categoria, então nada impede cadastrar outra
  regra, mas confirme com o contador antes.

## 2. Como configurar

### 2.1 Alíquotas da empresa

**Fiscal → Configuração → Reforma Tributária — IBS, CBS e IS**

| Campo | O que é |
| --- | --- |
| Calcular e destacar IBS/CBS | Liga tudo: tributos no PDV, grupos no XML e relatório. Desligado, o sistema se comporta como antes |
| CBS / IBS estadual / IBS municipal | Alíquotas em %. O botão "Usar alíquotas-teste de 2026" preenche 0,9 / 0,1 / 0 |
| Forma de cálculo | **Destaque informativo**: base = valor líquido do item, o total da venda não muda (2026). **Tributos incluídos no preço**: o preço de prateleira já contém os tributos e a base é extraída dele |
| Regras de IS | Uma linha por regra: descrição, critério (prefixo do NCM ou categoria), alíquota e ativa/inativa |

Fica gravado em `tenants.settings.fiscal.reforma` (JSON), sem migração de banco:

```json
{
  "enabled": true,
  "modo": "informativo",
  "cbs": 0.9,
  "ibs_uf": 0.1,
  "ibs_mun": 0,
  "is_rules": [
    { "id": "fumo", "label": "Cigarros", "match": "ncm_prefix", "value": "2402", "aliquota": 0, "active": false }
  ]
}
```

Quando as alíquotas de referência de 2027 forem publicadas, basta alterar os
três campos; não há valor fixo no código além do padrão de 2026.

### 2.2 Particularidades do produto

**Produtos → editar → aba Fiscal → Reforma Tributária**

| Campo | Padrão | Uso |
| --- | --- | --- |
| CST IBS/CBS | 000 (tributação integral) | 200 = alíquota reduzida, 400/410 = isenção/imunidade, 620 = monofásica |
| cClassTrib | 000001 | Código de 6 dígitos da tabela oficial de classificação tributária |
| Redução de alíquota (%) | 0 | 60 para regimes reduzidos, 100 para alíquota zero |
| Imposto Seletivo (%) | em branco | Em branco usa as regras gerais; zero isenta o produto; valor sobrepõe as regras |

Fica gravado em `products.extra_attributes.tax`. O NCM e o CSOSN continuam na
mesma aba; CSOSN **500** marca o produto como ICMS já recolhido por
substituição tributária (grupo `ICMSSN500` no XML).

### 2.3 ICMS-ST

O varejo normalmente é o **substituído** (CSOSN 500 / CST 60): o imposto veio
recolhido pelo fabricante e a nota só informa isso. Para o caso em que a loja é
a **substituta** (venda para revenda), `calcIcmsSt()` em
`src/lib/tax/engine.ts` calcula base com MVA e ST devida. Essa função ainda não
está ligada ao total cobrado no PDV.

## 3. Onde está o código

| Arquivo | Papel |
| --- | --- |
| `src/lib/tax/engine.ts` | Motor de cálculo puro (IBS, CBS, IS, relatório, ICMS-ST) |
| `src/workers/tax.worker.ts` | Web Worker que executa o motor fora do thread principal |
| `src/lib/tax/client.ts` | Cria o worker sob demanda; se não houver suporte, calcula direto |
| `src/hooks/useTaxes.ts` | `useTaxConfig`, `useCartTaxes`, `useTaxReport` |
| `src/lib/fiscal-utils.ts` | XML da NFC-e com os grupos `IS`, `IBSCBS`, `ISTot`, `IBSCBSTot` |
| `src/components/pdv/ProductVirtualList.tsx` | Lista de produtos com virtual scrolling |
| `src/components/fiscal/TaxReportTab.tsx` | Relatório diário/mensal com exportação CSV e Excel |

## 4. Testes

```bash
npm test            # unitários + desempenho
npm run test:perf   # só desempenho do motor
npm run typecheck
npm run lint:tax    # lint do módulo tributário e dos componentes novos
```

### 4.1 Desempenho do motor

`src/lib/tax/engine.perf.test.ts` mede a mediana de 15 execuções e falha se
passar do orçamento:

| Cenário | Orçamento |
| --- | --- |
| Carrinho de 100 itens | 5 ms |
| Carrinho de 1.000 itens | 50 ms |
| Relatório de 10.000 vendas (50.000 itens) | 2 s |

### 4.2 Desempenho no aparelho

1. `npm run build && npm run preview` e abra `/pdv` no aparelho de teste.
2. Android: conecte por USB e abra `chrome://inspect` no desktop. iPhone/iPad:
   Safari → Desenvolvedor.
3. Aba **Performance**, CPU throttling 4x ou 6x, grave enquanto digita na
   busca, rola a lista e adiciona itens.
4. Confira: nenhuma tarefa longa (> 50 ms) no thread principal durante a
   rolagem; o cálculo aparece na trilha **Worker** (`tax-worker`), não em
   **Main**.
5. Tempo da transação: marque do clique em "Pagamento" até a tela "Venda
   Finalizada". A meta é < 2 s; o que domina é a ida ao banco
   (`checkout_sale_transaction`), não o cálculo.

**Navegadores suportados.** O build mira ES2020. O navegador de fábrica do
Android 5 e o Safari do iOS 10 não executam esse código; um Android antigo
funciona se o Chrome estiver atualizado. Suportar esses navegadores exigiria
`@vitejs/plugin-legacy` e uma rodada de testes específica.

## 5. NFC-e: gerar e conferir

### 5.1 Gerar

1. Ligue **Emitir NFC-e** e **Calcular e destacar IBS/CBS** em Fiscal →
   Configuração.
2. Faça uma venda no PDV. O documento aparece em Fiscal → Documentos Fiscais;
   o XML fica em `fiscal_documents.xml_content`.

Com a reforma ligada, cada item recebe:

```xml
<IS>…</IS>                      <!-- só quando há Imposto Seletivo -->
<IBSCBS>
  <CST>000</CST>
  <cClassTrib>000001</cClassTrib>
  <gIBSCBS>
    <vBC>100.00</vBC>
    <gIBSUF><pIBSUF>0.1000</pIBSUF><vIBSUF>0.10</vIBSUF></gIBSUF>
    <gIBSMun><pIBSMun>0.0000</pIBSMun><vIBSMun>0.00</vIBSMun></gIBSMun>
    <vIBS>0.10</vIBS>
    <gCBS><pCBS>0.9000</pCBS><vCBS>0.90</vCBS></gCBS>
  </gIBSCBS>
</IBSCBS>
```

e o grupo `<total>` recebe `ISTot`, `IBSCBSTot` e `vNFTot`.

### 5.2 Conferir

- **Testes automáticos** (`src/lib/fiscal-utils.test.ts`): XML bem formado,
  ordem dos grupos, totais iguais à soma dos itens.
- **Contra o XSD oficial**: baixe o pacote de schemas vigente em
  <https://www.nfe.fazenda.gov.br> (Documentos → Esquemas XML) e rode:

  ```bash
  xmllint --noout --schema PL_010_V1/nfe_v4.00.xsd nota.xml
  ```

  O XML simulado **não passa** nessa validação completa: faltam assinatura
  digital, endereço do emitente e outros grupos obrigatórios que o provedor
  simulado nunca gerou. Os grupos da reforma seguem o leiaute da NT 2025.002,
  mas ainda não foram conferidos contra o XSD.
- **Emissão real**: é feita por um provedor (Focus NFe está previsto em
  `src/services/fiscal/FocusNfeProvider.ts`, ainda não implementado). O
  provedor monta, assina e valida o XML; o PDV só envia os dados, que já estão
  no payload (`items[].tax`, `items[].discount`, `reforma`).

## 6. Limitações conhecidas

- O relatório de tributos recalcula as vendas com as alíquotas e os cadastros
  **atuais**. Se uma alíquota mudar, o histórico muda junto. Para congelar o
  valor por venda é preciso gravar os tributos em `sale_items` (migração +
  ajuste na RPC `checkout_sale_transaction`).
- O modo "por fora" (tributos somados ao total) existe no motor, mas não é
  oferecido na tela porque o PDV ainda não soma tributos ao valor cobrado.
- Códigos de CST e cClassTrib do IS usam o padrão `000` / `000001`; ajuste por
  regra quando a tabela oficial do IS estiver fechada.
