# Missão — Proteção do Roteiro contra Reimportação Destrutiva

## Diagnóstico

Situação atual de `mk9_planned_routes`:
- Já tem `created_by`, `updated_by`, `last_import_id`, `valid_from/until`, `archived_at`, `is_active`.
- **Falta**: `source_type`, `source_import_id`, `last_manual_edit_at`.
- 446 rotas ativas, todas com o mesmo `last_import_id` (importação de julho).
- Importador atual em `persistence.server.ts` faz upsert em bloco sem diff/classificação; qualquer reimportação hoje pode reabrir/sobrescrever silenciosamente.

## Escopo

### 1. Migração aditiva (sem destruição)
Adicionar em `mk9_planned_routes`:
- `source_type text NOT NULL DEFAULT 'IMPORT'` com CHECK `('IMPORT','MANUAL')`
- `source_import_id uuid` (nullable, FK lógica p/ `mk9_imports.id`)
- `last_manual_edit_at timestamptz` (nullable)

Backfill:
- Todas as 446 linhas atuais → `source_type='IMPORT'`, `source_import_id = last_import_id`.
- Preservar `valid_from/until`, IDs, vigências.

Ajustar `mk9RoutesUpsertItem` (edição pela UI) para marcar `source_type='MANUAL'` e `last_manual_edit_at=now()` na versão nova.

### 2. Motor de diff (`src/lib/mk9/route-diff.server.ts` — novo)

Entrada: rotas importadas da planilha (com competência) + snapshot atual do banco.

Para cada rota importada, classifica:
- **UNCHANGED** — versão vigente no início da competência é semanticamente igual (mesmo promotor, loja, indústria, dia).
- **NEW_ROUTE** — nenhuma versão cobre a chave (loja, indústria, dia) na competência.
- **CHANGED_PROMOTER** — versão vigente tem outro promotor.
- **CHANGED_WEEKDAY** — mesma tripla loja+indústria+promotor migrou de dia.
- **MANUAL_CONFLICT** — versão vigente é `source_type='MANUAL'` ou tem `last_manual_edit_at` posterior a `source_import_id.started_at`.
- **FUTURE_VERSION_CONFLICT** — existe uma versão com `valid_from > competência` que seria invalidada.

Para rotas do banco ausentes da planilha na competência:
- **REMOVED_FROM_IMPORT** (se `source_type='IMPORT'`)
- **MANUAL_CONFLICT** (se `source_type='MANUAL'`)

Saída: `RouteDiffReport { unchanged, new, changedPromoter, changedWeekday, removed, manualConflicts, futureConflicts, items: RouteDiffItem[] }`.

### 3. Persistência transacional
Nova função SQL `mk9_apply_route_diff(_import_id uuid, _decisions jsonb)`:
- BEGIN implícito (função plpgsql).
- Para cada decisão aplicável:
  - UNCHANGED → apenas atualiza `last_import_id`.
  - NEW_ROUTE → INSERT com `source_type='IMPORT'`, `valid_from = primeiro dia da competência`.
  - CHANGED_* → UPDATE `valid_until = competência - 1` na versão anterior; INSERT nova versão.
  - REMOVED_FROM_IMPORT → UPDATE `valid_until = competência - 1` (não DELETE).
  - MANUAL_CONFLICT/FUTURE_VERSION_CONFLICT → **skip** salvo decisão administrativa explícita `force=true`.
- Falha em qualquer passo → RAISE EXCEPTION → rollback total → importação marcada FAILED.

Substituir `persistDataset` em `persistence.server.ts` para consumir o diff (não mais upsert em massa das rotas).

### 4. Prévia obrigatória
Refatorar `orchestrator.server.ts`:
- Fase preview roda o diff e retorna `RouteDiffReport` no `preview.routeDiff`.
- Fase commit só executa `mk9_apply_route_diff` — bloqueia se `manualConflicts + futureConflicts > 0` e a chamada não explicitou `resolveConflicts`.

Atualizar `src/components/mk9-import-module.tsx`:
- Novo painel "Roteiro — impacto":
  ```
  Sem alteração: 430   Novas: 8
  Alteradas (promotor): 3   Alteradas (dia): 0
  Removidas: 2   Conflitos manuais: 3   Conflitos futuros: 1
  ```
- Botão "Ver detalhes" abre tabela por rota com badge da classificação.
- Botão "Confirmar" desabilitado se conflitos > 0, salvo checkbox "Resolver conflitos usando planilha".

### 5. Regra de prioridade (documentada no código)
1. `MANUAL` confirmado no sistema.
2. Importação da competência mais recente.
3. Importação histórica anterior.
Importação nunca sobrescreve `MANUAL` silenciosamente.

### 6. Validação (testes A–F executados via SQL/UI e reportados)
- A: reimportar julho → 446 UNCHANGED, mesmos IDs.
- B: editar rota futura (ago) + reimportar julho → agosto intacto.
- C: editar promotor manual + importar planilha antiga → MANUAL_CONFLICT.
- D: importar agosto com troca → julho fecha 31/07, agosto abre 01/08.
- E: rota removida de agosto → valid_until fechado, sem DELETE.
- F: erro forçado no commit → rollback total.

## Detalhes técnicos

**Arquivos novos**
- `src/lib/mk9/route-diff.server.ts` — motor de diff puro.
- Migração SQL adicionando colunas + função `mk9_apply_route_diff`.

**Arquivos alterados**
- `src/lib/mk9/persistence.server.ts` — substituir `upsertPlannedRoutes` por integração com diff + RPC.
- `src/lib/mk9/orchestrator.server.ts` — expor `routeDiff` no preview, bloquear commit com conflitos.
- `src/lib/mk9-routes.functions.ts` — `mk9RoutesUpsertItem` marca `source_type='MANUAL'`, `last_manual_edit_at`.
- `src/components/mk9-import-module.tsx` — painel de impacto + tabela de conflitos + toggle "force".
- `src/lib/mk9/types.ts` — tipos `RouteDiffItem`, `RouteDiffReport`, `RouteChangeKind`.

**Sem alteração**
- `mk9_planned_visits`, menu "Visitas" oculto, checklist, auditoria, PDFs, dashboard.

## Entrega
Após execução dos testes, reporto: contagem antes/depois, IDs preservados, conflitos detectados, coluna real usada, typecheck e build.

Aprovar para prosseguir?
