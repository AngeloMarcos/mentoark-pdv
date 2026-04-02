

# Plano: Sistema de Onboarding Inteligente Multi-Etapas

## Decisao Arquitetural Importante

O projeto ja possui arquitetura multi-tenant com tabela `tenants` contendo campo `settings` JSONB e `segment`. Em vez de criar uma tabela `company_settings` separada (que duplicaria dados e conflitaria com a arquitetura existente), vou **integrar o onboarding ao fluxo de criacao de tenant existente**, armazenando as features no `tenants.settings` JSONB.

Isso significa:
- `tenants.settings.features` armazena as features ativas (JSONB)
- `tenants.settings.onboarding_completed` indica se o wizard foi concluido
- `tenants.segment` ja existe e sera expandido com os novos valores
- `hasFeature()` consulta `tenants.settings.features`

---

## Estrutura de Arquivos

```text
CRIAR:
  src/contexts/CompanyContext.tsx
  src/hooks/useCompanySettings.ts
  src/components/onboarding/OnboardingGuard.tsx
  src/components/onboarding/OnboardingWizard.tsx
  src/components/onboarding/steps/StepWelcome.tsx
  src/components/onboarding/steps/StepBusinessInfo.tsx
  src/components/onboarding/steps/StepSegment.tsx
  src/components/onboarding/steps/StepFeatures.tsx
  src/components/onboarding/SegmentFeatures.ts

MODIFICAR:
  src/App.tsx              — adicionar CompanyProvider
  src/pages/SelectTenant.tsx — integrar OnboardingGuard no fluxo de nova empresa
  src/components/layout/AppLayout.tsx — ocultar menus conforme hasFeature()
  src/pages/Settings.tsx   — secao "Perfil do Negocio" com reconfiguracao
```

---

## 1. Banco de Dados

Nenhuma migracao necessaria. O campo `tenants.settings` JSONB ja existe e sera expandido com:

```json
{
  "onboarding_completed": true,
  "features": {
    "employee_selection": true,
    "tables": true,
    "cash_register": true,
    "barcode_reader": true,
    ...
  }
}
```

O campo `tenants.segment` ja existe e recebera os novos valores expandidos (`borracharia`, `casa_racao`, `adega`, `bar_restaurante`, `mercado`, `farmacia`, `loja_roupas`, `outro`).

---

## 2. SegmentFeatures.ts

Constante com configuracao de features por segmento, exatamente como descrito no prompt (borracharia, casa_racao, adega, bar_restaurante, mercado, farmacia, loja_roupas, outro). Cada feature tem key, label, description, default e category.

---

## 3. CompanyContext + useCompanySettings

- `useCompanySettings`: busca `settings` do tenant atual, expoe `hasFeature(key)`, `features`, `isOnboardingCompleted`
- `CompanyContext`: provedor global com `hasFeature()` disponivel via `useCompany()`

---

## 4. OnboardingGuard

- Envolve o conteudo do `AppLayout` (ou rota de dashboard)
- Se tenant selecionado mas `!onboarding_completed` → renderiza `<OnboardingWizard />`
- Caso contrario → renderiza children

---

## 5. OnboardingWizard (4 etapas)

| Etapa | Componente | Descricao |
|-------|-----------|-----------|
| 1 | StepWelcome | Boas-vindas, botao "Vamos comecar" |
| 2 | StepBusinessInfo | Nome*, CNPJ, telefone, endereco (com mascaras) |
| 3 | StepSegment | Grid de cards com 8 segmentos clicaveis |
| 4 | StepFeatures | Toggles agrupados por categoria, pre-selecionados conforme segmento |

- Pagina fullscreen com barra de progresso
- Estado local com useState, salva tudo no Supabase apenas ao concluir
- Ao concluir: atualiza `tenants` (name, document, phone, segment, settings com features + onboarding_completed)
- Toast de sucesso + redireciona para dashboard

---

## 6. Integracao no Fluxo Existente

### SelectTenant.tsx
- Ao criar nova empresa, em vez do dialog simples atual, redirecionar para o OnboardingWizard
- Ou: criar tenant minimo e marcar `onboarding_completed: false`, deixando o Guard ativar o wizard

### AppLayout.tsx — Menu Condicional
```typescript
// Ocultar itens conforme features:
{ hasFeature('tables') && navItem("Mesas") }
// Mesas so aparece se feature ativa
```

NAV_ITEMS filtrados:
- "Mesas" → `tables`
- Items que nao tem feature associada (Dashboard, PDV, Produtos, Clientes, Estoque, Relatorios, Financeiro, Configuracoes) sempre visiveis

### Settings.tsx
- Nova secao "Perfil do Negocio" mostrando segmento atual e botao para reconfigurar features

---

## 7. Ordem de Implementacao

Dado o tamanho, sera dividido em **2 etapas**:

**Etapa 1** (este ciclo):
1. `SegmentFeatures.ts` — constante de features
2. `useCompanySettings.ts` — hook de dados
3. `CompanyContext.tsx` — contexto global
4. `OnboardingWizard.tsx` + 4 steps — wizard completo
5. `OnboardingGuard.tsx` — guard de rota
6. Modificar `App.tsx` — integrar CompanyProvider
7. Modificar `SelectTenant.tsx` — integrar com fluxo de onboarding

**Etapa 2** (proximo ciclo):
1. Modificar `AppLayout.tsx` — filtrar menu com hasFeature
2. Modificar `Settings.tsx` — secao de reconfiguracao
3. Integrar `hasFeature('employee_selection')` no PDV
4. Ajustes finos e testes

