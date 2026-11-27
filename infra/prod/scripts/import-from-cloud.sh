#!/usr/bin/env bash
# Traz a produção do Supabase Cloud para a pilha /opt/pdv-prod.
#
#   import-from-cloud.sh dump      baixa tudo da Cloud para imports/<data>/ (não mexe na pilha)
#   import-from-cloud.sh restore   carrega o último dump na pilha (APAGA o banco pdv da pilha)
#   import-from-cloud.sh files     baixa as imagens de produto para o mini-storage
#   import-from-cloud.sh all       dump + restore + files + migrations novas
#
# Pode rodar quantas vezes quiser: um ensaio antes e a carga final na virada do DNS.
# Credenciais da Cloud em /opt/pdv-prod/.env.cloud (chmod 600), nunca no git:
#   CLOUD_DB_URL=postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres
#                (Supabase → Connect → "Session pooler": a conexão direta é só IPv6)
#   CLOUD_URL=https://<ref>.supabase.co
#   CLOUD_SERVICE_ROLE_KEY=<service_role key>      (só para baixar as imagens)
set -euo pipefail
source "$(dirname "$0")/env.sh"

[ -f "$ROOT/.env.cloud" ] || { echo "falta $ROOT/.env.cloud"; exit 1; }
cloud() { { grep -E "^$1=" "$ROOT/.env.cloud" || true; } | head -1 | cut -d= -f2-; }
CLOUD_DB_URL="$(cloud CLOUD_DB_URL)"
CLOUD_URL="$(cloud CLOUD_URL)"
CLOUD_KEY="$(cloud CLOUD_SERVICE_ROLE_KEY)"
PG_IMAGE="postgres:17-alpine"
# Rede do cliente: "host" para a Cloud; uma rede Docker para ensaiar com outro banco local.
NET="$(cloud CLOUD_DOCKER_NETWORK)"; NET="${NET:-host}"
IMPORTS="$ROOT/imports"
mkdir -p "$IMPORTS"; chmod 700 "$IMPORTS"

# Cliente Postgres descartável com a rede do host (o pooler da Supabase é IPv4).
cpsql() { docker run --rm -i --network "$NET" -e PGCONNECT_TIMEOUT=15 "$PG_IMAGE" psql "$CLOUD_DB_URL" -v ON_ERROR_STOP=1 -X -q "$@"; }
cdump() { docker run --rm -i --network "$NET" "$PG_IMAGE" pg_dump "$CLOUD_DB_URL" "$@"; }
lpsql() { docker exec -i "$DB_CT" psql -U postgres -d pdv -v ON_ERROR_STOP=1 -X -q "$@"; }

