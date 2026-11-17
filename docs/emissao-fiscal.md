# Emissão fiscal real (NFC-e via Focus NFe)

Como o PDV emite NFC-e de verdade, como colocar no ar e como implantar
cada comerciante novo.

## Como funciona

```
Caixa (navegador) ──JWT──▶ pdvapi/fiscal/v1 ──▶ pdv_fiscal ──token da empresa──▶ Focus NFe ──▶ SEFAZ
                                                    │
                                                    └──service_role──▶ PostgREST (fiscal_documents, fiscal_credentials)
```

- O navegador **nunca** vê os tokens da Focus nem monta a nota. Ele só
  manda `sale_id`. O serviço lê a venda **com o token do usuário** (a RLS
  garante que ele só enxerga a própria empresa) e grava o resultado com a
  service_role.
- `fiscal_credentials` não tem nenhuma policy para `anon`/`authenticated`.
  Só o serviço lê.
- Um trigger (`guard_real_fiscal_documents`) impede que qualquer requisição
  de usuário crie, altere ou apague documento com `provider ≠ 'simulado'`.
  Isso fecha o buraco de alguém gravar uma nota "autorizada" sem passar pela
  SEFAZ, ou "cancelar" uma nota só no banco.
- Uma nota real viva por venda (índice único). Clique duplo ou repetição da
  rede devolve a mesma nota.
- Sem resposta da Focus/SEFAZ, a nota fica `pendente` e o worker interno
  consulta e reenvia a cada minuto (até 30 tentativas). A `ref` na Focus é
  `nfce-<sale_id>`, então reenviar não duplica.
- A contingência offline da NFC-e é feita pela Focus. Quando acontece, a
  nota vem marcada `contingencia = true` e aparece com ícone na lista.

Status em `fiscal_documents.status`: `processando`, `pendente`,
`autorizado`, `rejeitado`, `denegado`, `cancelado` (+ `simulado` para o
modo de teste antigo). O motivo da SEFAZ fica em `mensagem_sefaz`.

## Homologação (VPS, já instalada)

Em `homologpdv.mentoark.com.br` o serviço já está no ar como
`pdv_hml_fiscal`, com as duas URLs da Focus apontando para homologação.
Estrutura, deploy e rollback: `infra/homolog/README.md`. Atualizar o serviço:
copiar `infra/fiscal-service/` para `/opt/pdv-homolog/fiscal-service/` e
`docker compose up -d --build fiscal`.

## Colocar no ar (uma vez)

> As instruções abaixo são para a instalação antiga em `/opt/pdv-backend`,
> que **não existe mais** na VPS. A produção hoje roda no Lovable + Supabase
> Cloud; ver a decisão pendente sobre onde o serviço fiscal de produção vai rodar.

Na VPS, em `/opt/pdv-backend/` (mesmo lugar do `docker-compose.yml` do backend):

1. Aplicar a migração:
   ```bash
   docker exec -i <container-postgres> psql -U mentoark -d pdv_prod \
     < supabase/migrations/20261117120000_emissao_fiscal_real.sql
   ```
2. Copiar `infra/fiscal-service/` e os novos `docker-compose.yml` e
   `gateway.conf` para `/opt/pdv-backend/`.
3. No `docker-compose.yml`, trocar `__JWT_SECRET__` e
   `__SERVICE_ROLE_KEY__` (os mesmos já usados por `auth`/`rest`).
4. Subir o serviço e recarregar o gateway:
   ```bash
   docker compose up -d --build fiscal
   docker compose restart gateway
   curl -s https://pdvapi.mentoark.com.br/fiscal/v1/health   # {"ok":true}
   ```
5. Rebuild do frontend (`/opt/pdv/prod`) com o código desta branch. Não
   precisa de variável nova: o app usa `<VITE_SUPABASE_URL>/fiscal/v1`.
   Para apontar para outro lugar, use `VITE_FISCAL_API_URL`.

Uso de memória do serviço: limite de 96 MB, normalmente bem menos.

## Implantar um comerciante novo (checklist)

Isto é o que a taxa de implantação paga.

1. **Pré-requisitos do cliente:** CNPJ com Inscrição Estadual ativa,
   certificado digital **A1** (.pfx + senha) e credenciamento para NFC-e na
   SEFAZ-SP, com o **CSC** (ID + código) gerado no portal da Sefaz.
2. **Focus NFe:** no painel (Empresas → Adicionar), cadastrar o CNPJ,
   endereço, regime, certificado A1 + senha, habilitar NFC-e, informar o CSC
   de homologação e de produção, série e próximo número. Copiar os tokens de
   **homologação** e **produção** da empresa.
3. **PDV → Fiscal → Configuração:**
   - Provedor de emissão: **Focus NFe**
   - CNPJ, IE, CRT, UF, município
   - CFOP/CSOSN/CST PIS-COFINS padrão (**validar com o contador**)
   - Ambiente: **Homologação**
   - Colar os dois tokens em "Credenciais Focus NFe" e salvar
   - Ligar "Emitir NFC-e"
4. **Cadastro de produtos:** todo produto vendido precisa de NCM válido (8
   dígitos). Sem isso o serviço recusa a emissão antes de chegar à SEFAZ e diz
   quais produtos corrigir. CFOP/CSOSN por produto quando houver substituição
   tributária (ex.: bebidas: CFOP 5405, CSOSN 500).
5. **Teste em homologação:** fazer 3 vendas (dinheiro, PIX, cartão),
   conferir que aparecem como **Autorizado** em Fiscal → Documentos, abrir o
   DANFE oficial, cancelar uma.
6. **Virar para produção:** trocar o Ambiente para **Produção**, fazer uma
   venda real de valor baixo e conferir pela chave no portal da SEFAZ.

## Mapeamento de pagamentos (tPag)

| Tipo no PDV (`payment_methods.type`) | Código SEFAZ |
|---|---|
| money | 01 Dinheiro |
| check | 02 Cheque |
| card_credit | 03 Cartão de crédito (não integrado) |
| card_debit | 04 Cartão de débito (não integrado) |
| credit | 05 Crédito loja |
| voucher | 10 Vale alimentação |
| pix | 17 PIX (não integrado) |

Desconto dado no total da venda é rateado entre os itens (a SEFAZ exige que
a soma dos descontos dos itens feche com o desconto da nota).

## Testes

```bash
npm run test:fiscal   # montagem do JSON da NFC-e e leitura das respostas da Focus
```

## Pendências conhecidas (próximas fases)

- **Validar em homologação real.** Os nomes de campo seguem os exemplos
  públicos da Focus, mas a primeira nota em homologação é o teste
  definitivo, sobretudo `tipo_integracao`, `troco` e o retorno de
  cancelamento.
- **IBS/CBS na nota real:** o PDV calcula e mostra, mas ainda não manda os
  grupos da reforma para a Focus. Ligar quando a Focus documentar os campos
  para NFC-e no layout RTC.
- Lei da Transparência (valor aproximado de tributos por item/IBPT).
- Envio do DANFE/XML por WhatsApp (Evolution) e e-mail.
- XML do mês para o contador; aviso de vencimento do certificado A1.
- Cadastro da empresa na Focus via API (hoje é pelo painel).
- Tela de inutilização de numeração (a rota `POST /nfce/inutilizar` já existe).
