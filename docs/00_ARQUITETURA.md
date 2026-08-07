# 00. Arquitetura do Sistema

## Padrões Fundamentais
1. **Single Source of Truth**: O `loadOperationCore` é a única fonte para KPIs operacionais. Dashboard, PDF e Cockpit devem bater 100%.
2. **Server-Side Modern**: Lógica pesada reside em `createServerFn`. O cliente é focado em apresentação.
3. **Imutabilidade Operacional**: Dados operacionais nunca são deletados fisicamente. Usamos `archived_at` ou `superseded_at`.
4. **Resiliência SSR**: Todas as server functions são blindadas com validadores Zod e tratamento de erro centralizado.

## Fluxo de Dados
1. **Entrada**: Excel (Checklists/Roteiros) -> Parser -> Preview -> Commit (Substituição de Competência).
2. **Processamento**: Motor de Conciliação -> Detectores de Qualidade -> Projeção de Frequência.
3. **Saída**: Dashboard (UI) / Relatório PDF / Auditoria Administrativa.
