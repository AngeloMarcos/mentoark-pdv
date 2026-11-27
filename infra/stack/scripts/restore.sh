#!/usr/bin/env bash
# Restaura uma pilha do PDV a partir de um backup.
#   restore.sh --check <pdv_AAAAMMDD_HHMMSS.dump>   restaura num banco temporário e compara (não mexe no real)
#   restore.sh --apply <pdv_AAAAMMDD_HHMMSS.dump>   SUBSTITUI o banco pdv (faz backup do estado atual antes)
set -euo pipefail
source "$(dirname "$0")/env.sh"

MODE="${1:-}"; FILE="${2:-}"
DIR="$BACKUP_DIR"
[ -n "$FILE" ] || { echo "uso: $0 --check|--apply <arquivo.dump>"; exit 1; }
[ -f "$FILE" ] || FILE="$DIR/$FILE"
[ -f "$FILE" ] || { echo "arquivo não encontrado: $FILE"; exit 1; }
db() { docker exec -i "$DB_CT" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

count_sql="select (select count(*) from information_schema.tables where table_schema='public')
  ||' tabelas, '||(select count(*) from auth.users)||' usuarios, '||(select count(*) from public.tenants)||' empresas'"

case "$MODE" in
  --check)
    db -d postgres -c "drop database if exists pdv_restore_check" -c "create database pdv_restore_check"
    docker exec -i "$DB_CT" pg_restore -U postgres -d pdv_restore_check --no-owner --exit-on-error < "$FILE"
    echo "backup : $(db -d pdv_restore_check -At -c "$count_sql")"
    echo "atual  : $(db -d pdv -At -c "$count_sql")"
    db -d postgres -c "drop database pdv_restore_check"
    echo "restauração de teste ok"
    ;;
  --apply)
    "$ROOT/scripts/backup.sh"
    cd "$ROOT"
    docker compose stop auth rest storage
    db -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='pdv' and pid<>pg_backend_pid()" \
       -c "drop database pdv" -c "create database pdv"
    docker exec -i "$DB_CT" pg_restore -U postgres -d pdv --exit-on-error < "$FILE"
    docker compose start auth rest storage
    echo "banco restaurado de $FILE: $(db -d pdv -At -c "$count_sql")"
    ;;
  *) echo "uso: $0 --check|--apply <arquivo.dump>"; exit 1 ;;
esac
