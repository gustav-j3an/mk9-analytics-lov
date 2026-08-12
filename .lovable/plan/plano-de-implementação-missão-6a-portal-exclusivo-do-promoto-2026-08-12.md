# Plano de Implementação — Missão 6A: Portal Exclusivo do Promotor

O objetivo é garantir que usuários com a role `PROMOTOR` tenham uma experiência dedicada e isolada, sem acesso ao Command Center administrativo. Isso envolve redirecionamentos forçados, layouts mobile-first simplificados e proteção de rotas no servidor e cliente.

## User-Facing Changes
- **Redirecionamento Automático**: Promotores serão levados diretamente para `/mk9-portal` após o login.
- **Isolamento de Layout**: O Portal do Promotor não exibirá a sidebar administrativa nem cabeçalhos complexos.
- **Minha Rota (Mobile-First)**: Interface focada nas visitas do dia, agrupadas por loja, com botões grandes para realização de visitas.
- **Status de Visitas**: Visualização clara de pendências, aprovações e rejeições (com motivo).
- **Proteção de Acesso**: Bloqueio total de acesso a áreas administrativas (Dashboard, Cadastros, etc.) para a role `PROMOTOR`.

## Technical Details

### 1. Proteção de Rotas e Redirecionamento
- **`src/routes/index.tsx`**: Atualizar a lógica de redirecionamento pós-login para enviar `PROMOTOR` para `/mk9-portal`.
- **`src/routes/dashboard.tsx` (e outras rotas admin)**: Adicionar guardas de redirecionamento no `useEffect` (ou loader se possível) para expulsar Promotores para `/mk9-portal`.
- **`src/routes/__root.tsx`**: Garantir que o shell administrativo (se existir globalmente) seja condicional à rota ou role.

### 2. Layout do Portal (`src/components/mk9-portal-dashboard.tsx`)
- **Remoção da Sidebar**: Garantir que o componente ignore qualquer tentativa de renderizar o `Mk9AnalyticsApp` ou sua sidebar.
- **Novo Header**: Implementar cabeçalho minimalista (MK9 Portal | Minha Rota | Nome | Sair).
- **Agrupamento por Loja**: Refatorar a renderização do roteiro para agrupar múltiplas indústrias sob o mesmo card de loja (melhor UX mobile).
- **Estados da Evidência**: Refinar os componentes de status (`SEM EVIDÊNCIA`, `PENDENTE`, `APROVADA`, `REJEITADA`).
- **GPS Simplificado**: Substituir logs técnicos por mensagens amigáveis ("Validando localização...", "Localização compatível").

### 3. Integração de Dados
- Continuar usando `getMyPromoterRoute` e `getCurrentPromoter` (já homologados).
- Garantir que a lógica de "Hoje" use a data local do dispositivo corretamente.

### 4. Verificação de Segurança
- Testar acesso direto às URLs `/dashboard`, `/users`, etc., com um usuário Promotor.

## Plano de Trabalho

1. **Guards de Redirecionamento**:
   - Editar `src/routes/index.tsx` para redirecionamento inicial.
   - Editar `src/routes/dashboard.tsx` para expulsão de Promotor.
2. **Layout Mobile-First**:
   - Refatorar `src/components/mk9-portal-dashboard.tsx` removendo elementos administrativos e adicionando o Header simplificado.
   - Implementar agrupamento por loja no Roteiro.
3. **Refinamento de UX**:
   - Ajustar textos de GPS e status de evidência.
   - Garantir tamanhos de toque (touch targets) adequados para mobile.
4. **Validação Final**:
   - Executar `tsc` e testes unitários.
   - Testar fluxos de ADMIN (sem alteração) vs PROMOTOR (portal novo).
