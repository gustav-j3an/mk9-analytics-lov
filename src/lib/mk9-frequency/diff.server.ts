// Motor de diff de frequências contratadas — SERVER-ONLY (Fase 1B.2).
//
// Regras (mesma filosofia do módulo de Roteiros):
//   1. mk9_industry_store_frequency_versions é a ÚNICA fonte de escrita.
//   2. mk9_industry_store_frequency é apenas projeção da versão vigente.
//   3. Nunca UPDATE de valores: sempre encerra vigência + cria nova versão.
//   4. Nunca DELETE: remoção da planilha encerra vigência.
//   5. Alteração manual vigente nunca é sobrescrita silenciosamente.
//   6. Versão futura nunca é destruída.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  FrequencyApplyResult,
  FrequencyDiffItem,
  FrequencyDiffReport,
  IncomingFrequency,
} from "./types";

interface DbVersionRow {
  id: string;
  industry_id: string;
  store_id: string;
  weekly_frequency: number | null;
  monthly_frequency: number | null;
  valid_from: string;
  valid_until: string | null;
  archived_at: string | null;
  source_type: string;
  source_import_id: string | null;
}

export function firstDayOfCompetency(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

const num = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

const sameValue = (a: number | null, b: number | null) => num(a) === num(b);

function coversDate(row: DbVersionRow, date: string): boolean {
  if (row.archived_at) return false;
  if (row.valid_from > date) return false;
  if (row.valid_until && row.valid_until < date) return false;
  return true;
}

// Dedup por loja: quando linhas distintas do Excel apontam para a mesma loja,
// soma para preservar o total contratado da planilha (comportamento herdado).
export function dedupIncoming(rows: IncomingFrequency[]): IncomingFrequency[] {
  const map = new Map<string, IncomingFrequency>();
  for (const r of rows) {
    const prev = map.get(r.storeId);
    const weekly = num(r.weeklyFrequency);
    const monthly = num(r.monthlyFrequency);
    map.set(r.storeId, {
      storeId: r.storeId,
      weeklyFrequency:
        weekly != null || prev?.weeklyFrequency != null
          ? (prev?.weeklyFrequency ?? 0) + (weekly ?? 0)
          : null,
      monthlyFrequency:
        monthly != null || prev?.monthlyFrequency != null
          ? (prev?.monthlyFrequency ?? 0) + (monthly ?? 0)
          : null,
    });
  }
  // A tabela de versões exige ao menos um valor não nulo.
  return Array.from(map.values()).filter(
    (r) => r.weeklyFrequency != null || r.monthlyFrequency != null,
  );
}

export async function buildFrequencyDiff(
  industryId: string,
  incoming: IncomingFrequency[],
  operationMonth: number,
  operationYear: number,
): Promise<FrequencyDiffReport> {
  const competencyStart = firstDayOfCompetency(operationMonth, operationYear);
  const rows = dedupIncoming(incoming);

  const { data, error } = await supabaseAdmin
    .from("mk9_industry_store_frequency_versions")
    .select(
      "id,industry_id,store_id,weekly_frequency,monthly_frequency,valid_from,valid_until,archived_at,source_type,source_import_id",
    )
    .eq("industry_id", industryId)
    .is("archived_at", null);
  if (error) throw error;
  const dbRows = ((data ?? []) as unknown as DbVersionRow[]).filter((r) => !r.archived_at);

  const byStore = new Map<string, DbVersionRow[]>();
  for (const r of dbRows) {
    if (!byStore.has(r.store_id)) byStore.set(r.store_id, []);
    byStore.get(r.store_id)!.push(r);
  }

  const storeIds = Array.from(new Set([...rows.map((r) => r.storeId), ...byStore.keys()]));
  const names = new Map<string, { name: string; uf: string | null }>();
  if (storeIds.length) {
    const { data: sData } = await supabaseAdmin
      .from("mk9_stores")
      .select("id,name,uf")
      .in("id", storeIds);
    for (const s of (sData ?? []) as any[]) names.set(s.id, { name: s.name, uf: s.uf ?? null });
  }

  const items: FrequencyDiffItem[] = [];
  const seen = new Set<string>();

  const mkItem = (
    kind: FrequencyDiffItem["kind"],
    storeId: string,
    current: DbVersionRow | null,
    inc: IncomingFrequency | null,
    reason?: string,
  ): FrequencyDiffItem => ({
    kind,
    storeId,
    storeName: names.get(storeId)?.name ?? null,
    storeUf: names.get(storeId)?.uf ?? null,
    currentVersionId: current?.id ?? null,
    currentSourceType: current?.source_type ?? null,
    currentWeekly: num(current?.weekly_frequency ?? null),
    currentMonthly: num(current?.monthly_frequency ?? null),
    incomingWeekly: num(inc?.weeklyFrequency ?? null),
    incomingMonthly: num(inc?.monthlyFrequency ?? null),
    newVersion: inc
      ? {
          industry_id: industryId,
          store_id: storeId,
          weekly_frequency: num(inc.weeklyFrequency),
          monthly_frequency: num(inc.monthlyFrequency),
        }
      : null,
    competencyStart,
    reason,
  });

  for (const inc of rows) {
    seen.add(inc.storeId);
    const versions = byStore.get(inc.storeId) ?? [];
    const current = versions.find((v) => coversDate(v, competencyStart)) ?? null;
    const future = versions.filter((v) => v.valid_from > competencyStart);

    if (current && current.source_type === "MANUAL") {
      items.push(
        mkItem(
          "MANUAL_CONFLICT",
          inc.storeId,
          current,
          inc,
          "Versão vigente foi editada manualmente no sistema.",
        ),
      );
      continue;
    }
    if (future.length > 0) {
      items.push(
        mkItem(
          "FUTURE_VERSION_CONFLICT",
          inc.storeId,
          current ?? future[0],
          inc,
          `Existe versão futura começando em ${future[0].valid_from}.`,
        ),
      );
      continue;
    }
    if (
      current &&
      sameValue(current.weekly_frequency, inc.weeklyFrequency) &&
      sameValue(current.monthly_frequency, inc.monthlyFrequency)
    ) {
      items.push(mkItem("UNCHANGED", inc.storeId, current, inc));
      continue;
    }
    if (current) {
      items.push(mkItem("CHANGED_FREQUENCY", inc.storeId, current, inc));
      continue;
    }
    items.push(mkItem("NEW_FREQUENCY", inc.storeId, null, inc));
  }

  // Frequências vigentes que sumiram da planilha → encerrar vigência.
  for (const [storeId, versions] of byStore) {
    if (seen.has(storeId)) continue;
    const current = versions.find((v) => coversDate(v, competencyStart));
    if (!current) continue;
    if (current.source_type === "MANUAL") continue; // manual sempre preservado
    items.push(
      mkItem("REMOVED_FROM_IMPORT", storeId, current, null, "Loja ausente na planilha importada."),
    );
  }

  const count = (k: FrequencyDiffItem["kind"]) => items.filter((i) => i.kind === k).length;
  return {
    competencyStart,
    totalIncoming: rows.length,
    unchanged: count("UNCHANGED"),
    new: count("NEW_FREQUENCY"),
    changed: count("CHANGED_FREQUENCY"),
    removed: count("REMOVED_FROM_IMPORT"),
    manualConflicts: count("MANUAL_CONFLICT"),
    futureConflicts: count("FUTURE_VERSION_CONFLICT"),
    items,
  };
}

// Aplica o diff via RPC transacional (rollback total em qualquer falha).
export async function applyFrequencyDiff(
  importId: string,
  report: FrequencyDiffReport,
  options: { force: boolean; reason?: string | null; actorId?: string | null },
): Promise<FrequencyApplyResult> {
  const decisions = report.items.map((i) => ({
    kind: i.kind,
    current_version_id: i.currentVersionId,
    new_version: i.newVersion,
    competency_start: i.competencyStart,
  }));
  const { data, error } = await supabaseAdmin.rpc("mk9_apply_frequency_diff" as any, {
    _import_id: importId,
    _decisions: decisions as any,
    _force: options.force,
    _reason: options.reason ?? null,
    _actor: options.actorId ?? null,
  });
  if (error) throw error;
  return data as unknown as FrequencyApplyResult;
}
