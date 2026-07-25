// Motor de conciliação MK9. SERVER-ONLY.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  NEAR_DATE_SCORE,
  NEAR_DATE_WINDOW_DAYS,
  type ReconciliationStatus,
  type ReconciliationSummary,
} from "./types";

export interface ReconcileScope {
  operationYear: number;
  operationMonth: number;
  industryId?: string | null;
  sourceImportId?: string | null;
}

type PlannedRow = {
  id: string;
  industry_id: string;
  store_id: string;
  promoter_id: string;
  scheduled_date: string;
};
type ActualRow = {
  id: string;
  industry_id: string;
  store_id: string;
  scheduled_date: string;
  source_import_id: string | null;
};
type ExistingReco = {
  id: string;
  planned_visit_id: string | null;
  actual_visit_id: string | null;
  status: ReconciliationStatus;
  reviewed_manually: boolean;
};

function diffDays(a: string, b: string) {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}

async function loadScope(scope: ReconcileScope) {
  const plannedQ = supabaseAdmin
    .from("mk9_planned_visits")
    .select("id, industry_id, store_id, promoter_id, scheduled_date")
    .gte("scheduled_date", `${scope.operationYear}-${String(scope.operationMonth).padStart(2, "0")}-01`)
    .lt(
      "scheduled_date",
      `${scope.operationMonth === 12 ? scope.operationYear + 1 : scope.operationYear}-${String(
        scope.operationMonth === 12 ? 1 : scope.operationMonth + 1,
      ).padStart(2, "0")}-01`,
    );
  const actualQ = supabaseAdmin
    .from("mk9_actual_visits")
    .select("id, industry_id, store_id, scheduled_date, source_import_id")
    .eq("origin", "CHECKLIST")
    .gte("scheduled_date", `${scope.operationYear}-${String(scope.operationMonth).padStart(2, "0")}-01`)
    .lt(
      "scheduled_date",
      `${scope.operationMonth === 12 ? scope.operationYear + 1 : scope.operationYear}-${String(
        scope.operationMonth === 12 ? 1 : scope.operationMonth + 1,
      ).padStart(2, "0")}-01`,
    );
  if (scope.industryId) {
    plannedQ.eq("industry_id", scope.industryId);
    actualQ.eq("industry_id", scope.industryId);
  }
  const [{ data: planned, error: pErr }, { data: actual, error: aErr }] = await Promise.all([
    plannedQ,
    actualQ,
  ]);
  if (pErr) throw new Error(pErr.message);
  if (aErr) throw new Error(aErr.message);

  const existingQ = supabaseAdmin
    .from("mk9_visit_reconciliations")
    .select("id, planned_visit_id, actual_visit_id, status, reviewed_manually")
    .eq("operation_year", scope.operationYear)
    .eq("operation_month", scope.operationMonth);
  if (scope.industryId) existingQ.eq("industry_id", scope.industryId);
  const { data: existing, error: eErr } = await existingQ;
  if (eErr) throw new Error(eErr.message);

  return {
    planned: (planned ?? []) as PlannedRow[],
    actual: (actual ?? []) as ActualRow[],
    existing: (existing ?? []) as ExistingReco[],
  };
}

