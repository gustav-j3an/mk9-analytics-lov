# Plano de Correção: Excel do Controle de Diárias (v2.6.0)

A exportação de Excel do Controle de Diárias será refatorada para garantir paridade total com as regras financeiras da tela e clareza nas métricas operacionais.

## Regras de Negócio e Financeiras
- **Cálculo Oficial**: `Valor Unitário × Qtd Indústrias`.
- **Atendimento**: Combinação única de `Loja × Indústria`.
- **Status Financeiro**: Manter regra atual onde `PLANEJADA` + `A PAGAR` entra no financeiro (confirmado no sistema atual).
- **Consistência**: O Excel usará a mesma função utilitária de cálculo que a interface.

## Alterações Técnicas

### 1. Núcleo de Cálculos (`src/lib/mk9-freelancer-dailies.functions.ts`)
- Extrair a lógica de cálculo para uma função compartilhada no servidor.
- Refatorar `getDailiesExportData` para usar esta função.
- Garantir que a aba `RESUMO` utilize as definições explícitas (Atendimentos, Lojas Únicas, Indústrias Únicas).
- Ajustar a aba `ATENDIMENTOS` para incluir `VALOR_DO_ATENDIMENTO` (igual ao valor unitário da diária), permitindo a validação `SUM(atendimentos) = SUM(diarias)`.
- Adicionar log de validação interna antes de retornar os dados.

### 2. Interface (`src/components/mk9-dailies-module.tsx`)
- Sincronizar os rótulos de exportação com a nova estrutura.
- Garantir que os filtros de data e status sejam passados corretamente para a função de exportação.

## Validação de Dados (Benchmark 01/08 a 11/08)
- **Registros Esperados**: 6 diárias.
- **Total Financeiro**: R$ 440,00.
- **Verificação**: A soma da coluna `VALOR_DO_ATENDIMENTO` na aba Atendimentos deve bater com o total da aba Diárias e do Resumo.

## Checklist de Entrega
1. Causa da divergência identificada e corrigida.
2. Função de cálculo unificada.
3. Abas Resumo, Diárias e Atendimentos revisadas.
4. Validação automática de soma implementada.
5. Comportamento de diárias PLANEJADAS preservado conforme regra atual.
