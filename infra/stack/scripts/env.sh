# Carregado pelos outros scripts. Descobre a pilha pela pasta do script:
#   /opt/pdv-homolog/scripts/x.sh -> ROOT=/opt/pdv-homolog
#   /opt/pdv-prod/scripts/x.sh    -> ROOT=/opt/pdv-prod
# e lê do .env da pilha o prefixo dos contêineres e a URL pública.
# Sem STACK_PREFIX/SITE_URL no .env, vale o padrão da homologação.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
envval() { { grep -E "^$1=" "$ROOT/.env" 2>/dev/null || true; } | head -1 | cut -d= -f2-; }
P="$(envval STACK_PREFIX)"; P="${P:-pdv_hml}"
SITE_URL="$(envval SITE_URL)"; SITE_URL="${SITE_URL:-https://homologpdv.mentoark.com.br}"
BACKUP_DIR="$ROOT/backups"
DB_CT="${P}_db"