latest() { ls -1d "$IMPORTS"/*/ 2>/dev/null | sort | tail -1 | sed 's:/$::'; }

do_dump() {
  local out="$IMPORTS/$(date +%Y%m%d_%H%M%S)"
  mkdir -p "$out"; chmod 700 "$out"
  echo "> Cloud: $(cpsql -At -c 'show server_version')"

  echo "> schema public (estrutura + dados)"
  cdump --schema=public --no-owner --no-privileges --quote-all-identifiers > "$out/public.sql"

  echo "> usuários (auth.users, auth.identities)"
  cpsql -At -c "copy (select to_jsonb(u) from auth.users u) to stdout" > "$out/auth_users.jsonl"
  cpsql -At -c "copy (select to_jsonb(i) from auth.identities i) to stdout" > "$out/auth_identities.jsonl"

  echo "> triggers em auth.users (ex.: criar perfil no cadastro)"
  cpsql -At -c "select pg_get_triggerdef(t.oid) || ';' from pg_trigger t
                where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal" > "$out/auth_triggers.sql"

  echo "> migrations já aplicadas na Cloud"
  # Cloud: supabase_migrations; pilha nossa (ensaio com a homologação): pdv_meta. Guarda só o prefixo numérico.
  cpsql -At -c "select version from supabase_migrations.schema_migrations order by 1" > "$out/cloud_migrations.txt" 2>/dev/null \
    || cpsql -At -c "select split_part(version, '_', 1) from pdv_meta.schema_migrations order by 1" > "$out/cloud_migrations.txt"
  [ -s "$out/cloud_migrations.txt" ] || { echo "não achei a lista de migrations aplicadas na origem"; exit 1; }
  echo "  $(wc -l < "$out/cloud_migrations.txt") migrations na origem"

  echo "> lista de imagens"
  cpsql -At -c "copy (select name from storage.objects where bucket_id = 'product-images' order by name) to stdout" > "$out/storage_objects.txt"

  echo "> contagem de linhas (para conferir depois do restore)"
  cpsql -At -c "select format('%s %s', relname, n_live_tup) from pg_stat_user_tables where schemaname='public' order by relname" > "$out/counts_estimate.txt"
  cpsql -At -F ' ' -c "select 'auth.users', count(*) from auth.users union all select 'tenants', count(*) from public.tenants
                       union all select 'sales', count(*) from public.sales union all select 'products', count(*) from public.products" > "$out/counts.txt"

  echo "> extensões e papéis usados no dump (o restore precisa deles)"
  cpsql -At -c "select extname || ' ' || n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace order by 1" > "$out/extensions.txt"
  grep -oE 'TO "?[a-z_]+"?' "$out/public.sql" | sort | uniq -c > "$out/roles_in_policies.txt" || true

  chmod 600 "$out"/*
  echo "dump em $out"
  cat "$out/counts.txt"
  echo "imagens: $(wc -l < "$out/storage_objects.txt")"
}

do_restore() {
  local src; src="$(latest)"
  [ -n "$src" ] || { echo "nenhum dump em $IMPORTS"; exit 1; }
  echo "> restaurando $src em $DB_CT (o banco atual da pilha será substituído)"
  "$ROOT/scripts/backup.sh" > /dev/null || true

  cd "$ROOT"
  docker compose stop rest storage fiscal auth > /dev/null

  # 1. public do zero, com as extensões no schema "extensions" como na Cloud
  lpsql <<'SQL'
drop schema if exists public cascade;
create schema public;
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
alter database pdv set search_path = "$user", public, extensions;
grant usage on schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
SQL

  # 2. estrutura + dados do public (uma transação: ou entra tudo, ou nada)
  { echo 'set search_path = public, extensions;'; cat "$src/public.sql"; } | lpsql -1 > "$src/restore.log" 2>&1 \
    || { echo "FALHA no public.sql — ver $src/restore.log"; tail -20 "$src/restore.log"; docker compose start auth rest storage fiscal > /dev/null; exit 1; }

  # 3. usuários: só as colunas que existem nos dois lados (o GoTrue da Cloud pode ser mais novo)
  docker cp "$src/auth_users.jsonl" "$DB_CT:/tmp/auth_users.jsonl"
  docker cp "$src/auth_identities.jsonl" "$DB_CT:/tmp/auth_identities.jsonl"
  lpsql -1 <<'SQL'
create temp table _u (j jsonb);
create temp table _i (j jsonb);
\copy _u from '/tmp/auth_users.jsonl'
\copy _i from '/tmp/auth_identities.jsonl'
create or replace function pg_temp.load_auth(_table text, _src text) returns int language plpgsql as $$
declare cols text; n int;
begin
  execute format($f$
    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    from information_schema.columns c
    where c.table_schema = 'auth' and c.table_name = %L and c.is_generated = 'NEVER'
      and exists (select 1 from %I s where s.j ? c.column_name)$f$, _table, _src) into cols;
  execute format('truncate auth.%I cascade', _table);
  execute format('insert into auth.%I (%s) select %s from %I s, jsonb_populate_record(null::auth.%I, s.j) r',
                 _table, cols, regexp_replace(cols, '([^, ]+)', 'r.\1', 'g'), _src, _table);
  get diagnostics n = row_count;
  return n;
end $$;
select 'usuarios: ' || pg_temp.load_auth('users', '_u');
select 'identidades: ' || pg_temp.load_auth('identities', '_i');
SQL

  # 4. triggers em auth.users só agora (não disparam na importação)
  if [ -s "$src/auth_triggers.sql" ]; then
    sed -E 's/^CREATE TRIGGER/CREATE OR REPLACE TRIGGER/' "$src/auth_triggers.sql" | lpsql -1
  fi

  # 5. permissões padrão do Supabase e marca das migrations que a Cloud já tinha
  lpsql <<'SQL'
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
create schema if not exists pdv_meta;
create table if not exists pdv_meta.schema_migrations (version text primary key, applied_at timestamptz not null default now());
truncate pdv_meta.schema_migrations;
SQL
  local marked=0
  for f in "$ROOT"/migrations/*.sql; do
    local name; name="$(basename "$f")"
    if grep -qxF "${name%%_*}" "$src/cloud_migrations.txt"; then
      lpsql -c "insert into pdv_meta.schema_migrations(version) values ('$name')"
      marked=$((marked + 1))
    fi
  done
  echo "migrations já presentes na Cloud: $marked"

  # 6. links de imagem que apontavam para o storage da Cloud passam a apontar para cá
  lpsql -v site="$SITE_URL" <<'SQL'
select set_config('pdv.site', :'site', false);
update public.product_images
   set public_url = :'site' || '/storage/v1/object/public/product-images/' || storage_path
 where storage_path is not null;
do $$
declare r record; n int;
begin
  for r in select c.table_name, c.column_name from information_schema.columns c
           where c.table_schema = 'public' and c.data_type = 'text' and c.column_name ~ '(image|logo|avatar|photo|foto)_?url'
  loop
    execute format($f$update public.%I set %I = regexp_replace(%I,
        '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/(sign|public)/([^?]+).*$',
        %L || '/storage/v1/object/public/\2')
      where %I like 'https://%%.supabase.co/storage/%%'$f$,
      r.table_name, r.column_name, r.column_name, current_setting('pdv.site'), r.column_name);
    get diagnostics n = row_count;
    if n > 0 then raise notice '% links trocados em %.%', n, r.table_name, r.column_name; end if;
  end loop;
end $$;
SQL

  docker compose start auth rest storage fiscal > /dev/null
  echo "> conferência (Cloud no momento do dump × pilha agora)"
  cat "$src/counts.txt"
  lpsql -At -F ' ' -c "select 'auth.users', count(*) from auth.users union all select 'tenants', count(*) from public.tenants
                       union all select 'sales', count(*) from public.sales union all select 'products', count(*) from public.products"
}

do_files() {
  local src; src="$(latest)"
  [ -n "$CLOUD_KEY" ] || { echo "falta CLOUD_SERVICE_ROLE_KEY em .env.cloud"; exit 1; }
  local tmp; tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN
  local ok=0 fail=0
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    mkdir -p "$tmp/product-images/$(dirname "$name")"
    local enc; enc="$(jq -rn --arg s "$name" '$s | split("/") | map(@uri) | join("/")')"
    if curl -fsS -m 60 -H "Authorization: Bearer $CLOUD_KEY" -H "apikey: $CLOUD_KEY" \
         "$CLOUD_URL/storage/v1/object/product-images/$enc" -o "$tmp/product-images/$name"; then
      ok=$((ok + 1))
    else
      fail=$((fail + 1)); echo "falhou: $name"
    fi
  done < "$src/storage_objects.txt"
  tar -C "$tmp" -cf - product-images | docker exec -i "${P}_storage" tar -xf - -C /data
  echo "imagens copiadas: $ok, falhas: $fail"
}

case "${1:-}" in
  dump) do_dump ;;
  restore) do_restore ;;
  files) do_files ;;
  all) do_dump; do_restore; do_files; "$ROOT/scripts/migrate.sh" ;;
  *) sed -n 2,14p "$0"; exit 1 ;;
esac
