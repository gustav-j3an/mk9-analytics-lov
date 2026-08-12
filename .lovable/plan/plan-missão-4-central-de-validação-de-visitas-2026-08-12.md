# Plan: Missão 4 — Central de Validação de Visitas

Implementação da interface administrativa e lógica de servidor para análise de evidências de visitas (fotos + GPS), garantindo segurança, integridade e isolamento de escopo.

## User Steps
1. Admin ou Supervisor acessa o MK9 Command Center.
2. Abre o novo módulo **Validação de Visitas**.
3. Visualiza a fila de pendências (PENDING), ordenadas por antiguidade.
4. Analisa a foto (Signed URL) e os dados de GPS (Match/Outside).
5. Clica em **Aprovar** (atualiza status e revisor).
6. Ou clica em **Rejeitar**, selecionando um motivo obrigatório.
7. Promotor visualiza o status atualizado e motivo de rejeição no Portal.

## Technical Details

### Backend
1. **Server Function `processVisitEvidence`**:
   - Valida roles (ADMIN ou SUPERVISOR).
   - Valida escopo para SUPERVISOR (reutilizando guards existentes).
   - Implementa transição atômica: `UPDATE WHERE status = 'PENDING'`.
   - Salva `reviewed_by`, `reviewed_at` e `rejection_reason`.
2. **Server Function `listVisitEvidences`**:
   - Implementa paginação e filtros (status, promotor, indústria, etc).
   - Retorna Signed URLs temporárias para as fotos.
   - Aplica filtros de visibilidade por role (Supervisor vê apenas seu escopo).

### Interface (Command Center)
1. **Novo componente `Mk9ValidationCenterModule`**:
   - Lista híbrida (Desktop) e Cards (Mobile).
   - Filtros de status, localização e busca por promotor/loja.
   - Contador discreto de pendências.
   - Dialog de rejeição com motivos pré-definidos.
   - Visualização ampliada da foto.
2. **Atualização da Sidebar (`Mk9AnalyticsApp`)**:
   - Adicionar item "Validação de Visitas" na seção "Operação".
   - Visibilidade restrita: `!PROMOTOR`.

### Interface (Portal do Promotor)
1. **Atualização do `Mk9PortalDashboard`**:
   - Mostrar status amigável (Pendente de validação, Visita aprovada, Visita rejeitada).
   - Se rejeitado, exibir o motivo.
   - Permitir reenvio (preservando o registro rejeitado no banco).

### Segurança (RLS)
- Garantir que `mk9_visit_evidence` permita SELECT e UPDATE para ADMIN/SUPERVISOR conforme políticas de auditoria.

## Verification Plan

### Automated Tests (Vitest)
1. `src/lib/mk9-portal/validation.test.ts`:
   - Testar transição de status (Aprovar/Rejeitar).
   - Testar concorrência (duas aprovações simultâneas).
   - Testar restrição de role (Promotor não pode aprovar).
   - Testar restrição de escopo (Supervisor A não aprova visita do Supervisor B).

### Manual Verification
1. Enviar evidência como Promotor -> Verificar se aparece na Central.
2. Aprovar como Admin -> Verificar status APPROVED no banco e Portal.
3. Rejeitar como Supervisor -> Verificar motivo no Portal.
4. Tentar aprovar evidência já aprovada -> Deve falhar graciosamente.
5. Verificar que `mk9_actual_visits` não foi alterada.
