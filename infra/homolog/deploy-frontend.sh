#!/usr/bin/env bash
# Publica o frontend do branch atual em https://homologpdv.mentoark.com.br
# Uso (na raiz do repositório):  bash infra/homolog/deploy-frontend.sh
# Requer acesso SSH por chave a root@147.93.9.172.
set -euo pipefail

HOST="root@147.93.9.172"
DIR="/opt/pdv-homolog"
URL="https://homologpdv.mentoark.com.br"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

echo "> Lendo a chave anon do servidor"
ANON="$(ssh "$HOST" "grep ^ANON_KEY= $DIR/.env | cut -d= -f2-")"
[ -n "$ANON" ] || { echo "ANON_KEY não encontrada em $DIR/.env"; exit 1; }

echo "> Build ($(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD))"
VITE_SUPABASE_URL="$URL" VITE_SUPABASE_PUBLISHABLE_KEY="$ANON" \
  npx vite build --outDir "$OUT" --emptyOutDir
# O plugin de versão grava sempre em dist/version.json.
cp dist/version.json "$OUT/version.json"
printf 'User-agent: *\nDisallow: /\n' > "$OUT/robots.txt"

if grep -q "supabase.co" "$OUT"/assets/index-*.js; then
  echo "ERRO: o build ainda aponta para o Supabase Cloud"; exit 1
fi

echo "> Enviando"
tar -C "$OUT" -czf - . | ssh "$HOST" "set -e; cd $DIR/web; rm -rf html.new; mkdir html.new; \
  tar -xzf - -C html.new; chmod -R a+rX html.new; rm -rf html.old; \
  if [ -d html ]; then mv html html.old; fi; mv html.new html; rm -rf html.old; \
  docker restart pdv_hml_web >/dev/null"

echo "> Conferindo"
curl -fsS "$URL/version.json"; echo
echo "Publicado em $URL"
