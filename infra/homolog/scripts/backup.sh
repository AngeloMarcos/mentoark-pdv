#!/usr/bin/env bash
# Backup diário da homologação do PDV: banco (pg_dump -Fc) + imagens de produto.
# Cron (root):  20 3 * * * /opt/pdv-homolog/scripts/backup.sh >> /opt/pdv-homolog/backups/backup.log 2>&1
# 03h20: depois do backup do Postgres compartilhado (03h) e antes da limpeza Docker (04h).
set -euo pipefail

DIR="/opt/pdv-homolog/backups"
RETENTION_DAYS=14
DATE="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$DIR"
chmod 700 "$DIR"

echo "=== $(date -u +%FT%TZ) backup pdv-homolog"

DB_FILE="$DIR/pdv_${DATE}.dump"
docker exec pdv_hml_db pg_dump -U postgres -d pdv -Fc > "$DB_FILE.tmp"
# Confere que o arquivo é um dump legível antes de considerá-lo válido.
docker exec -i pdv_hml_db pg_restore -l < "$DB_FILE.tmp" > /dev/null
mv "$DB_FILE.tmp" "$DB_FILE"

ST_FILE="$DIR/storage_${DATE}.tgz"
docker exec pdv_hml_storage tar czf - -C /data . > "$ST_FILE.tmp"
gzip -t "$ST_FILE.tmp"
mv "$ST_FILE.tmp" "$ST_FILE"

chmod 600 "$DB_FILE" "$ST_FILE"
find "$DIR" -maxdepth 1 \( -name 'pdv_*.dump' -o -name 'storage_*.tgz' \) -mtime +"$RETENTION_DAYS" -delete
find "$DIR" -maxdepth 1 -name '*.tmp' -mmin +60 -delete

ls -lh "$DB_FILE" "$ST_FILE" | awk '{print $5, $NF}'
echo "=== ok"
