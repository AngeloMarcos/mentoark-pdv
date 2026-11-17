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
| `pdv_hml_web` | `nginx:1.27-alpine` | Frontend + `/auth/v1`, `/rest/v1`, `/storage/v1` | 48 MB |

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

## Publicar uma versão nova do frontend

```bash
git checkout <branch>
bash infra/homolog/deploy-frontend.sh
```

O script compila apontando para `https://homologpdv.mentoark.com.br`, falha
se o build ainda apontar para o Supabase Cloud e troca os arquivos de uma vez.

## Aplicar migrations novas

```bash
scp supabase/migrations/<arquivo>.sql root@147.93.9.172:/opt/pdv-homolog/migrations/
ssh root@147.93.9.172 'cd /opt/pdv-homolog && docker exec -i pdv_hml_db \
  psql -U postgres -d pdv -v ON_ERROR_STOP=1 -1 < migrations/<arquivo>.sql'
```

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
6. `docker compose up -d --build rest storage web` e publicar o frontend.

## Limitações

- **Sem e-mail**: contas novas já entram confirmadas; "esqueci a senha" não
  envia nada.
- **Sem Realtime**: Cozinha e Pedidos não atualizam sozinhos. O Postgres já
  está com `wal_level=logical`, então dá para adicionar sem reiniciar outros
  sistemas.
- **Banco começa vazio** e não tem backup automático.
- **Super admin**: nenhum. Para promover um usuário:
  `insert into public.system_users (user_id, role) select id, 'super_admin' from auth.users where email = '<email>';`
