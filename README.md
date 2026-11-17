# MentoArk PDV

Bem-vindo ao repositório oficial do **MentoArk PDV**.
Este é um sistema de frente de caixa (PDV) e gestão comercial de alta performance, focado em velocidade de atendimento e resiliência, utilizando React, Vite e Supabase.

## Tecnologias Principais

- **Frontend:** React 18, TypeScript, Tailwind CSS, shadcn/ui
- **State Management:** TanStack Query (React Query)
- **Backend/Database:** Supabase (PostgreSQL, Auth, RPCs)
- **Build Tool:** Vite

## Como Rodar Localmente

Siga os passos abaixo para clonar e configurar o ambiente de desenvolvimento na sua máquina:

### 1. Instale as dependências
Certifique-se de usar o Node.js e instale as dependências do projeto:
```bash
npm install
```

### 2. Configure as Variáveis de Ambiente
Na raiz do projeto, você deve ter um arquivo `.env` configurado com as chaves de acesso ao seu banco de dados Supabase.
Se não houver, crie um arquivo chamado `.env` e preencha as chaves:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
```

### 3. Inicie o servidor local
Rode o script do Vite para levantar a aplicação:
```bash
npm run dev
```
O servidor iniciará localmente (geralmente na porta `8080`) e você poderá acompanhar as edições em tempo real (Hot Module Replacement).

## Estrutura de Arquitetura

O projeto adota uma barreira arquitetural estrita (Clean Architecture) para maior performance e fácil manutenção:
- `src/components/`: Componentes puramente visuais e interativos.
- `src/pages/`: Mapeamento de telas da aplicação.
- `src/hooks/`: Camada de estado assíncrono (React Query).
- `src/services/`: Abstração de infraestrutura. Apenas esta camada conhece o Supabase e dispara as transações ao PostgreSQL.
- `supabase/migrations/`: Scripts SQL para versionamento das tabelas e Stored Procedures.

## Reforma Tributária (IBS, CBS e IS)

O PDV calcula e destaca IBS, CBS e Imposto Seletivo (EC 132/2023, LC 214/2025), inclui os grupos da reforma no XML da NFC-e e tem um relatório diário/mensal de tributos em **Fiscal → Tributos**. Configuração, testes de desempenho e conferência do XML estão em [docs/reforma-tributaria.md](docs/reforma-tributaria.md).

## Emissão fiscal real (NFC-e)

A emissão de NFC-e válida na SEFAZ roda no serviço `infra/fiscal-service` (Focus NFe), nunca no navegador. Como colocar no ar e o checklist de implantação de cada comerciante estão em [docs/emissao-fiscal.md](docs/emissao-fiscal.md).

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (porta 8080) |
| `npm run build` | Build de produção |
| `npm test` | Testes unitários e de desempenho (Vitest) |
| `npm run test:perf` | Só os testes de desempenho do motor tributário |
| `npm run typecheck` | Checagem de tipos |
| `npm run lint:tax` | Lint do módulo tributário e dos componentes novos do PDV (bloqueante no CI) |
| `npm run test:fiscal` | Testes da montagem da NFC-e do serviço fiscal |
| `npm run lint` | Lint do projeto inteiro (ainda com erros antigos; não bloqueante no CI) |
