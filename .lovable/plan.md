# Plano de Estabilização: Motor de Importação MK9 (v3.4.0)

Este plano visa corrigir as falhas silenciosas e inconsistências de dados no motor de importação (individual e lote) identificadas no diagnóstico v3.3.0.

## 1. Refino do Parser (Heurística de Linhas)
- **Local**: `src/lib/mk9-checklist/parser.ts`
- **Ação**: Alterar a regra que descarta linhas que começam com "TOTAL/GERAL/SUBTOTAL".
- **Nova Regra**: Uma linha só será ignorada se:
    - O nome da loja for um termo de resumo isolado (ex: "TOTAL", "GERAL").
    - **E** a linha não possuir visitas válidas detectadas em suas colunas de dados.
- **Objetivo**: Permitir nomes legítimos como "TOTAL LUBRIFICANTES" enquanto mantém a limpeza de rodapés do Excel.

## 2. Integridade e Visibilidade de Indústrias
- **Local**: `src/lib/mk9-industries.functions.ts` e `src/lib/mk9-checklist/batch.server.ts`.
- **Sincronização**: Garantir que se `control_mode = 'VISIT_CONTROLLED'`, a flag `requires_checklist` seja forçada para `true`.
- **Correção de Dados**:
    - **CO LATICÍNIOS**: Ajustar configuração para ser visível no checklist se o modo de controle assim exigir.
    - **PACHÁ ALIMENTOS**: Garantir que a busca e importação lidem corretamente com a normalização `PACHA` vs `PACHÁ`.
- **Filtro de Seleção**: Revisar o filtro de `requires_checklist` para não ocultar indústrias que deveriam estar operacionais.

## 3. Telemetria e Diagnóstico de Datas
- **Local**: `src/lib/mk9-checklist/parser.ts` (`detectDateColumn`).
- **Ação**: Implementar registro de rejeição para colunas que pareçam datas mas falhem no reconhecimento de formato.
- **Interface**: Adicionar uma seção "Dados Ignorados" no preview do checklist, listando:
    - Linhas puladas e o motivo (ex: "Linha de resumo detectada", "Loja sem nome").
    - Colunas de data ignoradas.
    - Visitas deduplicadas.

## 4. Garantia de Não-Deduplicação Cross-Industry
- **Local**: `src/lib/mk9-checklist/persistence.server.ts`.
- **Ação**: Validar e, se necessário, corrigir a chave de deduplicação na aplicação para incluir `industry_id`.
- **Meta**: Garantir que duas indústrias diferentes visitando a mesma loja no mesmo dia resultem em dois registros distintos, respeitando a `UNIQUE constraint` do banco.

## 5. Casos de Teste (Regressão)
- **Cenários**:
    - Loja "TOTAL ATACAREJO" (deve importar).
    - Duas indústrias (KING e COOPATOS) na mesma loja/data (deve gerar 2 registros).
    - Indústria "PACHÁ ALIMENTOS" via Excel com nome "PACHA".
    - Arquivo com coluna "12-AGO-26" (validar reconhecimento ou aviso de erro).

## Detalhes Técnicos
- Nenhuma alteração em Dashboard, Roteiros, Presença ou Financeiro.
- Uso de RLS e Rotação de Logs para manter a trilha de auditoria da importação.
- Atualização da versão para **v3.4.0 — STABILIZATION ACTIVE**.
