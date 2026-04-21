

## Aplicação do tema azul-roxo degradê — em sprints

Vou aplicar o novo tema visual (azul vibrante → roxo, com degradês, glows e suporte a dark/light) no sistema. O conteúdo que você colou tem alguns problemas que preciso ajustar antes de aplicar:

### Problemas detectados no material enviado

1. **Arquivos 3, 4, 7, 8 vieram com JSX corrompido** (tags vazias, sem conteúdo). Não posso colar como está — o build quebraria. Vou **preservar a estrutura JSX original** desses componentes e aplicar apenas as classes de estilo do novo tema.
2. **Arquivos 6, 7, 8 (`AppSidebar`, `AppHeader`, `CRMLayout`) não existem neste projeto.** Este projeto usa `src/components/layout/AppLayout.tsx` (sidebar + header em um único componente, sem `ThemeProvider`, sem `useAuth` hook próprio — usa `AuthContext`). Os itens de menu também são totalmente diferentes (PDV, Estoque, Caixa, etc., não Leads/WhatsApp/Disparos).
3. **O sistema atualmente é dark-only** (`color-scheme: dark` forçado). O novo CSS introduz light + dark; vou manter ambos funcionais e deixar o default em **dark** para não quebrar a percepção atual.

### Plano em 3 sprints

---

**Sprint 1 — Fundação do tema (tokens + primitives)**
- Substituir `src/index.css` integralmente pelo novo design system (azul/roxo, degradês, glows, shimmer, scrollbar, light + dark).
- Substituir `src/components/ui/button.tsx` pelo novo (variant `default` com `gradient-brand`).
- Substituir `src/components/ui/tabs.tsx` pelo novo (trigger ativo com degradê + glow).
- Reescrever `src/components/ui/badge.tsx` preservando o JSX original e aplicando apenas as novas classes (`gradient-brand` no default).
- Reescrever `src/components/ui/card.tsx` preservando o JSX original (o conteúdo enviado está vazio) e adicionando sutilezas do tema (`glass`, borda suave) sem quebrar API.
- Remover do `index.css` antigo as classes específicas laranja/verde que não fazem mais sentido (`gradient-text`, `gradient-text-success`, `hero-card`, `sale-button`, `animate-primary-glow` em laranja). Substituir por equivalentes do novo tema (`gradient-brand-text`, etc.) e manter aliases para não quebrar telas que usam os nomes antigos.

**Sprint 2 — Layout principal (adaptado ao projeto real)**
- Adaptar `src/components/layout/AppLayout.tsx` (equivalente local de AppSidebar + AppHeader + CRMLayout) ao novo tema:
  - Sidebar com `sidebar-gradient` no dark, fundo claro no light.
  - Logo/título com `gradient-brand-text`.
  - Item ativo do menu com `gradient-brand` + `glow-primary`.
  - Header com linha degradê na base, blur/glass.
  - Adicionar orbs de luz ambiente (decorativos, `pointer-events-none`) no background da área de conteúdo.
  - **Manter** todos os itens de menu reais do PDV (Dashboard, PDV, Produtos, Estoque, Caixa, Devoluções, Fornecedores, Pedidos, etc.) — não substituir pelos itens de CRM do material enviado.
- **Não criar** `AppSidebar.tsx`, `AppHeader.tsx` nem `CRMLayout.tsx` separados — manteria o padrão atual do projeto (um único `AppLayout`) para evitar duplicação e refactor cascata em `App.tsx`.

**Sprint 3 — Varredura de cores hard-coded**
- Buscar nas páginas/componentes usos diretos de classes laranja/verde do tema antigo (`text-orange-*`, `bg-green-*`, `from-primary to-warning`, `sale-button`, `hero-card`, `animate-primary-glow`) e atualizar para os novos tokens (`gradient-brand`, `gradient-brand-text`, `glow-primary`, `accent`).
- Validar que badges "PROMO", botões de ação principal do PDV (Finalizar Venda), e cards de KPI no Dashboard ficam visualmente consistentes com o novo tema.

### Detalhes técnicos

- **Compatibilidade**: o token `--accent` muda de verde para roxo. Componentes que usavam `bg-accent` para indicar "venda/sucesso" passam a usar `bg-success` (verde mantido como token semântico). Vou fazer essa troca onde semanticamente fizer sentido (ex: botões de finalizar venda, indicadores positivos).
- **Dark default**: vou aplicar `class="dark"` no `<html>` (em `index.html` ou no root) para manter a experiência atual em dark, deixando o light disponível para futuro toggle.
- **Sem novas dependências**, sem mudança de rotas, sem mudança de banco.
- **Theme toggle**: não vou criar `ThemeProvider` nesta passada (não estava no escopo original e o sistema é dark-only hoje). Posso adicionar numa sprint extra se quiser.

### Arquivos por sprint

```text
Sprint 1:
  src/index.css                       (substituir)
  src/components/ui/button.tsx        (substituir)
  src/components/ui/tabs.tsx          (substituir)
  src/components/ui/badge.tsx         (reescrever preservando JSX)
  src/components/ui/card.tsx          (reescrever preservando JSX)
  index.html                          (adicionar class="dark" no <html>)

Sprint 2:
  src/components/layout/AppLayout.tsx (aplicar novo tema, manter menu real)

Sprint 3:
  Varredura e ajuste em páginas/components que usam tokens antigos
  (lista exata definida após Sprint 1+2 estarem aplicadas)
```

### O que NÃO vou fazer
- Não vou criar `AppSidebar.tsx`/`AppHeader.tsx`/`CRMLayout.tsx` (quebraria o `App.tsx` atual e duplicaria o `AppLayout`).
- Não vou trocar os itens de menu do PDV pelos itens de CRM do material colado.
- Não vou colar JSX vazio dos arquivos 3/4/7/8 — vou regenerar o JSX correto aplicando apenas o estilo novo.

