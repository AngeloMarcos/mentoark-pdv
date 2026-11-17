# VPS 147.93.9.172 — mudanças no servidor (fora da pilha do PDV)

O servidor é compartilhado (CRM, Evolution, PDV homologação, observabilidade).
Este diretório registra o que foi alterado no nível do servidor.

## Firewall das portas de banco (2026-11-17)

Antes: Postgres (5432) aberto para a internet, sem firewall nenhum.

Agora: `vps-firewall.service` (systemd, roda depois do Docker) aplica
`vps-firewall.sh`, que descarta **conexões novas vindas da `eth0`** para as
portas em `BLOCKED_PORTS`, em IPv4 e IPv6, nas cadeias `DOCKER-USER` (tráfego
publicado pelo Docker) e `INPUT`.

Por que firewall e não `127.0.0.1:5432:5432` no compose do Postgres: o
`crm-api` e o `crm-api-homolog` conectam em `147.93.9.172:5432` (IP público)
de dentro da rede Docker. Amarrar a porta ao localhost derrubaria o CRM. O
firewall só olha a `eth0`, então esse caminho interno continua funcionando,
sem reiniciar nenhum contêiner.

Verificado após aplicar: conexão da internet bloqueada; `crm-api`,
`crm-api-homolog`, `evolution` e PDV homologação conectando normalmente;
regras reaplicadas sem duplicar após `systemctl restart vps-firewall`.

```bash
systemctl status vps-firewall
iptables -L DOCKER-USER -v -n          # contador de pacotes bloqueados
/usr/local/sbin/vps-firewall.sh --remove   # desfaz (ou: systemctl stop vps-firewall)
```

Para bloquear outra porta (ex.: MySQL 3306), acrescentar em `BLOCKED_PORTS`
e `systemctl restart vps-firewall`. Antes, confirmar quem conecta nela.

Acesso administrativo ao Postgres agora: pgAdmin
(`pgadmin.mentoark.com.br`) ou túnel SSH:
`ssh -L 5432:localhost:5432 root@147.93.9.172`.

## Hemoclinic removido (2026-11-17)

A pedido do responsável. Existiam só os bancos `hemoclinic_prod` e
`hemoclinic_hml` (sem nenhuma tabela, sem conexões, sem contêiner, arquivo ou
cron associado). Dump final de cada um em
`/opt/backups/hemoclinic_*_final_20261117_185656.dump`, depois `DROP DATABASE`.
O registro DNS `hemoclinic.mentoark.com.br` ainda aponta para a VPS e deve ser
removido no provedor de DNS.
