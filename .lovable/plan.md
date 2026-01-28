

# Plano: Melhorias no Fluxo de Criacao de Conta e Login

## Resumo

Melhorar a experiencia de usuario na pagina de autenticacao com recursos modernos como visualizacao de senha, indicador de forca de senha, confirmacao de senha no cadastro, mensagens de erro mais claras, e opcao de lembrar-me.

---

## Analise do Estado Atual

### Problemas Identificados

1. **Sem confirmacao de senha** - Usuario pode digitar errado ao criar conta
2. **Sem visualizar senha** - Dificulta conferir o que foi digitado
3. **Sem indicador de forca** - Usuario nao sabe se a senha e segura
4. **Mensagens de erro genericas** - Pouca orientacao ao usuario
5. **Sem opcao "Esqueci minha senha"** - Usuario fica travado
6. **Campos compartilhados entre abas** - Email/senha se mantem ao trocar aba

---

## Melhorias Propostas

### 1. Campo de Confirmacao de Senha (Cadastro)

```text
┌─────────────────────────────────────┐
│  Email                              │
│  ┌─────────────────────────────────┐│
│  │ seu@email.com                   ││
│  └─────────────────────────────────┘│
│                                     │
│  Senha                          👁  │
│  ┌─────────────────────────────────┐│
│  │ ••••••••••                      ││
│  └─────────────────────────────────┘│
│  [████████░░░░] Senha forte         │
│                                     │
│  Confirmar Senha                👁  │
│  ┌─────────────────────────────────┐│
│  │ ••••••••••                      ││
│  └─────────────────────────────────┘│
│  ✓ Senhas coincidem                 │
│                                     │
│  [        Criar conta         ]     │
└─────────────────────────────────────┘
```

### 2. Botao de Mostrar/Ocultar Senha

- Icone de olho (Eye/EyeOff) ao lado direito do campo
- Toggle entre type="password" e type="text"
- Aplicar em ambos os campos (senha e confirmacao)

### 3. Indicador de Forca da Senha

Criterios avaliados:
- Minimo 6 caracteres (obrigatorio)
- Contem numero
- Contem letra maiuscula
- Contem caractere especial
- Minimo 8 caracteres

Niveis visuais:
- **Fraca** (vermelho): 1-2 criterios
- **Media** (amarelo): 3 criterios
- **Forte** (verde): 4-5 criterios

### 4. Validacao em Tempo Real

- Email: validar formato ao perder foco
- Senha: mostrar requisitos enquanto digita
- Confirmacao: comparar com senha em tempo real
- Desabilitar botao ate tudo valido

### 5. Mensagens de Erro Aprimoradas

| Erro Original | Erro Melhorado |
|---------------|----------------|
| "Invalid login credentials" | "Email ou senha incorretos. Verifique e tente novamente." |
| "User already registered" | "Este email ja possui uma conta. Tente fazer login." |
| "Password should be at least 6 characters" | "A senha precisa ter no minimo 6 caracteres." |
| "Invalid email" | "Por favor, insira um email valido (ex: seu@email.com)" |

### 6. Link "Esqueci Minha Senha"

- Adicionar link abaixo do campo de senha no login
- Abre modal ou navega para tela de recuperacao
- Envia email de reset via Supabase Auth

### 7. Opcao "Lembrar-me" (Opcional)

- Checkbox na aba de login
- Mantém sessao ativa por mais tempo
- Utiliza persistSession do Supabase

---

## Estrutura do Componente

### Novos Componentes

```text
src/components/auth/
├── PasswordInput.tsx      # Input com toggle de visibilidade
├── PasswordStrength.tsx   # Indicador de forca
└── ForgotPasswordDialog.tsx # Modal de recuperacao
```

### Modificacoes

```text
src/pages/Auth.tsx
├── Adicionar confirmacao de senha
├── Integrar PasswordInput
├── Integrar PasswordStrength
├── Adicionar link "Esqueci senha"
├── Melhorar mensagens de erro
└── Validacao em tempo real

src/contexts/AuthContext.tsx
├── Adicionar funcao resetPassword
└── Integrar com supabase.auth.resetPasswordForEmail
```

---

## Validacao Aprimorada com Zod

```typescript
const signupSchema = z.object({
  email: z.string()
    .min(1, "Email e obrigatorio")
    .email("Email invalido"),
  password: z.string()
    .min(6, "Minimo 6 caracteres"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas nao coincidem",
  path: ["confirmPassword"],
});
```

---

## Fluxo de Recuperacao de Senha

```text
Usuario esqueceu senha
        │
        ▼
Clica "Esqueci minha senha"
        │
        ▼
Informa email no modal
        │
        ▼
Sistema envia email de reset
        │
        ▼
Usuario clica no link do email
        │
        ▼
Redireciona para app com token
        │
        ▼
Usuario define nova senha
```

---

## UX Melhorada

### Estados de Loading

- Botao com spinner durante processamento
- Campos desabilitados durante submit
- Feedback visual de sucesso/erro

### Acessibilidade

- Labels associados aos inputs
- Aria-labels nos botoes de toggle
- Focus trap no modal
- Mensagens de erro anunciadas

### Responsividade

- Card adaptavel a diferentes telas
- Campos touch-friendly em mobile
- Teclado virtual otimizado (type="email")

---

## Ordem de Implementacao

1. **PasswordInput.tsx** - Componente de senha com toggle
2. **PasswordStrength.tsx** - Indicador de forca
3. **Modificar Auth.tsx** - Integrar novos componentes
4. **Adicionar confirmacao** - Campo de confirmar senha
5. **Validacao em tempo real** - Feedback imediato
6. **ForgotPasswordDialog.tsx** - Modal de recuperacao
7. **AuthContext** - Funcao resetPassword
8. **Mensagens de erro** - Traducao e clareza
9. **Testes e ajustes**

---

## Componentes Visuais

### PasswordStrength.tsx

```text
Senha digitada: "Abc123"

[███████░░░░░] Media
✓ 6+ caracteres
✓ Letra maiuscula
✓ Numero
○ Caractere especial
○ 8+ caracteres
```

### Validacao Visual

```text
Campo com erro:
┌─────────────────────────────────┐
│ email-invalido                  │ ← borda vermelha
└─────────────────────────────────┘
⚠ Por favor, insira um email valido

Campo valido:
┌─────────────────────────────────┐
│ usuario@email.com               │ ← borda verde
└─────────────────────────────────┘
✓ Email valido
```

---

## Beneficios Esperados

| Melhoria | Impacto |
|----------|---------|
| Confirmacao de senha | Menos erros de digitacao |
| Indicador de forca | Senhas mais seguras |
| Visualizar senha | Menos frustracao |
| Mensagens claras | Menor abandono |
| Recuperar senha | Usuarios nao ficam travados |

---

## Arquivos a Criar/Modificar

**Criar:**
- `src/components/auth/PasswordInput.tsx`
- `src/components/auth/PasswordStrength.tsx`
- `src/components/auth/ForgotPasswordDialog.tsx`

**Modificar:**
- `src/pages/Auth.tsx`
- `src/contexts/AuthContext.tsx`

