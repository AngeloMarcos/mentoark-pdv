#!/usr/bin/env bash
# Primeira instalação da pilha de produção em /opt/pdv-prod (pode repetir: não
# recria segredos nem apaga dados). Depois dela, o banco está vazio: os dados
# vêm do Supabase Cloud com scripts/import-from-cloud.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
jwt() { # jwt <role> <secret>: chave de API HS256 de 10 anos, igual às do Supabase
  local h p s
  h="$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)"
  p="$(printf '{"iss":"supabase","role":"%s","iat":%s,"exp":%s}' "$1" "$(date +%s)" "$(( $(date +%s) + 315360000 ))" | b64url)"
  s="$(printf '%s.%s' "$h" "$p" | openssl dgst -sha256 -hmac "$2" -binary | b64url)"
  printf '%s.%s.%s' "$h" "$p" "$s"
}

if [ ! -f .env ]; then
  echo "> gerando segredos em .env"
  JWT_SECRET="$(openssl rand -hex 32)"
  touch .env && chmod 600 .env
  cat > .env <<EOF
STACK_PREFIX=pdv_prd
# true só na virada do DNS (liga a rota no Traefik e o certificado)
PUBLIC=false
SITE_URL=https://pdv.mentoark.com.br
BACKUP_RETENTION_DAYS=30
DB_PASSWORD=$(openssl rand -hex 24)
AUTHENTICATOR_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$JWT_SECRET
ANON_KEY=$(jwt anon "$JWT_SECRET")
SERVICE_ROLE_KEY=$(jwt service_role "$JWT_SECRET")
# E-mail (recuperar senha, confirmar conta). Sem SMTP, MAILER_AUTOCONFIRM=true.
MAILER_AUTOCONFIRM=true
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_ADMIN_EMAIL=no-reply@mentoark.com.br
SMTP_SENDER_NAME=MentoArk PDV
EOF
fi
chmod 600 .env
mkdir -p backups migrations imports rollback web/html
chmod 700 backups imports
[ -f web/html/version.json ] || echo '{"version":"instalando"}' > web/html/version.json
# O nginx do contêiner roda como outro usuário: o site precisa ser legível.
chmod -R a+rX web

val() { grep -E "^$1=" .env | cut -d= -f2-; }
psql_db() { docker exec -i pdv_prd_db psql -U postgres -d pdv -v ON_ERROR_STOP=1 -X -q "$@"; }

echo "> banco"
docker compose up -d db
for _ in $(seq 60); do docker exec pdv_prd_db pg_isready -U postgres -d pdv > /dev/null 2>&1 && break; sleep 1; done
psql_db -v auth_pw="$(val AUTHENTICATOR_PASSWORD)" < sql/00-bootstrap.sql

echo "> login (GoTrue cria o schema auth)"
docker compose up -d auth
for _ in $(seq 90); do
  [ "$(psql_db -At -c "select to_regclass('auth.users') is not null")" = t ] && break; sleep 1
done
[ "$(psql_db -At -c "select to_regclass('auth.users') is not null")" = t ] || { echo "GoTrue não criou auth.users"; docker logs --tail 30 pdv_prd_auth; exit 1; }
psql_db < sql/01-storage-realtime-stub.sql

echo "> API, arquivos, fiscal e site"
docker compose up -d --build rest storage fiscal web

if ! crontab -l 2>/dev/null | grep -qF "$ROOT/scripts/backup.sh"; then
  (crontab -l 2>/dev/null; echo "10 3 * * * $ROOT/scripts/backup.sh >> $ROOT/backups/backup.log 2>&1") | crontab -
  echo "> backup diário agendado (03h10)"
fi
docker compose ps --format '{{.Name}} {{.Status}}'
