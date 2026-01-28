
# Plano de Melhoria do Sistema Multi-Tenant

## Resumo Executivo

Este plano propoe melhorias significativas no sistema multi-tenant, incluindo gestao completa de equipe, sistema de convites por email, configuracoes avancadas por tenant, e enriquecimento do modelo de dados.

---

## Analise do Estado Atual

### Pontos Fortes
- Isolamento de dados via RLS funcionando corretamente
- Funcoes SECURITY DEFINER evitando recursao
- Hierarquia de roles (super_admin > admin > operator)
- Trigger automatico para criacao de admins

### Areas de Melhoria Identificadas
1. **Gestao de Equipe**: Nao ha UI para gerenciar membros
2. **Sistema de Convites**: Nao existe forma de convidar usuarios
3. **Configuracoes do Tenant**: Apenas dados basicos (nome, documento)
4. **Auditoria**: Sem log de acoes importantes
5. **Permissoes Granulares**: Apenas admin/operator sem detalhamento

---

## 1. Nova Tabela: Convites de Usuarios

```sql
CREATE TABLE public.tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'operator',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);
```

### Politicas RLS
- Admins podem gerenciar convites do seu tenant
- Super admins podem ver todos os convites

---

## 2. Expansao da Tabela Tenants

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS 
  settings JSONB DEFAULT '{
    "currency": "BRL",
    "timezone": "America/Sao_Paulo",
    "fiscal_enabled": false,
    "logo_url": null,
    "address": null,
    "email": null,
    "receipt_footer": null,
    "low_stock_alert_threshold": 10,
    "allow_negative_stock": false
  }'::jsonb;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS 
  subscription_status TEXT DEFAULT 'trial';

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS 
  subscription_expires_at TIMESTAMPTZ;
```

---

## 3. Nova Tabela: Log de Auditoria

```sql
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant_created 
  ON audit_logs(tenant_id, created_at DESC);
```

---

## 4. Novos Hooks

### src/hooks/useTenantUsers.ts

```typescript
// CRUD de membros do tenant
- useTenantUsers(): Lista usuarios do tenant atual
- useAddTenantUser(): Adicionar usuario existente
- useRemoveTenantUser(): Remover usuario do tenant
- useUpdateUserRole(): Alterar role do usuario

// Sistema de convites
- useTenantInvitations(): Lista convites pendentes
- useCreateInvitation(): Criar convite por email
- useCancelInvitation(): Cancelar convite
- useAcceptInvitation(): Aceitar convite (via token)
- useResendInvitation(): Reenviar email de convite
```

### src/hooks/useTenantSettings.ts

```typescript
- useTenantSettings(): Retorna settings do tenant
- useUpdateTenantSettings(): Atualiza configuracoes
- useUploadTenantLogo(): Upload de logo
```

---

## 5. Edge Function: Envio de Convites

```typescript
// supabase/functions/send-invitation/index.ts
// Envia email de convite usando Resend ou Sendgrid
// Valida autorizacao do usuario que convida
// Gera link com token unico
```

---

## 6. Novos Componentes de UI

### src/components/team/TeamMemberList.tsx
- Lista de membros com avatar/email
- Badge de role (Admin/Operador)
- Acoes: alterar role, remover
- Botao para convidar novo membro

### src/components/team/InviteMemberDialog.tsx
- Form com email e selecao de role
- Validacao de email
- Feedback de sucesso/erro

### src/components/team/PendingInvitations.tsx
- Lista de convites pendentes
- Status (pendente/expirado)
- Acoes: reenviar, cancelar

### src/components/settings/TenantSettingsForm.tsx
- Configuracoes avancadas do tenant
- Upload de logo
- Configuracoes fiscais
- Preferencias de estoque

---

## 7. Modificacao na Pagina Settings.tsx

Substituir a secao "Equipe (Read-only)" por:

```text
┌─────────────────────────────────────────────┐
│  Equipe                         [+ Convidar]│
├─────────────────────────────────────────────┤
│  👤 usuario@email.com           Admin    ⋮  │
│  👤 operador@email.com          Operador ⋮  │
├─────────────────────────────────────────────┤
│  Convites Pendentes                         │
│  📧 novo@email.com    Expira em 5 dias   ⋮ │
└─────────────────────────────────────────────┘
```

---

## 8. Nova Pagina: Aceitar Convite

### src/pages/AcceptInvitation.tsx

- Rota: `/invite/:token`
- Se usuario nao logado: redireciona para login/cadastro
- Se logado: processa aceitacao do convite
- Adiciona usuario ao tenant com role especificado
- Redireciona para select-tenant

---

## 9. Seguranca Adicional

### Funcao RPC para Aceitar Convite

```sql
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation tenant_invitations%ROWTYPE;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Busca convite valido
  SELECT * INTO v_invitation
  FROM tenant_invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > now();
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite invalido ou expirado';
  END IF;
  
  -- Adiciona usuario ao tenant
  INSERT INTO tenant_users (tenant_id, user_id, role)
  VALUES (v_invitation.tenant_id, v_user_id, v_invitation.role)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = v_invitation.role;
  
  -- Marca convite como aceito
  UPDATE tenant_invitations
  SET accepted_at = now()
  WHERE id = v_invitation.id;
  
  RETURN v_invitation.tenant_id;
