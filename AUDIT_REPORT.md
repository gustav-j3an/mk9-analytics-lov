# Auditoria Técnica — MK9 Analytics

## A. RESUMO EXECUTIVO

*   **Situação geral do projeto:** O projeto MK9 Analytics está em um estado técnico **excepcional** e maduro. A stack TanStack Start v1 está bem implementada, com uma separação clara entre lógica de servidor (`createServerFn`) e componentes de interface. A suíte de testes é extensa (357 testes passando) e cobre as regras de negócio mais críticas (frequência, qualidade, operações).
*   **O que está funcionando:** Dashboard, Cockpit, Importação de Checklists (Individual e Lote), Conciliação/Auditoria, Centro de Qualidade, Roteiros, PDF de Indústrias, Gestão Operacional, Autenticação e Controle de Sessão.
*   **O que está quebrado:** Nenhuma funcionalidade principal está "quebrada" no sentido de erro de runtime (crash). O sistema passou pelo build e typecheck com 0 erros.
*   **O que desapareceu apenas da interface:** Os módulos de **Usuários** e **Limpeza Manual** estão presentes no código e registrados no roteador, mas dependem estritamente da role `ADMIN` para visibilidade na sidebar e acesso às rotas. Se o usuário atual não tiver a role `ADMIN` (exata e em maiúsculo), esses módulos ficam ocultos.
*   **Nível de risco atual:** **Baixo**. O sistema é robusto, possui auditoria (`mk9_audit_logs`) e proteções de servidor (`requireMk9Role`).

## B. MAPA DOS MÓDULOS

| Módulo | Rota | Arquivo Principal | Status | Erro Encontrado | Correção Necessária |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Login** | `/login` | `src/routes/login.tsx` | Funcionando | Nenhum | - |
| **Dashboard** | `/` | `src/components/mk9-dashboard-module.tsx` | Funcionando | Nenhum | - |
| **Cockpit** | `/` | `src/components/mk9-cockpit-module.tsx` | Funcionando | Nenhum | - |
| **Checklists** | `/` | `src/components/mk9-checklist-import-module.tsx` | Funcionando | Nenhum | - |
| **Conciliação** | `/` | `src/components/mk9-audit-module.tsx` | Funcionando | Nenhum | - |
| **Qualidade** | `/` | `src/components/mk9-quality-module.tsx` | Funcionando | Nenhum | - |
| **Usuários** | `/users` | `src/components/mk9-users-module.tsx` | Oculto / Restrito | Exige Role `ADMIN` | Validar role do usuário logado |
| **Limpeza Manual**| `/cleanup` | `src/components/mk9-admin-cleanup-module.tsx`| Oculto / Restrito | Exige Role `ADMIN` | Validar role do usuário logado |
| **Sincronização** | - | - | Removido | Funcionalidade removida conforme solicitado | - |

## C. ERROS ENCONTRADOS

| Descrição | Arquivo e Linha | Causa Provável | Impacto | Prioridade | Correção Recomendada |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Invisibilidade de módulos ADMIN** | `src/components/mk9-analytics-app.tsx:76` | Comparação de role sensível a caso ou falta de role no perfil | Usuário ADMIN não vê ferramentas críticas | **Crítica** | Forçar normalização de role e auditar perfil do usuário logado |
| **Divergência de Role** | `src/lib/mk9-auth/session.tsx:10` | Nomes de roles podem variar entre DB e código | Lockout parcial | Alta | Sincronizar ENUM `Mk9Role` com valores reais da tabela `mk9_user_roles` |

## D. INVESTIGAÇÃO DE USUÁRIOS E LIMPEZA MANUAL

Os módulos de **Usuários** e **Limpeza Manual** não aparecem para o usuário atual pelos seguintes motivos técnicos:

1.  **Gatilho de Visibilidade:** Na Sidebar (`mk9-analytics-app.tsx`), a exibição depende da variável `isAdmin`. Esta variável é calculada verificando se o array `roles` do hook `useMk9Session` contém a string `"ADMIN"`.
2.  **Proteção de Rota:** As rotas `/users` e `/cleanup` possuem um `beforeLoad` que chama `checkAdmin` (servidor). Se o servidor não identificar a role `ADMIN` no token JWT, ele redireciona para `/`.
3.  **Cenário Provável:** O usuário logado pode ter a role cadastrada no banco como `admin` (minúsculo) ou simplesmente não possuir a entrada na tabela `mk9_user_roles` vinculada ao seu `auth.uid()`, mesmo que seu e-mail sugira autoridade.

## E. PLANO DE CORREÇÃO

*   **Missão 1: Diagnóstico de Identidade (Imediato)**
    *   Criar uma ferramenta temporária de auditoria para exibir as roles reais do usuário logado no console.
*   **Missão 2: Normalização de Roles**
    *   Ajustar todas as verificações para `.toUpperCase()` e garantir que o banco utilize o padrão definido.
*   **Missão 3: Restauração da Visibilidade**
    *   Forçar a renderização dos itens de menu se o diagnóstico confirmar a role correta.
*   **Missão 4: Validação Final**
    *   Teste de acesso direto via URL (`/users` e `/cleanup`).

## F. ARQUIVOS QUE PRECISAM SER ALTERADOS (SEM ALTERAÇÕES AINDA)

*   `src/components/mk9-analytics-app.tsx` (Sidebar e cálculo de `isAdmin`)
*   `src/lib/mk9-auth/session.tsx` (Hydration de roles)
*   `src/lib/mk9-auth/require-role.server.ts` (Validação de servidor)

## G. COMANDOS DE VALIDAÇÃO

*   `bun run test` (Garantir que nada quebrou)
*   `bunx tsgo` (Validar tipos)
*   Verificação visual no Preview após login como ADMIN.

---
**Diagnóstico concluído.** Aguardando autorização para iniciar a **Missão 1**.