async function loadStoreNotFoundFromImports(scope: ReconcileScope) {
  const q = supabaseAdmin
    .from("mk9_checklist_imports")
    .select("id, industry_id, operation_month, operation_year, preview")
    .eq("operation_year", scope.operationYear)
    .eq("operation_month", scope.operationMonth)
    .eq("status", "done");
  if (scope.industryId) q.eq("industry_id", scope.industryId);
  if (scope.sourceImportId) q.eq("id", scope.sourceImportId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows: Array<{
    importId: string;
    industryId: string;
    storeName: string;
    uf: string | null;
    date: string | null;
  }> = [];
  for (const imp of data ?? []) {
    const items = (imp.preview as any)?.items ?? [];
    for (const it of items) {
      if (it.status === "store_not_found") {
        rows.push({
          importId: imp.id as string,
          industryId: imp.industry_id as string,
          storeName: it.storeName ?? "",
          uf: it.uf ?? null,
          date: it.scheduledDate || null,
        });
      }
    }
  }
  return rows;
}

export async function reconcile(scope: ReconcileScope): Promise<ReconciliationSummary> {
  const { planned, actual, existing } = await loadScope(scope);

  // Preserve manual/ignored reconciliations
  const preservedByActual = new Map<string, ExistingReco>();
  const preservedByPlanned = new Map<string, ExistingReco>();
  const preserveIds = new Set<string>();
  for (const r of existing) {
    const isManual =
      r.reviewed_manually || r.status === "MANUALLY_MATCHED" || r.status === "IGNORED";
    if (isManual) {
      preserveIds.add(r.id);
      if (r.actual_visit_id) preservedByActual.set(r.actual_visit_id, r);
      if (r.planned_visit_id) preservedByPlanned.set(r.planned_visit_id, r);
    }
  }

  // Delete automatic (non-preserved) reconciliations in scope
  const toDelete = existing.filter((r) => !preserveIds.has(r.id)).map((r) => r.id);
  if (toDelete.length) {
    const { error } = await supabaseAdmin
      .from("mk9_visit_reconciliations")
      .delete()
      .in("id", toDelete);
    if (error) throw new Error(error.message);
  }

  // Build indices
  const key = (industry: string, store: string, date: string) => `${industry}|${store}|${date}`;
  const plannedByKey = new Map<string, PlannedRow[]>();
  const plannedByStore = new Map<string, PlannedRow[]>(); // industry|store -> planned rows
  for (const p of planned) {
    if (preservedByPlanned.has(p.id)) continue; // manual owns it
    const k = key(p.industry_id, p.store_id, p.scheduled_date);
    (plannedByKey.get(k) ?? plannedByKey.set(k, []).get(k)!)!.push(p);
    const ks = `${p.industry_id}|${p.store_id}`;
    (plannedByStore.get(ks) ?? plannedByStore.set(ks, []).get(ks)!)!.push(p);
  }

  const actualByKey = new Map<string, ActualRow[]>();
  for (const a of actual) {
    if (preservedByActual.has(a.id)) continue;
    const k = key(a.industry_id, a.store_id, a.scheduled_date);
    (actualByKey.get(k) ?? actualByKey.set(k, []).get(k)!)!.push(a);
  }

  const consumedPlanned = new Set<string>();
  const consumedActual = new Set<string>();
  const inserts: any[] = [];

  const baseRow = (extra: Record<string, unknown>) => ({
    operation_month: scope.operationMonth,
    operation_year: scope.operationYear,
    source_import_id: scope.sourceImportId ?? null,
    ...extra,
  });

  // 1) EXACT match
  for (const [k, plist] of plannedByKey) {
    const alist = actualByKey.get(k) ?? [];
    if (plist.length === 1 && alist.length === 1) {
      const p = plist[0];
      const a = alist[0];
      consumedPlanned.add(p.id);
      consumedActual.add(a.id);
      inserts.push(
        baseRow({
          planned_visit_id: p.id,
          actual_visit_id: a.id,
          industry_id: p.industry_id,
          store_id: p.store_id,
          promoter_id: p.promoter_id,
          planned_date: p.scheduled_date,
          actual_date: a.scheduled_date,
          date_diff_days: 0,
          status: "MATCHED",
          match_score: 100,
          match_type: "EXACT",
          source_import_id: a.source_import_id ?? scope.sourceImportId ?? null,
        }),
      );
    }
  }

  // 1b) DUPLICATE_ACTUAL on exact same key (extra actuals beyond first)
  for (const [k, alist] of actualByKey) {
    const plist = plannedByKey.get(k) ?? [];
    if (plist.length === 1 && alist.length > 1) {
      // first was matched above; the rest are duplicates of the same planned
      for (let i = 1; i < alist.length; i++) {
        const a = alist[i];
        if (consumedActual.has(a.id)) continue;
        consumedActual.add(a.id);
        inserts.push(
          baseRow({
            planned_visit_id: plist[0].id,
            actual_visit_id: a.id,
            industry_id: a.industry_id,
            store_id: a.store_id,
            promoter_id: plist[0].promoter_id,
            planned_date: plist[0].scheduled_date,
            actual_date: a.scheduled_date,
            date_diff_days: 0,
            status: "DUPLICATE_ACTUAL",
            match_score: 0,
            match_type: "NONE",
            source_import_id: a.source_import_id ?? scope.sourceImportId ?? null,
          }),
        );
      }
    } else if (plist.length > 1 && alist.length >= 1) {
      // Ambiguous: multiple planned same-key -> mark each unconsumed actual AMBIGUOUS
      for (const a of alist) {
        if (consumedActual.has(a.id)) continue;
        consumedActual.add(a.id);
        inserts.push(
          baseRow({
            planned_visit_id: null,
            actual_visit_id: a.id,
            industry_id: a.industry_id,
            store_id: a.store_id,
            promoter_id: null,
            planned_date: null,
            actual_date: a.scheduled_date,
            date_diff_days: null,
            status: "AMBIGUOUS",
            match_score: 0,
            match_type: "NONE",
            candidates: plist.map((p) => ({ plannedVisitId: p.id, promoterId: p.promoter_id })),
            source_import_id: a.source_import_id ?? scope.sourceImportId ?? null,
          }),
        );
      }
    }
  }

  // 2) NEAR_DATE for remaining actuals
  for (const a of actual) {
    if (consumedActual.has(a.id) || preservedByActual.has(a.id)) continue;
    const candidates = (plannedByStore.get(`${a.industry_id}|${a.store_id}`) ?? []).filter(
      (p) => !consumedPlanned.has(p.id),
    );
    const withinWindow = candidates
      .map((p) => ({ p, diff: diffDays(p.scheduled_date, a.scheduled_date) }))
      .filter((c) => Math.abs(c.diff) >= 1 && Math.abs(c.diff) <= NEAR_DATE_WINDOW_DAYS);

    if (withinWindow.length === 0) {
      consumedActual.add(a.id);
      inserts.push(
        baseRow({
          planned_visit_id: null,
          actual_visit_id: a.id,
          industry_id: a.industry_id,
          store_id: a.store_id,
          promoter_id: null,
          planned_date: null,
          actual_date: a.scheduled_date,
          date_diff_days: null,
          status: "UNPLANNED_VISIT",
          match_score: 0,
          match_type: "NONE",
          source_import_id: a.source_import_id ?? scope.sourceImportId ?? null,
        }),
      );
    } else if (withinWindow.length === 1) {
      const { p, diff } = withinWindow[0];
      consumedPlanned.add(p.id);
      consumedActual.add(a.id);
      const abs = Math.abs(diff);
      inserts.push(
        baseRow({
          planned_visit_id: p.id,
          actual_visit_id: a.id,
          industry_id: p.industry_id,
          store_id: p.store_id,
          promoter_id: p.promoter_id,
          planned_date: p.scheduled_date,
          actual_date: a.scheduled_date,
          date_diff_days: diff,
          status: "DATE_DIVERGENCE",
          match_score: NEAR_DATE_SCORE[abs] ?? 60,
          match_type: "NEAR_DATE",
          source_import_id: a.source_import_id ?? scope.sourceImportId ?? null,
        }),
      );
    } else {
      consumedActual.add(a.id);
      inserts.push(
        baseRow({
          planned_visit_id: null,
          actual_visit_id: a.id,
          industry_id: a.industry_id,
          store_id: a.store_id,
          promoter_id: null,
          planned_date: null,
          actual_date: a.scheduled_date,
          date_diff_days: null,
          status: "AMBIGUOUS",
          match_score: 0,
          match_type: "NONE",
          candidates: withinWindow.map((c) => ({
            plannedVisitId: c.p.id,
            promoterId: c.p.promoter_id,
            plannedDate: c.p.scheduled_date,
            diffDays: c.diff,
          })),
          source_import_id: a.source_import_id ?? scope.sourceImportId ?? null,
        }),
      );
    }
  }

  // 3) NOT_COMPLETED: planejadas restantes
  for (const p of planned) {
    if (consumedPlanned.has(p.id) || preservedByPlanned.has(p.id)) continue;
    inserts.push(
      baseRow({
        planned_visit_id: p.id,
        actual_visit_id: null,
        industry_id: p.industry_id,
        store_id: p.store_id,
        promoter_id: p.promoter_id,
        planned_date: p.scheduled_date,
        actual_date: null,
        date_diff_days: null,
        status: "NOT_COMPLETED",
        match_score: 0,
        match_type: "NONE",
      }),
    );
  }

  // 4) STORE_NOT_FOUND a partir das prévias de importações no escopo
  const snf = await loadStoreNotFoundFromImports(scope);
  for (const s of snf) {
    inserts.push(
      baseRow({
        planned_visit_id: null,
        actual_visit_id: null,
        industry_id: s.industryId,
        store_id: null,
        promoter_id: null,
        planned_date: null,
        actual_date: s.date,
        date_diff_days: null,
        status: "STORE_NOT_FOUND",
        match_score: 0,
        match_type: "NONE",
        raw_store_name: s.storeName,
        raw_store_uf: s.uf,
        source_import_id: s.importId,
      }),
    );
  }

  // Insere em lotes
  const CHUNK = 500;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const slice = inserts.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin.from("mk9_visit_reconciliations").insert(slice);
    if (error) throw new Error(error.message);
  }

  return summarize(scope);
}