END;
$$;
```

---

## 10. Estrutura de Arquivos

```text
src/
├── hooks/
│   ├── useTenantUsers.ts          # NOVO
│   └── useTenantSettings.ts       # NOVO
├── components/
│   └── team/
│       ├── TeamMemberList.tsx     # NOVO
│       ├── InviteMemberDialog.tsx # NOVO
│       └── PendingInvitations.tsx # NOVO
├── pages/
│   ├── Settings.tsx               # MODIFICAR
│   └── AcceptInvitation.tsx       # NOVO
└── App.tsx                        # MODIFICAR (nova rota)

supabase/
├── functions/
│   └── send-invitation/
│       └── index.ts               # NOVO
└── migrations/
    └── [timestamp]_multitenant_improvements.sql
```

---

## 11. Migracao SQL Completa

A migracao incluira:

1. Criacao da tabela `tenant_invitations`
2. Expansao da tabela `tenants` com `settings` JSONB
3. Criacao da tabela `audit_logs`
4. Funcao `accept_invitation`
5. Funcao `log_audit_event` para triggers
6. RLS policies para novas tabelas
7. Indices de performance

---

## 12. Fluxo de Convite

```text
  Admin                              Convidado
    │                                    │
    │  1. Cria convite (email + role)    │
    │───────────────────────────────────▶│
    │                                    │
    │        2. Email enviado            │
    │                                    │
    │                           3. Clica link
    │                                    │
    │                      4. Faz login/cadastro
    │                                    │
    │                      5. Aceita convite (RPC)
    │◀───────────────────────────────────│
    │                                    │
    │     6. Acesso ao tenant liberado   │
    │                                    │
```

---

## 13. Consideracoes de UX

- **Feedback Visual**: Toast de sucesso ao convidar
- **Validacao de Email**: Impedir emails invalidos
- **Confirmacao de Remocao**: Dialog antes de remover membro
- **Auto-refresh**: Lista atualiza apos acoes
- **Empty States**: Mensagem amigavel quando sem membros
- **Permissoes**: Ocultar acoes para usuarios sem permissao

---

## 14. Ordem de Implementacao

1. **Migracao SQL** - Novas tabelas e funcoes
2. **Hook useTenantUsers** - CRUD de membros
3. **Hook useTenantSettings** - Configuracoes
4. **Componentes Team** - UI de gerenciamento
5. **Modificar Settings.tsx** - Integrar componentes
6. **Edge Function** - Envio de emails
7. **Pagina AcceptInvitation** - Fluxo de aceite
8. **Atualizar App.tsx** - Nova rota
9. **Testes e ajustes**

---

## 15. Beneficios Esperados

| Melhoria | Impacto |
|----------|---------|
| Gestao de equipe | Permite colaboracao multi-usuario |
| Sistema de convites | Onboarding simplificado |
| Configuracoes avancadas | Personalizacao por empresa |
| Log de auditoria | Rastreabilidade e compliance |
| Permissoes granulares | Maior controle de acesso |

---

## 16. Consideracoes Tecnicas

### Envio de Email
- Utilizar Edge Function com servico externo (Resend/Sendgrid)
- Rate limiting para prevenir abuso
- Template de email responsivo

### Seguranca
- Tokens de convite com expiracao (7 dias)
- Funcao SECURITY DEFINER para aceite
- Validacao de email unico por tenant
- Logs de auditoria para acoes sensiveis

### Performance
- Indices em `tenant_invitations(token)`
- Indices em `audit_logs(tenant_id, created_at)`
- Cache de settings no frontend

