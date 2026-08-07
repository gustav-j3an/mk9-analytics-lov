# 03. Fluxo de Importação

## 1. Parser (Excel -> IR)
- Local: `src/lib/mk9/parser.ts`.
- Função: Lê o `ArrayBuffer` do Excel e transforma em um objeto intermediário (IR) normalizado.
- Independência: O parser não conhece o banco de dados.

## 2. Preview (IR -> Diagnostics)
- Local: `src/lib/mk9-checklist/preview.server.ts`.
- Função: Compara o Excel com o banco de dados atual. Identifica lojas novas, mudanças de frequência e possíveis conflitos.
- Diagnóstico: Gera um relatório de "Saúde da Importação".

## 3. Commit (Transação)
- Local: `src/lib/mk9-checklist.functions.ts`.
- Etapas:
  1. Cria lojas inexistentes.
  2. Persiste as visitas.
  3. Aplica o Diff de Frequência (Versionamento).
  4. Invalida competências anteriores.
  5. Dispara a Reconciliação Operacional.
