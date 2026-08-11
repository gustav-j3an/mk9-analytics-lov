# Plano de Restrição de Módulos ADMIN (v1.0.0)

Este plano detalha a implementação de restrições de acesso para usuários com o papel `SUPERVISOR`, garantindo que módulos críticos de administração sejam acessíveis apenas por `ADMIN`.

## Módulos Protegidos
1. **Gestão Operacional** (`importacoes`)
2. **Importar Checklist** (`checklists`)
3. **Qualidade** (`qualidade`)
4. **Limpeza Manual** (`cleanup_admin`)
5. **Usuários** (`usuarios`)
6. **Auditoria Controle** (`auditoria_controle`)

## Alterações Propostas

### 1. Frontend: Sidebar e Navegação
- Modificar `src/components/mk9-analytics-app.tsx` para ocultar os itens da sidebar para `SUPERVISOR`.
- Implementar redirecionamento automático para `/dashboard` caso um usuário `SUPERVISOR` tente acessar esses módulos por URL direta.

### 2. Rotas e Segurança
- Proteger as rotas em `src/routes/users.tsx` e `src/routes/cleanup.tsx` com verificações de papel mais rigorosas.
- Garantir que usuários `SUPERVISOR` não possam acessar as views, mesmo com recarregamento de página.

### 3. Server Functions (Camada de Dados)
- Auditar e restringir as funções em:
    - `src/lib/mk9-import.functions.ts`
    - `src/lib/mk9-checklist.functions.ts`
    - `src/lib/mk9-quality.functions.ts`
    - `src/lib/mk9-cleanup.functions.ts`
    - `src/lib/mk9-users.functions.ts`
    - `src/lib/mk9-industries/audit.functions.ts` (Auditoria Controle)
- Mudar `requireMk9Read` ou `requireMk9RoleScope` para `requireMk9Role(["ADMIN"])` onde for pertinente.

## Detalhes Técnicos
- **Reutilização de Infraestrutura**: Utilizar `requireMk9Role` e `normalizeRole` já existentes no projeto.
- **Fail-Safe**: Se a role for desconhecida ou nula, o acesso deve ser negado.
- **Logs**: Todas as tentativas de acesso negado serão registradas no console do servidor para auditoria.

## Critérios de Aceite
- `ADMIN`: Acesso mantido sem alterações em todos os módulos.
- `SUPERVISOR`:
    - Itens removidos da sidebar.
    - URL direta bloqueia e redireciona.
    - Chamadas de servidor retornam 403.
    - Nenhum dado administrativo vaza para a interface.
