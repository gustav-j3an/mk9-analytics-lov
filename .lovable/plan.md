## Missão: Importador de Checklists das Indústrias

Novo módulo independente do importador MK9, para processar planilhas de checklist mensal (ex: `KING - CHECK LIST - JULHO 2026.xlsx`) e persistir **visitas realizadas** (origem `CHECKLIST`).

---

### 1. Banco de dados (migration)

Criar duas tabelas + enum:

- `mk9_checklist_origin` enum: `CHECKLIST`
- **`mk9_checklist_imports`** — registro da importação
  - `filename`, `file_hash`, `industry_id` (FK mk9_industries), `operation_month`, `operation_year`
  - `status` (reuso do enum `mk9_import_status`)
  - `counters jsonb`, `preview jsonb`, `error_message`, `user_id`
  - `started_at`, `finished_at`, `duration_ms`
- **`mk9_actual_visits`** — visita realizada
  - `industry_id` (FK), `store_id` (FK), `scheduled_date date`
  - `origin` (enum, default `CHECKLIST`)
  - `status text default 'completed'`
  - `source_import_id` (FK mk9_checklist_imports)
  - `created_at`, `updated_at`
  - **UNIQUE(industry_id, store_id, scheduled_date, origin)** — idempotência
- GRANTs para `authenticated` + `service_role`, RLS ligado com policies `authenticated ALL`
- Trigger `updated_at` com `mk9_touch_updated_at`

### 2. Camada de domínio (`src/lib/mk9-checklist/`)

- `types.ts` — `ChecklistRow`, `ChecklistPreview`, `ChecklistItem`, `PersistResult`
- `parser.ts` — lê o xlsx:
  - detecta linha de cabeçalho (loja / UF / freq semanal / freq mensal + colunas 1..31)
  - normaliza cada linha; identifica ✓ (`✓`, `x`, `X`, `V`, `1`, `true`) em colunas de dia
  - gera `{ storeName, uf, day }` para cada marcação
- `resolution.ts` — resolve loja por (`name_normalized`, `uf`) contra `mk9_stores`; resolve indústria selecionada
- `preview.ts` — monta contadores + tabela de linhas com status (`FOUND` / `STORE_NOT_FOUND` / `INVALID_DATE`)
- `persistence.server.ts` — usa `supabaseAdmin`:
  - cria `mk9_checklist_imports` (previewing → done/failed)
  - upsert em `mk9_actual_visits` com `onConflict: 'industry_id,store_id,scheduled_date,origin'`

### 3. Server functions (`src/lib/mk9-checklist.functions.ts`)

- `previewChecklist({ fileBase64, filename, industryId, month, year })` → parse + resolve + retorna preview (não persiste)
- `commitChecklist({ ...preview payload, industryId, month, year, filename })` → cria registro import, persiste visitas, atualiza contadores/status
- `listChecklistImports()` — histórico
- `deleteChecklistImport(id)` — apaga import + visitas correlatas

### 4. UI

- Novo menu no sidebar de `mk9-analytics-app.tsx`:
  ```
  Importações
    ├── Base MK9        (existente)
    └── Checklists      (novo)
  ```
- Novo componente `src/components/mk9-checklist-import-module.tsx`:
  1. Upload arquivo
  2. Selects: mês, ano, indústria (carregada via query)
  3. Botão "Gerar prévia"
  4. Cards: total lojas / total visitas / encontradas / não encontradas / datas válidas / inválidas
  5. Tabela: Loja · UF · Data · Status · Resultado
  6. AlertDialog "Confirmar importação" → persiste
  7. Histórico com status e botão apagar

### 5. Regras / validações

- Rejeita arquivo vazio, sem cabeçalho esperado, ou sem colunas de dias
- Data validada contra mês/ano selecionados (ignora dia fora do mês)
- Loja sem match → marcada `LOJA NÃO ENCONTRADA`, não cria automaticamente
- Idempotência via UNIQUE — reimportar não duplica

### 6. Entregáveis

Ao final da importação, retornar (e exibir):
- tabelas usadas: `mk9_checklist_imports`, `mk9_actual_visits`
- nº de visitas importadas / persistidas
- lojas encontradas / não encontradas
- resultado de reimportação (0 novas / N ignoradas)

### Fora de escopo (explicitamente não fazer agora)

- Conciliação com `mk9_planned_visits`
- Alterações no dashboard, roteiros, ou importador MK9 existente
