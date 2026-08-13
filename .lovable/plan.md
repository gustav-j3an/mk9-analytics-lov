# Missão 8A.1: Restaurar Gestão de Roteiros e Rota Individual

Restaurar a gestão de roteiros para o modelo de agrupamento por Loja com múltiplas indústrias, e corrigir o bug crítico onde a Rota Individual aparece vazia.

## User Review Required

> [!IMPORTANT]
> A Missão 8A.1 foca em restaurar a funcionalidade de planejamento e visualização semanal. Não serão criados novos módulos operacionais nesta etapa.

- **Seleção Múltipla**: O formulário de criação/edição permitirá selecionar várias indústrias para o mesmo vínculo (Promotor + Loja + Dias).
- **Vigência**: Mudanças no roteiro encerram a versão anterior um dia antes da nova data de vigência, preservando o histórico.

## Proposed Changes

### 1. Database & Queries (Source of Truth)
- Auditar e padronizar as consultas em `mk9_planned_routes` para usar a mesma lógica de vigência: `valid_from <= ref` AND (`valid_until IS NULL` OR `valid_until >= ref`).
- Criar/Refatorar função centralizada para buscar a rota vigente de um promotor.

### 2. Gestão de Roteiros (UI)
- Agrupar visualmente: **Dia da Semana > Loja > Lista de Indústrias**.
- Layout mais compacto para visualização rápida.
- Adicionar ações discretas de Editar e Excluir por indústria.

### 3. Formulário de Roteiro
- Substituir o select de indústria por uma seleção múltipla (Checkboxes ou Multi-select).
- Na criação: permitir escolher múltiplos dias e múltiplas indústrias.
- Na edição: permitir gerenciar (adicionar/remover) indústrias mantendo a integridade do versionamento.

### 4. Rota Individual (Bug Crítico)
- Corrigir a query da Matriz Semanal para mostrar o roteiro completo vigente na data de referência.
- Garantir que "Total de Visitas" conte todas as ocorrências semanais e "Combinações" conte pares Indústria x Loja.

## Technical Details

- **Arquitetura de Dados**: Cada combinação (Promotor, Loja, Indústria, Dia) continua sendo um registro único no banco para garantir compatibilidade com as regras operacionais.
- **Transacionalidade**: Ao salvar múltiplas indústrias/dias, a interface garantirá que todas as operações de upsert sejam processadas corretamente.
- **Timezone**: Atenção redobrada ao tratamento de datas ISO (AAAA-MM-DD) para evitar saltos de vigência devido ao fuso horário.

## Relatório de Entrega Esperado
- A. Contagem de registros reais do Anderson.
- B. Diagnóstico da falha na Rota Individual.
- C. Telas de Gestão e Rota Individual sincronizadas.
- D. Teste de múltiplos vínculos no Anderson (ex: Mendez + Copra).
