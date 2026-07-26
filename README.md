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
