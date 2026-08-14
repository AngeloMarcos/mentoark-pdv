# Backend auto-hospedado (sem Lovable Cloud / Supabase Cloud)

Este diretório documenta o backend Supabase mínimo rodando na VPS
(`147.93.9.172`, mesma máquina do CRM), em `/opt/pdv-backend/`. Ele
substitui o Supabase Cloud do projeto `zqoilpiwgsvxsvrylvpm` mantendo o
frontend (`src/integrations/supabase/client.ts`) sem nenhuma alteração —
o app continua falando com uma API no formato Supabase normal
(`/auth/v1/*`, `/rest/v1/*`), só que auto-hospedada.

## Peças

| Serviço | Imagem | Função |
|---|---|---|
| `postgres` | `pgvector/pgvector:pg16` (já existia, compartilhado com CRM/n8n/evolution) | banco `pdv_prod`, schemas `public`/`auth` (storage não usa Postgres, ver abaixo) |
| `pdv_auth` | `supabase/gotrue:v2.174.0` | Auth (signup/login/refresh) |
| `pdv_rest` | `postgrest/postgrest:v12.2.8` | API REST sobre o Postgres (RLS) |
| `pdv_storage` | build próprio (`infra/mini-storage`) | upload/download de arquivos (imagens de produto) |
| `pdv_gateway` | `nginx:alpine` | roteia `/auth/v1`, `/rest/v1` e `/storage/v1` pros serviços acima, um domínio só |
| `pdv_prod` | build próprio (`/opt/pdv/prod/Dockerfile`) | o frontend (Vite build + nginx) |

**Deliberadamente fora do primeiro corte** (VPS com 1 vCPU / ~3.8GB RAM
compartilhado com outros clientes — ver "Pendente" abaixo):
- **Realtime** — Cozinha/Pedidos não recebem atualização automática por
  websocket; a tela ainda funciona, só não atualiza sozinha até alguém
  navegar/atualizar. Agendado pra uma janela de madrugada (exige
  `wal_level = logical` no Postgres compartilhado, que reinicia o
  container pra CRM/n8n/evolution também).
- **Kong/Envoy** (gateway oficial do Supabase) — trocado por um nginx
  simples só roteando por prefixo de path. Mais leve, sem validação de
  `apikey` (a segurança real é a RLS, que continua 100% ativa).

## Storage: por que um serviço próprio em vez de `supabase/storage-api`

Tentei o `supabase/storage-api` oficial (testei v1.60.4 e v1.11.13) com
backend `file` local. Autenticação e RLS funcionaram, mas o upload
sempre falhava com `ENOENT` tentando `stat` um arquivo temporário que
nunca foi escrito — bug reproduzível em ambas as versões, com corpo raw
e com `multipart/form-data`. Não valia a pena continuar investigando às
cegas uma dependência de terceiro numa VPS já apertada de recursos.

Troquei por `infra/mini-storage/server.js`: ~200 linhas de Node puro
(zero dependências, imagem final pequena) que implementa só o
subconjunto do protocolo REST do Supabase Storage que o app usa
(`src/hooks/useProductImages.ts`, via `@supabase/storage-js`):

- `POST /object/:bucket/*path` — upload (valida JWT, tipo MIME por
  bucket, tamanho máximo, e que o usuário pertence ao tenant que é o
  primeiro segmento do path — consulta `tenant_users` via PostgREST
  com o próprio token do usuário, reaproveitando a RLS já existente).
- `POST /object/sign/:bucket/*path` — como todo bucket aqui é público,
  só devolve o caminho público mesmo (sem geração de token real).
- `DELETE /object/:bucket` — remove por prefixo, mesma checagem de
  tenant do upload.
- `GET /object/public/:bucket/*path` — serve o arquivo do disco.

Arquivos ficam em `/data` (volume `storage_data`), fora do Postgres.
Testado ponta a ponta pela URL pública: upload, download público, URL
assinada, upload de tipo não permitido (rejeitado), upload sem token
(rejeitado), upload de um tenant tentando gravar no path de outro
(rejeitado com 403), e delete.

Buckets/regras ficam no topo de `server.js` (`BUCKETS`) — hoje só
`product-images` (só imagem, até 8MB). Adicionar um bucket novo é
adicionar uma entrada ali.

## Excel (import/export de produtos) — já funciona, sem precisar de Storage

`src/lib/xlsx-utils.ts` gera/lê os `.xlsx` inteiramente no navegador
(biblioteca `xlsx`), sem passar pelo backend. Não precisa de nenhuma
mudança de infra pra isso continuar funcionando no ambiente novo.

## Refazer do zero (outro ambiente/projeto)

1. `00-bootstrap.sql` — cria roles (`anon`, `authenticated`,
   `service_role`, `authenticator`, `postgres`) e as funções
   `auth.uid()/role()/email()` que toda RLS do projeto usa. Troque
   `__AUTHENTICATOR_PASSWORD__` e o nome do superusuário (`mentoark`)
   pelo do seu Postgres.
2. Suba só o serviço `auth` (GoTrue) do `docker-compose.yml` — na
   primeira subida ele roda as próprias migrations internas e cria
   `auth.users` e o resto do schema `auth.*`. Sem isso, as migrations do
   app abaixo falham (várias tabelas têm FK pra `auth.users`).
3. Aplicar `supabase/migrations/*.sql` em ordem (nome do arquivo =
   timestamp). Uma exceção manual, específica do histórico deste
   projeto: `20251214205815_...sql` tem um `INSERT` com um UUID fixo de
   usuário do Supabase Cloud original — pule esse último `INSERT`
   (linhas 138-141), não existe esse usuário num banco novo. Nada mais
   deveria falhar; se aparecer erro de função/schema faltando, é algo do
   Supabase Cloud que este bootstrap ainda não replica (avise antes de
   improvisar mais um stub).
4. Gerar `JWT_SECRET` + `ANON_KEY`/`SERVICE_ROLE_KEY` (JWT HS256 com
   `role: anon` / `role: service_role`) e substituir no
   `docker-compose.yml` e no `.env` do frontend.
5. Subir `rest`, `storage` e `gateway`.
6. No frontend (`/opt/pdv/prod/.env` e `.env.production`):
   `VITE_SUPABASE_URL=https://<domínio-do-gateway>`,
   `VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>`. Rebuildar a imagem
   (`docker compose build --no-cache`) — variável `VITE_*` é embutida no
   build, não é lida em runtime.

## Pendente / decisões em aberto

- **Dados reais**: este banco começa **vazio**. Nenhum dado da Estação
  Bar foi migrado ainda (adiado a pedido do cliente até o sistema estar
  redondo) — o Lovable Cloud não expõe connection string direta nem
  service role key, só dá pra puxar via API REST autenticada (lento,
  não pega `auth.users`) ou via export manual do painel (Cloud →
  Advanced settings → Export data).
- **Realtime**: adicionar quando combinado (janela de madrugada — exige
  `wal_level = logical` no Postgres compartilhado, que reinicia o
  container pra CRM/n8n/evolution também).
