# Produção do PDV na VPS: pdv.mentoark.com.br

Substitui o Lovable (site) e o Supabase Cloud (banco, login, API, arquivos).
Mesma arquitetura da homologação (`infra/homolog`), em `/opt/pdv-prod` na VPS
`147.93.9.172`, contêineres `pdv_prd_*`, rede `pdv_prd_internal`.

| Contêiner | Função | Memória |
| --- | --- | --- |
| `pdv_prd_db` | Postgres 17, banco `pdv` (dedicado) | 512 MB |
| `pdv_prd_auth` | GoTrue (login), o mesmo motor do Supabase Auth | 128 MB |
| `pdv_prd_rest` | PostgREST (API com RLS) | 160 MB |
| `pdv_prd_storage` | mini-storage (imagens de produto) | 96 MB |
| `pdv_prd_fiscal` | NFC-e via Focus NFe, **produção de verdade** | 128 MB |
| `pdv_prd_web` | nginx: site + `/auth/v1`, `/rest/v1`, `/storage/v1`, `/fiscal/v1` | 64 MB |

O app fala o mesmo protocolo do Supabase: só mudam `VITE_SUPABASE_URL`
(`https://pdv.mentoark.com.br`) e a chave anon.

## O que muda para quem usa

- **Senhas continuam as mesmas** (o hash vem da Cloud). Todo mundo precisa
  entrar de novo uma vez: a assinatura das sessões é nova.
- **Pedidos/Cozinha** atualizam a cada 5 s (não há servidor de Realtime).
- **E-mail** (esqueci a senha, confirmação de conta): só funciona com SMTP no
  `.env`. Sem SMTP, conta nova já entra confirmada e "esqueci a senha" mostra
  erro na tela.

## Arquivos no servidor

```
/opt/pdv-prod/
├── .env              segredos (600). PUBLIC=false até a virada do DNS
├── .env.cloud        credenciais da Cloud, só durante a migração (600). Apagar depois
├── docker-compose.yml
├── scripts/          install, import-from-cloud, migrate, backup, restore, health
├── migrations/       migrations aplicadas (controle em pdv_meta.schema_migrations)
├── imports/          dumps da Cloud (700)
├── backups/          diário às 03h10, 30 dias (700)
└── web/              nginx.conf, security-headers.conf, html/
```

## Publicar

```bash
bash infra/prod/deploy.sh               # infra + migrations + frontend (só da main, sem alterações locais)
bash infra/prod/deploy.sh --frontend
bash infra/prod/deploy.sh --migrations
bash infra/prod/deploy.sh --infra       # compose, nginx, scripts, fiscal, storage
```

Pelo GitHub: workflow **Deploy produção** (manual, aba Actions), precisa do
secret `PROD_SSH_KEY`.

## Migração do Supabase Cloud (ensaiada em 2026-11-27 com a homologação como origem)

1. No painel da Supabase do projeto `zqoilpiwgsvxsvrylvpm`: **Connect →
   Session pooler** (a conexão direta é só IPv6) e **Settings → API → service_role**.
2. Na VPS, `/opt/pdv-prod/.env.cloud` (chmod 600):
   ```
   CLOUD_DB_URL=postgresql://postgres.zqoilpiwgsvxsvrylvpm:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres
   CLOUD_URL=https://zqoilpiwgsvxsvrylvpm.supabase.co
   CLOUD_SERVICE_ROLE_KEY=<service_role>
   ```
3. Ensaio (não afeta a Cloud nem os clientes):
   `scripts/import-from-cloud.sh all` e conferir os números no fim.
4. Testar com `PUBLIC=false`: entrar pelo navegador com
   `curl --resolve` ou editando o `hosts` do computador para
   `147.93.9.172 pdv.mentoark.com.br` (certificado ainda não existe: aceitar o aviso).

### Virada (janela combinada, ~15 min sem vendas)

1. Avisar os clientes. Fechar caixas.
2. `scripts/import-from-cloud.sh all` (carga final, com os dados de agora).
3. No DNS do `mentoark.com.br`: `pdv` → registro **A `147.93.9.172`**,
   sem proxy do Cloudflare (nuvem cinza) até o certificado sair.
4. No `.env`: `PUBLIC=true`; `docker compose up -d web`. O Traefik tira o
   certificado em 1 a 2 minutos. `scripts/health.sh` tem de passar inteiro.
5. Entrar, fazer uma venda, conferir imagens, relatórios e Fiscal.
6. Apagar `.env.cloud`. No Lovable, despublicar o site. Manter o projeto da
   Supabase **pausado, não apagado**, por 30 dias.

### Voltar atrás

Até o passo 3 nada muda para o cliente. Depois dele: DNS de volta para o
Lovable (`185.158.133.1`). Vendas feitas na VPS nesse meio-tempo **não**
voltam sozinhas para a Cloud.

## Pendências

- **SMTP** para e-mails de login.
- **Backup fora da VPS** (hoje fica no mesmo disco).
- Realtime (opcional; a atualização a cada 5 s cobre).
