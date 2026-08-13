# Plan - Missão 8A.4: Simplificar Rota Individual e Navegação

Simplificar o fluxo de visualização da Rota Individual, eliminando a tela intermediária redundante e garantindo que o botão "Ver Rota" leve diretamente à matriz semanal completa (visualização final), com navegação corrigida para retorno ao módulo de Roteiros.

## Proposed Changes

### 1. Eliminar Visualização Intermediária em `src/components/mk9/promoter-individual-route.tsx`
- Remover o estado e a lógica que renderizava a tela intermediária.
- Transformar a "Visualização 2" (a matriz semanal detalhada) na visualização principal e única do componente.
- Remover o botão redundante "[ VISUALIZAR ROTA ]".
- Unificar a ação de impressão/PDF, mantendo apenas "[ IMPRIMIR ROTA ]".

### 2. Corrigir Navegação de Retorno
- Alterar o botão "Voltar para Gestão" para "VOLTAR PARA ROTEIROS".
- Garantir que o destino seja explicitamente `/dashboard?module=roteiros`, preservando o `promoterId` no search param para manter o foco no promotor selecionado.

### 3. Ajustes no `Mk9RoutesModule` (`src/components/mk9-routes-module.tsx`)
- Confirmar que o botão "[ VER ROTA INDIVIDUAL ]" no card do promotor navega diretamente para a rota final sem popups ou passos extras.

### 4. Preservação de Funcionalidades
- Manter a funcionalidade de busca por loja/indústria na matriz.
- Preservar a lógica de referência de data e versionamento.
- Garantir que o layout de impressão continue operando corretamente a partir da tela única.

## Technical Details
- **Navegação**: Uso de `useNavigate` do TanStack Router para transições explícitas.
- **Estado**: Remoção do parâmetro `previewDocument` do search, já que a tela final será o padrão (ou ajuste para que a tela final seja renderizada imediatamente).

## Verification Plan

### Manual Verification
1. **Fluxo Anderson**: Acessar Roteiros > Anderson > Ver Rota. Verificar se abre a matriz semanal diretamente.
2. **Navegação**: Clicar em "VOLTAR PARA ROTEIROS" e confirmar retorno ao Command Center com Anderson selecionado.
3. **Impressão**: Acionar "Imprimir Rota" e verificar se o layout A4 é gerado corretamente.
4. **URL Direta**: Acessar a URL da rota individual e testar o botão de voltar.

### Automated Tests
- Executar `vitest` para garantir que não houve regressão nas métricas calculadas na tela de rota.
