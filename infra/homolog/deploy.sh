#!/usr/bin/env bash
# Publica o branch atual em https://homologpdv.mentoark.com.br:
#   1. envia supabase/migrations e aplica só as pendentes (com backup antes)
#   2. compila o frontend apontando para a homologação e troca os arquivos
#
# Uso (na raiz do repositório):
#   bash infra/homolog/deploy.sh                 # migrations + frontend
#   bash infra/homolog/deploy.sh --migrations    # só migrations
#   bash infra/homolog/deploy.sh --frontend      # só frontend
# Requer acesso SSH por chave (HOMOLOG_SSH, padrão root@147.93.9.172).
set -euo pipefail

HOST="${HOMOLOG_SSH:-root@147.93.9.172}"
DIR="/opt/pdv-homolog"
URL="https://homologpdv.mentoark.com.br"
MODE="${1:-all}"
SSH=(ssh -o BatchMode=yes "$HOST")

[ -f supabase/migrations/.keep ] || [ -d supabase/migrations ] || { echo "rode na raiz do repositório"; exit 1; }
echo "> $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD) -> $URL"

if [ "$MODE" = all ] || [ "$MODE" = --migrations ]; then
  echo "> Migrations"
  tar -C supabase/migrations -czf - . | "${SSH[@]}" "mkdir -p $DIR/migrations.incoming && tar -xzf - -C $DIR/migrations.incoming"
  # Nunca sobrescreve uma migration já aplicada (o arquivo do servidor pode ter patch manual).
  "${SSH[@]}" "set -e; cd $DIR; for f in migrations.incoming/*.sql; do n=\$(basename \$f); [ -e migrations/\$n ] || cp \$f migrations/\$n; done; rm -rf migrations.incoming; scripts/migrate.sh"
fi

if [ "$MODE" = all ] || [ "$MODE" = --frontend ]; then
  OUT="$(mktemp -d)"
  trap 'rm -rf "$OUT"' EXIT
  ANON="$("${SSH[@]}" "grep ^ANON_KEY= $DIR/.env | cut -d= -f2-")"
  [ -n "$ANON" ] || { echo "ANON_KEY não encontrada em $DIR/.env"; exit 1; }

  echo "> Build"
  mkdir -p dist   # o plugin de versão grava em dist/version.json mesmo com --outDir
  VITE_SUPABASE_URL="$URL" VITE_SUPABASE_PUBLISHABLE_KEY="$ANON" VITE_REALTIME_ENABLED=false \
    npx vite build --outDir "$OUT" --emptyOutDir
  cp dist/version.json "$OUT/version.json"   # o plugin de versão grava sempre em dist/
  printf 'User-agent: *\nDisallow: /\n' > "$OUT/robots.txt"
  if grep -q "supabase.co" "$OUT"/assets/index-*.js; then
    echo "ERRO: o build ainda aponta para o Supabase Cloud"; exit 1
  fi

  echo "> Enviando frontend"
  tar -C "$OUT" -czf - . | "${SSH[@]}" "set -e; cd $DIR/web; rm -rf html.new; mkdir html.new; \
    tar -xzf - -C html.new; chmod -R a+rX html.new; rm -rf html.old; \
    if [ -d html ]; then mv html html.old; fi; mv html.new html; rm -rf html.old"
  # Sem restart: o nginx monta a pasta web/ inteira e serve o html/ novo na hora.
fi

echo "> Verificando"
sleep 3
"${SSH[@]}" "$DIR/scripts/health.sh"