export async function summarize(scope: ReconcileScope): Promise<ReconciliationSummary> {
  const q = supabaseAdmin
    .from("mk9_visit_reconciliations")
    .select("status")
    .eq("operation_year", scope.operationYear)
    .eq("operation_month", scope.operationMonth);
  if (scope.industryId) q.eq("industry_id", scope.industryId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const counts: Record<string, number> = {};
  for (const r of data ?? []) counts[r.status as string] = (counts[r.status as string] ?? 0) + 1;

  const plannedQ = supabaseAdmin
    .from("mk9_planned_visits")
    .select("id", { count: "exact", head: true })
    .gte("scheduled_date", `${scope.operationYear}-${String(scope.operationMonth).padStart(2, "0")}-01`)
    .lt(
      "scheduled_date",
      `${scope.operationMonth === 12 ? scope.operationYear + 1 : scope.operationYear}-${String(
        scope.operationMonth === 12 ? 1 : scope.operationMonth + 1,
      ).padStart(2, "0")}-01`,
    );
  const actualQ = supabaseAdmin
    .from("mk9_actual_visits")
    .select("id", { count: "exact", head: true })
    .eq("origin", "CHECKLIST")
    .gte("scheduled_date", `${scope.operationYear}-${String(scope.operationMonth).padStart(2, "0")}-01`)
    .lt(
      "scheduled_date",
      `${scope.operationMonth === 12 ? scope.operationYear + 1 : scope.operationYear}-${String(
        scope.operationMonth === 12 ? 1 : scope.operationMonth + 1,
      ).padStart(2, "0")}-01`,
    );
  if (scope.industryId) {
    plannedQ.eq("industry_id", scope.industryId);
    actualQ.eq("industry_id", scope.industryId);
  }
  const [{ count: plannedCount }, { count: actualCount }] = await Promise.all([plannedQ, actualQ]);

  const matched = counts["MATCHED"] ?? 0;
  const dateDiv = counts["DATE_DIVERGENCE"] ?? 0;
  const manual = counts["MANUALLY_MATCHED"] ?? 0;
  const planned = plannedCount ?? 0;
  const covered = matched + dateDiv + manual;
  const coveragePct = planned > 0 ? Math.round((covered / planned) * 1000) / 10 : 0;

  return {
    planned,
    actual: actualCount ?? 0,
    matched,
    dateDivergence: dateDiv,
    unplanned: counts["UNPLANNED_VISIT"] ?? 0,
    notCompleted: counts["NOT_COMPLETED"] ?? 0,
    ambiguous: counts["AMBIGUOUS"] ?? 0,
    storeNotFound: counts["STORE_NOT_FOUND"] ?? 0,
    duplicate: counts["DUPLICATE_ACTUAL"] ?? 0,
    manuallyMatched: manual,
    ignored: counts["IGNORED"] ?? 0,
    coveragePct,
  };
}

// ============ REVISÃO MANUAL ============

export async function manualMatch(input: {
  actualVisitId: string;
  plannedVisitId: string;
  reviewedBy?: string | null;
  notes?: string | null;
}) {
  const { data: actual, error: aErr } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("id, industry_id, store_id, scheduled_date, source_import_id")
    .eq("id", input.actualVisitId)
    .single();
  if (aErr) throw new Error(aErr.message);
  const { data: planned, error: pErr } = await supabaseAdmin
    .from("mk9_planned_visits")
    .select("id, industry_id, store_id, promoter_id, scheduled_date")
    .eq("id", input.plannedVisitId)
    .single();
  if (pErr) throw new Error(pErr.message);

  const d = new Date(actual.scheduled_date + "T00:00:00Z");
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();
  const diff = diffDays(planned.scheduled_date, actual.scheduled_date);

  // remove existing rows tied to either side
  await supabaseAdmin
    .from("mk9_visit_reconciliations")
    .delete()
    .or(`actual_visit_id.eq.${input.actualVisitId},planned_visit_id.eq.${input.plannedVisitId}`);

  const { error } = await supabaseAdmin.from("mk9_visit_reconciliations").insert({
    planned_visit_id: planned.id,
    actual_visit_id: actual.id,
    industry_id: planned.industry_id,
    store_id: planned.store_id,
    promoter_id: planned.promoter_id,
    operation_month: month,
    operation_year: year,
    planned_date: planned.scheduled_date,
    actual_date: actual.scheduled_date,
    date_diff_days: diff,
    status: "MANUALLY_MATCHED",
    match_score: 100,
    match_type: "MANUAL",
    reviewed_manually: true,
    reviewed_by: input.reviewedBy ?? null,
    reviewed_at: new Date().toISOString(),
    notes: input.notes ?? null,
    source_import_id: actual.source_import_id ?? null,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function markIgnored(input: {
  reconciliationId: string;
  reviewedBy?: string | null;
  notes?: string | null;
}) {
  const { error } = await supabaseAdmin
    .from("mk9_visit_reconciliations")
    .update({
      status: "IGNORED",
      reviewed_manually: true,
      reviewed_by: input.reviewedBy ?? null,
      reviewed_at: new Date().toISOString(),
      notes: input.notes ?? null,
    })
    .eq("id", input.reconciliationId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function undoReview(reconciliationId: string) {
  const { error } = await supabaseAdmin
    .from("mk9_visit_reconciliations")
    .update({ reviewed_manually: false, reviewed_by: null, reviewed_at: null, notes: null })
    .eq("id", reconciliationId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function listReconciliations(scope: ReconcileScope, limit = 500) {
  const q = supabaseAdmin
    .from("mk9_visit_reconciliations")
    .select(
      "id, status, match_score, match_type, planned_date, actual_date, date_diff_days, reviewed_manually, raw_store_name, raw_store_uf, notes, industry:mk9_industries(id,name), store:mk9_stores(id,name,uf), promoter:mk9_promoters(id,name), planned_visit_id, actual_visit_id, source_import_id",
    )
    .eq("operation_year", scope.operationYear)
    .eq("operation_month", scope.operationMonth)
    .order("status", { ascending: true })
    .limit(limit);
  if (scope.industryId) q.eq("industry_id", scope.industryId);
  if (scope.sourceImportId) q.eq("source_import_id", scope.sourceImportId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}
