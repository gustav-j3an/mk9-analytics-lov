# Plano de Implementação - MISSÃO 7: MK9 COMMAND CENTER

Transformar o módulo de "Distribuição de Rotas" no Centro Operacional do Promotor, unificando planejamento, distribuição, execução e validação.

## 1. Núcleo Operacional (Backend)
- Aprimorar `mk9ListPromotersWithStats` em `src/lib/mk9-promoters.functions.ts` para incluir:
  - Contagem de visitas REALIZADAS (vindas de `mk9_actual_visits` no período).
  - Contagem de visitas PENDENTES (planejadas - realizadas).
  - Contagem de evidências PENDING (vindas de `mk9_visit_evidence`).
  - Agregação eficiente para evitar N+1, utilizando o `loadOperationCore` ou queries otimizadas por promotor.
- Implementar `mk9GetPromoterOperationalRoute` em `src/lib/mk9-promoters.functions.ts` para retornar o status operacional de cada combinação (Loja + Indústria + Dia) derivado de:
  - `mk9_planned_routes` (Programada)
  - `mk9_visit_evidence` (Evidência Enviada / Rejeitada)
  - `mk9_actual_visits` (Aprovada/Realizada)

## 2. Interface Command Center
- Refatorar `src/components/mk9-routes-module.tsx`:
  - Nova tabela organizada por Promotor com métricas: Nome, Supervisor, UF, Acesso Portal, Lojas, Visitas (Prog/Real/Pend), Evidências.
  - Ações rápidas:
    - `[ MONTAR ROTA ]`: Link para a gestão de roteiros existente.
    - `[ VER ROTA ]`: Modal/Sheet com a visão semanal detalhada (Matriz).
    - `[ ENVIAR AO PROMOTOR ]`: WhatsApp com resumo e link do portal.
    - `[ ACOMPANHAR EXECUÇÃO ]`: Drill-down para as visitas do dia/semana.
  - Filtros de Data: Hoje, Amanhã, Semana, Personalizada.

## 3. Matriz de Roteiro Individual (Visualização Viva)
- Reutilizar `src/components/mk9/promoter-individual-route.tsx` ou criar componente similar para a Central.
- Exibir a grade semanal com status colorido por célula:
  - Cinza: PENDENTE
  - Azul: EVIDÊNCIA ENVIADA
  - Verde: APROVADA / REALIZADA
  - Vermelho: REJEITADA
- Integrar drill-down na célula para abrir a evidência na Central de Validação.

## 4. Integração Portal do Promotor
- Garantir que `/mk9-portal` consuma a mesma lógica de status derivada.
- No Portal, agrupar por Loja no dia atual, exibindo o status atual daquela visita (Permitir reenvio se REJECTED).

## Detalhes Técnicos
- **Status Automático**: PENDENTE (sem evidência/visita) -> EVIDÊNCIA ENVIADA (evidência PENDING) -> REJEITADA (evidência REJECTED) -> APROVADA (visita registrada).
- **Performance**: Uso de `Promise.all` no backend para coletar métricas de planejamento e execução em lote.
- **Segurança**: Respeitar `mk9_user_scopes` para Supervisores (somente promotores sob sua gestão).
