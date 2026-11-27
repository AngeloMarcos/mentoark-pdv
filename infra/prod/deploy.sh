#!/usr/bin/env bash
# Publica o commit atual em https://pdv.mentoark.com.br (pilha /opt/pdv-prod na VPS).
#
#   bash infra/prod/deploy.sh                 infra + migrations + frontend
#   bash infra/prod/deploy.sh --infra         só compose, nginx, scripts e serviços (fiscal, storage)
#   bash infra/prod/deploy.sh --migrations    só migrations
#   bash infra/prod/deploy.sh --frontend      só frontend
#
# Recusa publicar com alterações não commitadas ou fora da main (PROD_ALLOW_BRANCH=1 libera).
set -euo pipefail

HOST="${PROD_SSH:-root@147.93.9.172}"
DIR="/opt/pdv-prod"
URL="https://pdv.mentoark.com.br"
MODE="${1:-all}"
SSH=(ssh -o BatchMode=yes "$HOST")

[ -d supabase/migrations ] || { echo "rode na raiz do repositório"; exit 1; }
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ -n "$(git status --porcelain)" ]; then echo "há alterações não commitadas"; exit 1; fi
if [ "$BRANCH" != main ] && [ "${PROD_ALLOW_BRANCH:-}" != 1 ]; then echo "produção só sai da main (está em $BRANCH)"; exit 1; fi
echo "> $BRANCH @ $(git rev-parse --short HEAD) -> $URL"

if [ "$MODE" = all ] || [ "$MODE" = --infra ]; then
  echo "> Infra"
  STAGE="$(mktemp -d)"
  mkdir -p "$STAGE/web" "$STAGE/sql" "$STAGE/scripts"
  cp infra/prod/docker-compose.yml "$STAGE/"
  cp infra/prod/web/nginx.conf infra/prod/web/security-headers.conf "$STAGE/web/"
  cp infra/homolog/sql/00-bootstrap.sql infra/homolog/sql/01-storage-realtime-stub.sql "$STAGE/sql/"
  cp infra/stack/scripts/*.sh infra/prod/scripts/*.sh "$STAGE/scripts/"
  cp -r infra/fiscal-service infra/mini-storage "$STAGE/"
  rm -f "$STAGE"/fiscal-service/*.test.js
  tar -C "$STAGE" -czf - . | "${SSH[@]}" "set -e; mkdir -p $DIR; cd $DIR; tar -xzf - --no-same-owner; chmod +x scripts/*.sh"
  rm -rf "$STAGE"
  if ! "${SSH[@]}" "test -f $DIR/.env"; then
    "${SSH[@]}" "$DIR/scripts/install.sh"
  else
    "${SSH[@]}" "set -e; cd $DIR; docker compose up -d --build --remove-orphans; docker exec pdv_prd_web nginx -t -q && docker exec pdv_prd_web nginx -s reload"
  fi
fi

if [ "$MODE" = all ] || [ "$MODE" = --migrations ]; then
  echo "> Migrations"
  tar -C supabase/migrations -czf - . | "${SSH[@]}" "mkdir -p $DIR/migrations.incoming && tar -xzf - -C $DIR/migrations.incoming"
  "${SSH[@]}" "set -e; cd $DIR; for f in migrations.incoming/*.sql; do n=\$(basename \$f); [ -e migrations/\$n ] || cp \$f migrations/\$n; done; rm -rf migrations.incoming"
  # Antes da importação da Cloud o banco está vazio: só copia os arquivos.
  if [ "$("${SSH[@]}" "docker exec pdv_prd_db psql -U postgres -d pdv -At -c \"select to_regclass('public.tenants') is not null\"")" = t ]; then
    "${SSH[@]}" "$DIR/scripts/migrate.sh"
  else
    echo "banco ainda sem os dados da Cloud: migrations ficam para depois do import-from-cloud.sh"
  fi
fi

if [ "$MODE" = all ] || [ "$MODE" = --frontend ]; then
  OUT="$(mktemp -d)"
  trap 'rm -rf "$OUT"' EXIT
  ANON="$("${SSH[@]}" "grep ^ANON_KEY= $DIR/.env | cut -d= -f2-")"
  [ -n "$ANON" ] || { echo "ANON_KEY não encontrada em $DIR/.env"; exit 1; }

  echo "> Build"
  mkdir -p dist
  VITE_SUPABASE_URL="$URL" VITE_SUPABASE_PUBLISHABLE_KEY="$ANON" VITE_SUPABASE_PROJECT_ID="pdv-prod" VITE_REALTIME_ENABLED=false \
    npx vite build --outDir "$OUT" --emptyOutDir
  cp dist/version.json "$OUT/version.json"
  if grep -q "supabase.co" "$OUT"/assets/index-*.js; then
    echo "ERRO: o build ainda aponta para o Supabase Cloud"; exit 1
  fi

  echo "> Enviando frontend"
  tar -C "$OUT" -czf - . | "${SSH[@]}" "set -e; cd $DIR/web; rm -rf html.new; mkdir html.new; \
    tar -xzf - -C html.new; chmod -R a+rX html.new; rm -rf html.old; \
    if [ -d html ]; then mv html html.old; fi; mv html.new html; rm -rf html.old"
fi

echo "> Verificando"
sleep 3
"${SSH[@]}" "$DIR/scripts/health.sh"
