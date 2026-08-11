# Plano de Ação — Corrigir Dados do Dashboard por Indústria

Este plano visa resolver a inconsistência de dados onde colunas principais (Frequência, Previstas, Realizadas) aparecem zeradas, enquanto Pendentes e Cobertura possuem valores.

## Passos Técnicos

### 1. Tipagem Analítica
Atualizar `src/lib/mk9-analytics/analytics-types.ts` para incluir os campos ausentes na evolução por indústria.

### 2. Motor Analítico (Backend)
Refatorar `src/lib/mk9-analytics/analytics-engine.server.ts`:
- Incluir `frequency` (vindo de `OperationIndustryRow.frequency`).
- Incluir métricas detalhadas de `contracted` e `realized` por indústria.
- Garantir que `contracted` e `realized` usem as propriedades oficiais do `OperationCore` (`contratadas` e `realizadas`).

### 3. Interface do Dashboard (Frontend)
Ajustar `src/components/mk9-analytics-dashboard.tsx`:
- Garantir que o mapeamento de `ind.contracted.current` e `ind.realized.current` esteja correto.
- Validar a exibição da frequência.

## Relatório de Mudanças Esperado
1. **Causa Raiz**: Divergência de nomes de propriedades entre o Engine analítico e o componente UI.
2. **Fonte da Frequência**: `mk9_industry_store_frequency` via `loadOperationCore`.
3. **Fonte das Previstas**: `OperationIndustryRow.contratadas`.
4. **Fonte das Realizadas**: `OperationIndustryRow.realizadas`.
5. **Correção**: Unificação do payload para garantir que todas as colunas bebam da mesma fonte de dados processada pelo núcleo operacional.

## Verificação
- Comparar dados da indústria KING e COOPATOS com o banco.
- Verificar integridade matemática: `Previstas = Realizadas + Pendentes`.
