# Plan - Missão 8A.3: Editor de Roteiro por Dia (Multi-Loja/Indústria)

Reestruturar a gestão de roteiros para permitir edição por dia da semana, agrupando múltiplas lojas e indústrias em uma única interface, mantendo a normalização no banco de dados (`mk9_planned_routes`).

## User Review Required

> [!IMPORTANT]
> A edição de um dia preservará registros que abrangem outros dias da semana. Se um registro (ex: Loja X, Indústria Y) vale para "SEG + QUA" e você remover da "SEG", ele continuará existindo para "QUA".

- O componente de Combobox pesquisável será baseado no padrão Radix/Command para Promotores e Lojas.
- O layout do modal de edição será responsivo, com scrolls internos para evitar quebras em telas menores.

## Proposed Changes

### 1. Novo Componente: `RouteDayEditorDialog`
- Criar `src/components/mk9/route-day-editor-dialog.tsx`.
- Interface:
  - Título dinâmico (ex: "EDITAR SEGUNDA-FEIRA").
  - Seleção de Promotor via Combobox pesquisável.
  - Lista de Lojas adicionadas ao dia.
  - Para cada loja: Checklist de Indústrias + Botão Remover.
  - Botão central "[ + ADICIONAR LOJA ]" com busca compacta.
- Lógica de Persistência:
  - Identificar registros atuais do promotor no dia selecionado.
  - Comparar com o novo estado.
  - Gerar novos registros para adições.
  - Encerrar registros (via `valid_until`) para remoções.

### 2. Ajustes no `MK9RoutesModule`
- Adicionar botão "[ EDITAR DIA ]" no cabeçalho de cada dia da semana.
- Adicionar botão "[ + ADICIONAR LOJA NA [DIA] ]" no final de cada bloco diário.
- Atualizar a visualização para garantir o agrupamento correto Loja > Indústrias.

### 3. Melhoria no "Novo Roteiro"
- Refatorar o dialog de criação para o novo "Construtor de Roteiro".
- Permitir selecionar múltiplos dias e aplicar a mesma matriz de Lojas/Indústrias a todos eles simultaneamente.

### 4. Componentes de UI (Pesquisa Compacta)
- Implementar `PromoterSearch` e `StoreSearch` com `Command` do shadcn.
- Configurar `max-height` e scroll interno nos dropdowns.
- Formatação compacta dos resultados das lojas (Nome, Rede, Cidade/UF).

### 5. Rota Individual e Matriz
- Garantir que o cálculo de "Total de Visitas" reflita a soma correta das ocorrências semanais.
- Validar a exibição dos checks na matriz após as edições multi-loja.

## Technical Details

- **Persistência**: Operações transacionais para garantir que a atualização de um dia não corrompa os outros.
- **Filtros de Vigência**: Manter a lógica de `valid_from` e `valid_until` para o versionamento.
- **Performance**: Otimizar a busca de lojas/promotores para lidar com volumes crescentes sem travar a interface.

## Verification Plan

### Automated Tests
- `bun run test`: Verificar se as métricas operacionais e o motor de roteiros permanecem íntegros.
- Testar a lógica de diff entre estado anterior e novo no `RouteDayEditorDialog`.

### Manual Verification
1. **Teste Anderson**: Abrir Segunda-feira, adicionar Assaí (King/Pacha), salvar e conferir na Rota Individual.
2. **Pesquisa**: Digitar nomes parciais de promotores e lojas e verificar a velocidade e layout do dropdown.
3. **Responsividade**: Testar o editor em resolução mobile (375px width).
