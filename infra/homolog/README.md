# Homologação do PDV — homologpdv.mentoark.com.br

Ambiente de testes isolado na VPS `147.93.9.172`, em `/opt/pdv-homolog`.
A produção continua em `pdv.mentoark.com.br` (Lovable + Supabase Cloud) e
não é afetada por nada daqui.

## Contêineres

| Contêiner | Imagem | Função | Limite de memória |
| --- | --- | --- | --- |
| `pdv_hml_db` | `postgres:16-alpine` | Banco `pdv`, **dedicado** (não usa o Postgres do CRM) | 256 MB |
| `pdv_hml_auth` | `supabase/gotrue:v2.174.0` | Cadastro e login | 128 MB |
| `pdv_hml_rest` | `postgrest/postgrest:v12.2.8` | API REST com RLS | 96 MB |
| `pdv_hml_storage` | build de `infra/mini-storage` | Imagens de produto | 64 MB |
| `pdv_hml_fiscal` | build de `infra/fiscal-service` | Emissão NFC-e via Focus NFe (`/fiscal/v1`) | 96 MB |
| `pdv_hml_web` | `nginx:1.27-alpine` | Frontend + `/auth/v1`, `/rest/v1`, `/storage/v1`, `/fiscal/v1` | 48 MB |

Só o `pdv_hml_web` está na rede `proxy` (Traefik, HTTPS automático). O
restante fica na rede interna `pdv_hml_internal`. Volumes:
`pdv_hml_db_data` e `pdv_hml_storage_data`.

Postgres próprio porque os roles `anon`, `authenticated`, `service_role` e
`authenticator` são globais do cluster: no Postgres compartilhado eles se
misturariam com CRM, Hemoclinic e Evolution.

## Segredos

Ficam só em `/opt/pdv-homolog/.env` (permissão 600), gerados no próprio
servidor: `DB_PASSWORD`, `AUTHENTICATOR_PASSWORD`, `JWT_SECRET`, `ANON_KEY`,
`SERVICE_ROLE_KEY`. A `ANON_KEY` é pública (vai embutida no frontend); as
demais nunca saem do servidor.

## Estrutura no servidor

```
/opt/pdv-homolog/
├── docker-compose.yml
├── .env                 segredos (600)
├── migrations/          migrations aplicadas (a 20251214205815 tem patch manual)
├── scripts/
│   ├── migrate.sh       aplica só as migrations pendentes
│   ├── backup.sh        banco + imagens, retenção de 14 dias
│   ├── restore.sh       --check (teste em banco temporário) | --apply
│   └── health.sh        checagem ponta a ponta
├── backups/             pdv_*.dump, storage_*.tgz, backup.log (700)
├── sql/                 bootstrap inicial
├── mini-storage/
├── fiscal-service/      cópia de infra/fiscal-service
├── rollback/            cópias para desfazer mudanças (ver abaixo)
└── web/                 nginx.conf + html/ (frontend; o nginx monta web/ inteira)
```

## Publicar

Do seu computador, na raiz do repositório, no branch que quer testar:

```bash
bash infra/homolog/deploy.sh               # migrations novas + frontend
bash infra/homolog/deploy.sh --migrations  # só migrations
bash infra/homolog/deploy.sh --frontend    # só frontend
```

O script envia `supabase/migrations`, aplica só as pendentes (com backup
antes), compila o frontend apontando para a homologação, troca os arquivos e
roda o `health.sh` no fim. A troca do frontend **não reinicia** o
`pdv_hml_web` (medido: 314 consultas durante um deploy, 0 falhas).

O `deploy.sh` não sincroniza `infra/`. Mudou `docker-compose.yml`,
`web/nginx.conf`, `scripts/` ou `infra/fiscal-service/`? Copie com `scp` e
rode `docker compose up -d --build <serviço>`.

Pelo GitHub: o workflow **Deploy homologação** roda a cada push no branch
`homolog` e pode ser disparado manualmente na aba Actions. Precisa do secret
`HOMOLOG_SSH_KEY` no repositório.

