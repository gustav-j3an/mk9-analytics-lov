# Plan: Novo Status FÉRIAS e Correção de Observação no Módulo de Presença

Adicionar o status "FÉRIAS" ao sistema de presença dos promotores e corrigir o bug de persistência do campo de observação.

## Alterações de Backend

### 1. Banco de Dados (Migration)
- Adicionar o valor `VACATION` ao enum `presence_status`.
- Garantir que a coluna `observation` na tabela `mk9_promoter_presence` esteja sendo tratada corretamente (já existe no schema).

### 2. Funções de Servidor (`src/lib/mk9-presence.functions.ts`)
- Atualizar `PresenceStatusSchema` (Zod) para incluir `VACATION`.
- Revisar `getPresenceList` para garantir que o campo `observation` retornado do banco seja mapeado corretamente para o frontend.
- Revisar `savePresenceBulk` para garantir que `observation` seja persistido no `upsert`.
- Atualizar `getPresenceStats` para incluir a contagem de `VACATION`.

## Alterações de Frontend (`src/components/mk9-presence-module.tsx`)

### 1. UI de Status
- Adicionar o botão "FÉRIAS" na linha de cada promotor.
- Estilo: Azul/Roxo suave (ex: `bg-indigo-500` ou `bg-cyan-500`).
- Garantir exclusividade (um status por dia).

### 2. Correção de Observação
- Verificar o `useEffect` que sincroniza `presenceItems` com `localPresence`.
- Garantir que ao digitar e salvar, o estado local reflita o que vem do servidor.

### 3. KPIs e Filtros
- Adicionar card de KPI "FÉRIAS".
- Adicionar opção "FÉRIAS" no filtro de status.
- Ajustar cálculo de "Não Marcados" para subtrair também as férias.

### 4. Excel
- Incluir o status "FÉRIAS" e o campo de observação na exportação.

### 5. Botão "Marcar Todos"
- Alterar lógica para marcar como `PRESENT` apenas quem estiver `NÃO MARCADO`, preservando `FÉRIAS` e `ATESTADO`.

## Detalhes Técnicos
- **Migration SQL**: 
  ```sql
  ALTER TYPE public.presence_status ADD VALUE IF NOT EXISTS 'VACATION';
  ```
- **Enum Mapping**: `VACATION` no banco -> "FÉRIAS" na UI.
- **KPI Consistency**: `Total = Presente + Falta + Atestado + Férias + Não Marcado`.
