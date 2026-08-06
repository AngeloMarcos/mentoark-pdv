# Revisão completa: Usuários, Login e Empresas (Tenants)

## O que aconteceu com mentoark@gmail.com

O e-mail **já existia** na base antes da sua tentativa de hoje. Os registros de autenticação mostram o evento `user_repeated_signup` (cadastro repetido) e a resposta do cadastro veio sem identidade vinculada — o padrão de quando a conta já existe. Nesse caso o cadastro **não** redefine a senha, então o login seguinte falhou com "credenciais inválidas".

Pior: a tela mostrou "Conta criada com sucesso!" e navegou para a seleção de empresa, mesmo sem sessão. Ou seja, o sistema mentiu sobre o resultado — é isso que dá a sensação de "bug que não reconhece a conta".

## Problemas confirmados na revisão

1. **Cadastro repetido tratado como sucesso** — a tela sempre exibe sucesso e navega, mesmo quando o e-mail já existe ou quando falta confirmar o e-mail (o cadastro com confirmação ativa não cria sessão).
2. **Recursão infinita na regra de acesso de `system_users`** — toda verificação de super admin retorna erro 500 (`infinite recursion detected in policy`). Isso acontece em **todo login**, poluindo o console e quebrando o acesso ao painel `/super-admin`.
3. **Não existe tela de redefinição de senha** — o "esqueci minha senha" envia o link para `/auth`, o que apenas loga a pessoa sem trocar a senha. Não há rota `/reset-password`.
4. **Nenhum domínio de e-mail configurado** — confirmações e recuperações saem por remetente padrão, com entrega instável (principal causa de contas "presas" sem confirmar).
5. **Nenhuma proteção de rota por autenticação** — as páginas usam apenas o guard de onboarding; `/super-admin` e `/garcom` não têm verificação de sessão.
6. **Sem visão administrativa de contas** — não há como ver, no sistema, se um usuário existe, se confirmou o e-mail, quando entrou pela última vez, nem reenviar convite/confirmação.

## Plano de melhoria

### Etapa 1 — Corrigir o acesso agora (banco)
- Reescrever as regras de `system_users` usando a função segura `is_super_admin` em vez de consultar a própria tabela (elimina a recursão).
- Garantir que cada usuário sempre consiga ler o próprio registro.
- Rodar o verificador de segurança depois da mudança.

### Etapa 2 — Fluxo de conta correto e honesto
- Detectar cadastro de e-mail já existente e mostrar "Este e-mail já tem conta — faça login ou recupere a senha", com atalho para recuperação.
- Só navegar após sessão confirmada; se a confirmação de e-mail estiver ativa, exibir a tela "verifique seu e-mail" com botão de reenviar.
- Criar a página **/reset-password** (link de recuperação aponta para ela, valida o token de recuperação e grava a nova senha).
- Traduzir todas as mensagens de erro de autenticação para português em um único lugar.

### Etapa 3 — Confirmação de e-mail: decisão
Recomendação: **manter a confirmação de e-mail ativa** e configurar um domínio de envio próprio (ex.: `mentoark.com.br`), para que confirmações, recuperações e convites cheguem de forma confiável. Alternativa, se quiser destravar hoje: ativar confirmação automática (login imediato após cadastro) e configurar o domínio depois.

Também vou destravar a conta `mentoark@gmail.com` (reenvio de confirmação ou envio de link de definição de senha), conforme a opção escolhida.

### Etapa 4 — Proteção de rotas e sessão
- Criar um `AuthGuard` único aplicado a todas as rotas privadas, inclusive `/garcom` e `/super-admin` (este último exigindo super admin).
- Padronizar o estado de carregamento para não "piscar" a tela de seleção de empresa nem deslogar durante a renovação do token.
- Redirecionar de volta para a página pretendida após o login.

### Etapa 5 — Gestão de usuários e empresas
- Na aba **Equipe**, mostrar por membro: e-mail, papel, se a conta está confirmada e último acesso; ações de reenviar convite, revogar convite e alterar papel.
- Convites: página de aceite com estados claros (expirado, já usado, e-mail diferente do logado) e criação automática do vínculo com a empresa.
- Melhorar a seleção de empresa: lista clara quando houver várias, criação de empresa quando não houver nenhuma, e mensagem específica de "sem acesso a nenhuma empresa" em vez de cair na tela de criar empresa.
- No painel super admin: busca de usuários, empresas e vínculos, com ação de conceder acesso.

### Etapa 6 — Verificação
- Testar no navegador: cadastro novo, cadastro repetido, login, recuperação de senha, aceite de convite, troca de empresa e acesso super admin — confirmando que o erro 500 de `system_users` desapareceu.

## Detalhes técnicos

- Migração: substituir as políticas `Super admins can manage system_users` e `Super admins can view all system_users` por versões baseadas em `public.is_super_admin()` (SECURITY DEFINER), mais política de leitura do próprio registro.
- `src/contexts/AuthContext.tsx`: `signUp` passa a retornar `{ user, session, alreadyRegistered }` (detecção via `identities.length === 0`); `resetPassword` aponta para `/reset-password`.
- Novos arquivos: `src/pages/ResetPassword.tsx`, `src/components/auth/AuthGuard.tsx`, `src/lib/auth-errors.ts`.
- `src/App.tsx`: rota pública `/reset-password`; rotas privadas envolvidas por `AuthGuard`; `/super-admin` com guard de super admin.
- `src/hooks/useTenantUsers.ts` / `Team.tsx`: exibir status de confirmação e último acesso via RPC `get_tenant_members` (estender a função se necessário).
