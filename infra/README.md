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
| `postgres` | `pgvector/pgvector:pg16` (já existia, compartilhado com CRM/n8n/evolution) | banco `pdv_prod`, schemas `public`/`auth`/`storage` |
| `pdv_auth` | `supabase/gotrue:v2.174.0` | Auth (signup/login/refresh) |
| `pdv_rest` | `postgrest/postgrest:v12.2.8` | API REST sobre o Postgres (RLS) |
| `pdv_gateway` | `nginx:alpine` | roteia `/auth/v1` e `/rest/v1` pros dois acima, um domínio só |
| `pdv_prod` | build próprio (`/opt/pdv/prod/Dockerfile`) | o frontend (Vite build + nginx) |

**Deliberadamente fora do primeiro corte** (VPS com 1 vCPU / ~3.8GB RAM
compartilhado com outros clientes — ver "Pendente" abaixo):
- **Realtime** — Cozinha/Pedidos não recebem atualização automática por
  websocket; a tela ainda funciona, só não atualiza sozinha até alguém
  navegar/atualizar.
- **Storage de verdade** (upload de imagem de produto) — existe só um
  stub de schema (`01-storage-stub.sql`) pras RLS policies não quebrarem;
  o bucket `product-images` não aceita upload ainda.
- **Kong/Envoy** (gateway oficial do Supabase) — trocado por um nginx
  simples só roteando por prefixo de path. Mais leve, sem validação de
  `apikey` (a segurança real é a RLS, que continua 100% ativa).

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
3. `01-storage-stub.sql`.
4. Aplicar `supabase/migrations/*.sql` em ordem (nome do arquivo =
   timestamp). Duas exceções manuais, ambas específicas do histórico
   deste projeto:
   - `20251214205815_...sql` tem um `INSERT` com um UUID fixo de usuário
     do Supabase Cloud original — pule esse último `INSERT` (linhas
     138-141), não existe esse usuário num banco novo.
   - Nada mais deveria falhar; se aparecer erro de função/schema
     faltando, é algo do Supabase Cloud que este bootstrap ainda não
     replica (avise antes de improvisar mais um stub).
5. Gerar `JWT_SECRET` + `ANON_KEY`/`SERVICE_ROLE_KEY` (JWT HS256 com
   `role: anon` / `role: service_role`) e substituir no
   `docker-compose.yml` e no `.env` do frontend.
6. Subir `rest` e `gateway`.
7. No frontend (`/opt/pdv/prod/.env` e `.env.production`):
   `VITE_SUPABASE_URL=https://<domínio-do-gateway>`,
   `VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>`. Rebuildar a imagem
   (`docker compose build --no-cache`) — variável `VITE_*` é embutida no
   build, não é lida em runtime.

## Pendente / decisões em aberto

- **DNS**: `lojasys.mentoark.com.br` e `pdvapi.mentoark.com.br`
  ainda precisam apontar (A record) pra `147.93.9.172`. Sem isso o
  Traefik não consegue emitir certificado Let's Encrypt e ninguém de
  fora acessa. Confirmado via teste interno (`Host` header) que tudo
  funciona assim que o DNS resolver.
- **Dados reais**: este banco começa **vazio**. Nenhum dado da Estação
  Bar foi migrado — o Lovable Cloud não expõe connection string direta
  nem service role key, só dá pra puxar via API REST autenticada (lento,
  não pega `auth.users`) ou via export manual do painel. Decidir o
  caminho antes de apontar usuários reais pra cá.
- **Realtime/Storage**: adicionar depois se o uso real precisar (Cozinha
  ao vivo, upload de imagem de produto). Vai exigir mais RAM — checar
  `free -h` antes.
- **wal_level**: Realtime precisa de `wal_level = logical` no Postgres.
  Como esse Postgres é compartilhado com CRM/n8n/evolution, mudar isso
  exige reiniciar o container pra todo mundo — avisar antes.
