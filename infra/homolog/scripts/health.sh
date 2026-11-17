#!/usr/bin/env bash
# Verifica a homologação de ponta a ponta. Sai com código 1 se algo falhar.
# Uso: /opt/pdv-homolog/scripts/health.sh
set -uo pipefail

URL="https://homologpdv.mentoark.com.br"
ANON="$(grep ^ANON_KEY= /opt/pdv-homolog/.env | cut -d= -f2-)"
fail=0
check() {
  local name="$1"; shift
  if "$@" > /dev/null 2>&1; then echo "ok    $name"; else echo "FALHA $name"; fail=1; fi
}

for c in pdv_hml_db pdv_hml_auth pdv_hml_rest pdv_hml_storage pdv_hml_web; do
  st="$(docker inspect -f '{{.State.Status}}{{if .State.Health}}/{{.State.Health.Status}}{{end}}' "$c" 2>/dev/null)"
  case "$st" in running|running/healthy) echo "ok    $c ($st)";; *) echo "FALHA $c (${st:-ausente})"; fail=1;; esac
done

check "postgrest /ready"      docker exec pdv_hml_web wget -qO /dev/null http://rest:3001/ready
check "site (https)"          curl -fsS -m 10 "$URL/version.json"
check "login (auth/health)"   curl -fsS -m 10 -H "apikey: $ANON" "$URL/auth/v1/health"
check "api (rest)"            curl -fsS -m 10 -H "apikey: $ANON" "$URL/rest/v1/"
check "storage"               curl -fsS -m 10 "$URL/storage/v1/health"

last="$(ls -t /opt/pdv-homolog/backups/pdv_*.dump 2>/dev/null | head -1)"
if [ -n "$last" ] && [ -z "$(find "$last" -mmin +1560)" ]; then
  echo "ok    backup recente ($(basename "$last"))"
else
  echo "FALHA backup com mais de 26h (ou inexistente)"; fail=1
fi

exit "$fail"
