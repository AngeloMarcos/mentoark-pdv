#!/usr/bin/env bash
# Backup diário de uma pilha do PDV (homologação ou produção): banco (pg_dump -Fc) + imagens de produto.
# Cron (root), uma linha por pilha:
#   20 3 * * * /opt/pdv-homolog/scripts/backup.sh >> /opt/pdv-homolog/backups/backup.log 2>&1
#   10 3 * * * /opt/pdv-prod/scripts/backup.sh >> /opt/pdv-prod/backups/backup.log 2>&1
# 03h20: depois do backup do Postgres compartilhado (03h) e antes da limpeza Docker (04h).
set -euo pipefail
source "$(dirname "$0")/env.sh"

DIR="$BACKUP_DIR"
RETENTION_DAYS="$(envval BACKUP_RETENTION_DAYS)"; RETENTION_DAYS="${RETENTION_DAYS:-14}"
DATE="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$DIR"
chmod 700 "$DIR"

echo "=== $(date -u +%FT%TZ) backup $ROOT"

DB_FILE="$DIR/pdv_${DATE}.dump"
docker exec "$DB_CT" pg_dump -U postgres -d pdv -Fc > "$DB_FILE.tmp"
# Confere que o arquivo é um dump legível antes de considerá-lo válido.
docker exec -i "$DB_CT" pg_restore -l < "$DB_FILE.tmp" > /dev/null
mv "$DB_FILE.tmp" "$DB_FILE"

ST_FILE="$DIR/storage_${DATE}.tgz"
docker exec "${P}_storage" tar czf - -C /data . > "$ST_FILE.tmp"
gzip -t "$ST_FILE.tmp"
mv "$ST_FILE.tmp" "$ST_FILE"

chmod 600 "$DB_FILE" "$ST_FILE"
find "$DIR" -maxdepth 1 \( -name 'pdv_*.dump' -o -name 'storage_*.tgz' \) -mtime +"$RETENTION_DAYS" -delete
find "$DIR" -maxdepth 1 -name '*.tmp' -mmin +60 -delete

ls -lh "$DB_FILE" "$ST_FILE" | awk '{print $5, $NF}'
echo "=== ok"
