#!/bin/sh
# Bloqueia acesso pela internet (interface eth0) a portas de banco publicadas
# pelo Docker. Conexões entre contêineres e do próprio servidor continuam
# funcionando (o CRM, por exemplo, conecta em 147.93.9.172:5432 de dentro da
# rede Docker, que não passa pela eth0).
#
# Para liberar/bloquear outra porta: editar BLOCKED_PORTS e rodar
#   systemctl restart vps-firewall
# Para remover tudo:  /usr/local/sbin/vps-firewall.sh --remove
#
# Instalado em 2026-11-17. Executado pelo vps-firewall.service após o Docker.
set -eu

IFACE="eth0"
BLOCKED_PORTS="5432"
TAG="vps-firewall"

apply() {
  ipt="$1"; chain="$2"; port="$3"
  if [ "$chain" = "DOCKER-USER" ]; then
    # Tráfego publicado pelo Docker chega aqui já com DNAT; usa a porta original.
    rule="-i $IFACE -p tcp -m conntrack --ctstate NEW --ctorigdstport $port -m comment --comment $TAG -j DROP"
  else
    rule="-i $IFACE -p tcp --dport $port -m conntrack --ctstate NEW -m comment --comment $TAG -j DROP"
  fi
  if [ "${MODE:-}" = "--remove" ]; then
    while $ipt -C "$chain" $rule 2>/dev/null; do $ipt -D "$chain" $rule; done
  else
    $ipt -C "$chain" $rule 2>/dev/null || $ipt -I "$chain" 1 $rule
  fi
}

MODE="${1:-}"
for ipt in iptables ip6tables; do
  $ipt -N DOCKER-USER 2>/dev/null || true
  for port in $BLOCKED_PORTS; do
    apply "$ipt" DOCKER-USER "$port"
    apply "$ipt" INPUT "$port"
  done
done
echo "vps-firewall: ${MODE:-aplicado} (portas: $BLOCKED_PORTS)"
