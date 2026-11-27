#!/usr/bin/env bash
# Aplica as migrations pendentes de <pilha>/migrations, em ordem.
# Cada arquivo roda numa transação única junto com o registro em
# pdv_meta.schema_migrations: ou entra inteiro e fica registrado, ou nada muda.
# Uso: /opt/<pilha>/scripts/migrate.sh [--dry-run]
set -euo pipefail
source "$(dirname "$0")/env.sh"

DIR="$ROOT/migrations"
DRY="${1:-}"
psql_db() { docker exec -i "$DB_CT" psql -U postgres -d pdv -v ON_ERROR_STOP=1 -q "$@"; }

psql_db <<'SQL'
create schema if not exists pdv_meta;
create table if not exists pdv_meta.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
SQL

applied="$(psql_db -At -c 'select version from pdv_meta.schema_migrations')"
pending=0
for f in $(ls "$DIR"/*.sql | sort); do
  name="$(basename "$f")"
  if grep -qxF "$name" <<<"$applied"; then continue; fi
  pending=$((pending + 1))
  if [ "$DRY" = "--dry-run" ]; then echo "pendente: $name"; continue; fi
  echo "aplicando: $name"
  # Backup leve antes de cada lote de mudanças de schema.
  if [ "$pending" = 1 ]; then "$ROOT/scripts/backup.sh" > /dev/null; fi
  { cat "$f"; printf "\ninsert into pdv_meta.schema_migrations(version) values ('%s');\n" "$name"; } \
    | psql_db -1
done

# PostgREST guarda o schema em cache: avisa para recarregar.
if [ "$pending" -gt 0 ] && [ "$DRY" != "--dry-run" ]; then
  psql_db -c "notify pgrst, 'reload schema'"
fi
echo "migrations pendentes: $pending"