## Migrations

O controle fica em `pdv_meta.schema_migrations` (nome do arquivo + data). Cada
migration roda numa transação junto com o seu registro: ou entra inteira, ou
nada muda. Uma migration já aplicada nunca é sobrescrita pelo deploy.

```bash
ssh root@147.93.9.172 /opt/pdv-homolog/scripts/migrate.sh --dry-run   # lista pendentes
```

## Backup e restauração

- Diário às 03h20 (cron do root), depois do backup do Postgres compartilhado
  (03h) e antes da limpeza Docker (04h). Log em `backups/backup.log`.
- Os backups ficam **no mesmo disco** da VPS: protegem contra erro humano e
  migration ruim, não contra perda do servidor.

```bash
# testar um backup sem mexer no banco real
/opt/pdv-homolog/scripts/restore.sh --check pdv_AAAAMMDD_HHMMSS.dump
# substituir o banco (faz backup do estado atual antes)
/opt/pdv-homolog/scripts/restore.sh --apply pdv_AAAAMMDD_HHMMSS.dump
```

## Saúde

```bash
ssh root@147.93.9.172 /opt/pdv-homolog/scripts/health.sh
```

Confere os 5 contêineres, o `/ready` do PostgREST, site, login, API, storage
pela URL pública e a idade do último backup. Os health checks do Docker usam
`127.0.0.1` (não `localhost`): dentro das imagens Alpine `localhost` resolve
para IPv6 e o nginx só escuta em IPv4. Health check falhando no `pdv_hml_web`
**tira o site do ar**, porque o Traefik ignora contêineres não saudáveis.

## Como foi montado (refazer do zero)

1. `docker compose up -d db` e aplicar `sql/00-bootstrap.sql` com
   `psql -v auth_pw="$AUTHENTICATOR_PASSWORD"`.
2. `docker compose up -d auth`: o GoTrue cria o schema `auth`.
3. Aplicar `sql/01-storage-realtime-stub.sql` (schema `storage` e
   publicação `supabase_realtime`, que as migrations referenciam).
4. Aplicar `supabase/migrations/*.sql` em ordem, cada um com `-1`. Antes,
   remover do `20251214205815_...sql` o `INSERT` do super admin com UUID fixo
   do Supabase Cloud.
5. Gerar `ANON_KEY`/`SERVICE_ROLE_KEY` (JWT HS256 com `role` anon /
   service_role, assinado com `JWT_SECRET`) e gravar no `.env`.
6. `docker compose up -d --build rest storage web`.
7. Registrar as migrations aplicadas em `pdv_meta.schema_migrations` (o `migrate.sh` cria a tabela) e publicar com `deploy.sh`.

## Emissão fiscal (instalada em 2026-11-17)

- Serviço `pdv_hml_fiscal`, rota `https://homologpdv.mentoark.com.br/fiscal/v1`.
- **`FOCUS_URL_PRODUCAO` aponta para `homologacao.focusnfe.com.br`**: mesmo
  com "Produção" escolhido na tela, a homologação nunca emite nota real.
- Migration `20261117120000_emissao_fiscal_real.sql` aplicada.
- Para desfazer: `/opt/pdv-homolog/rollback/pre-fiscal-20261117/rollback.sh`
  (arquivos e contêiner) ou `rollback.sh --com-banco` (também volta o banco
  para o backup `pdv_20261117_192836.dump`, apagando o que foi gravado depois).

## Limitações

- **Sem e-mail**: contas novas já entram confirmadas; "esqueci a senha" não
  envia nada.
- **Sem Realtime**: Cozinha e Pedidos não atualizam sozinhos. O Postgres já
  está com `wal_level=logical`, então dá para adicionar sem reiniciar outros
  sistemas.
- **Banco começa vazio.**
- **Super admin**: nenhum. Para promover um usuário:
  `insert into public.system_users (user_id, role) select id, 'super_admin' from auth.users where email = '<email>';`
