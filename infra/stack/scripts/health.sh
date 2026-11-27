#!/usr/bin/env bash
# Verifica uma pilha do PDV de ponta a ponta. Sai com código 1 se algo falhar.
# Uso: /opt/<pilha>/scripts/health.sh
set -uo pipefail
source "$(dirname "$0")/env.sh"

URL="$SITE_URL"
ANON="$(envval ANON_KEY)"
fail=0
check() {
  local name="$1"; shift
  if "$@" > /dev/null 2>&1; then echo "ok    $name"; else echo "FALHA $name"; fail=1; fi
}

for c in "$P"_db "$P"_auth "$P"_rest "$P"_storage "$P"_fiscal "$P"_web; do
  st="$(docker inspect -f '{{.State.Status}}{{if .State.Health}}/{{.State.Health.Status}}{{end}}' "$c" 2>/dev/null)"
  case "$st" in running|running/healthy) echo "ok    $c ($st)";; *) echo "FALHA $c (${st:-ausente})"; fail=1;; esac
done

check "postgrest /ready"      docker exec "${P}_web" wget -qO /dev/null http://rest:3001/ready

# Pela URL pública (Traefik + HTTPS); com PUBLIC=false (antes da virada do DNS),
# pelo próprio nginx da pilha, que é o mesmo caminho menos o Traefik.
if [ "$(envval PUBLIC)" = false ]; then
  get() { docker exec "${P}_web" wget -qO /dev/null --header "apikey: $ANON" "http://127.0.0.1$1"; }
  echo "(rota pública desligada: checando pelo nginx interno)"
else
  get() { curl -fsS -m 10 -o /dev/null -H "apikey: $ANON" "$URL$1"; }
fi
check "site"                  get /version.json
check "login (auth/health)"   get /auth/v1/health
check "api (rest)"            get /rest/v1/
check "storage"               get /storage/v1/health
check "fiscal"                get /fiscal/v1/health

last="$(ls -t $BACKUP_DIR/pdv_*.dump 2>/dev/null | head -1)"
if [ -n "$last" ] && [ -z "$(find "$last" -mmin +1560)" ]; then
  echo "ok    backup recente ($(basename "$last"))"
else
  echo "FALHA backup com mais de 26h (ou inexistente)"; fail=1
fi

exit "$fail"
