// Engine de agregação do Relatório da Indústria.
// Fonte de "visitas contratadas" = roteiro planejado dentro do período (regra escolhida).
import type { PeriodWindow } from "./period.server";

export type StoreStatus =
  | "ATENDIDA_INTEGRAL"
  | "ATENDIDA_PARCIAL"
  | "NAO_ATENDIDA"
  | "ACIMA_FREQUENCIA"
  | "FORA_ROTEIRO";

export const STORE_STATUS_LABEL: Record<StoreStatus, string> = {
  ATENDIDA_INTEGRAL: "Atendida integralmente",
  ATENDIDA_PARCIAL: "Atendida parcialmente",
  NAO_ATENDIDA: "Não atendida",
  ACIMA_FREQUENCIA: "Acima da frequência",
  FORA_ROTEIRO: "Fora do roteiro",
};

export interface StoreLine {
  storeId: string;
  storeName: string;
  chain: string | null;
  uf: string | null;
  expected: number;
  actual: number;
  validForCoverage: number;
  extra: number;
  pending: number;
  coveragePct: number;
  actualDates: string[];
  status: StoreStatus;
}

export interface UfLine {
  uf: string;
  stores: number;
  expected: number;
  actual: number;
  validForCoverage: number;
  extra: number;
  pending: number;
  coveragePct: number;
}

export interface IndustryReportInput {
  industryId: string;
  year: number;
  month: number;
  uf?: string | null;
  storeId?: string | null;
  sourceImportId?: string | null;
  includePromoter?: boolean;
}

export interface IndustryReport {
  industry: { id: string; name: string };
  window: { startDate: string; endDate: string; totalDays: number };
  filters: { uf: string | null; storeId: string | null; sourceImportId: string | null };
  totals: {
    totalStores: number;
    contracted: number; // = planejadas no roteiro dentro do período
    planned: number; // mesma fonte da contratada: roteiro planejado
    actual: number;
    validForContractCoverage: number;
    extra: number;
    pending: number;
    divergent: number;
    unplanned: number;
    contractualCoveragePct: number;
    operationalCoveragePct: number;
    coveragePct: number; // alias para compatibilidade visual = cobertura contratual
  };
  stores: StoreLine[];
  ufs: UfLine[];
  actualDatesByStore: Record<string, string[]>;
  generatedAt: string;
}

export async function buildIndustryReport(
  supabase: any,
  input: IndustryReportInput,
  window: PeriodWindow,
): Promise<IndustryReport> {
  const { industryId, uf, storeId, sourceImportId } = input;

  // 1) Indústria
  const { data: industry, error: eInd } = await supabase
    .from("mk9_industries")
    .select("id, name")
    .eq("id", industryId)
    .maybeSingle();
  if (eInd) throw new Error(eInd.message);
  if (!industry) throw new Error("Indústria não encontrada");

  // 2) Visitas planejadas (roteiro) na janela
  let plannedQ = supabase
    .from("mk9_planned_visits")
    .select("id, scheduled_date, store_id, store:mk9_stores(id,name,chain,uf)")
    .eq("industry_id", industryId)
    .gte("scheduled_date", window.startDate)
    .lte("scheduled_date", window.endDate)
    .limit(20000);
  if (storeId) plannedQ = plannedQ.eq("store_id", storeId);
  const { data: planned, error: ePl } = await plannedQ;
  if (ePl) throw new Error(ePl.message);

  // 3) Visitas realizadas na janela
  let actualQ = supabase
    .from("mk9_actual_visits")
    .select("id, scheduled_date, store_id, source_import_id, store:mk9_stores(id,name,chain,uf)")
    .eq("industry_id", industryId)
    .gte("scheduled_date", window.startDate)
    .lte("scheduled_date", window.endDate)
    .limit(20000);
  if (storeId) actualQ = actualQ.eq("store_id", storeId);
  if (sourceImportId) actualQ = actualQ.eq("source_import_id", sourceImportId);
  const { data: actuals, error: eAc } = await actualQ;
  if (eAc) throw new Error(eAc.message);

  // 4) Reconciliações no período (para contagem de divergentes/fora do roteiro)
  const { data: recs, error: eRe } = await supabase
    .from("mk9_visit_reconciliations")
    .select("status, store_id, planned_visit_id, actual_visit_id, source_import_id")
    .eq("industry_id", industryId)
    .eq("operation_year", input.year)
    .eq("operation_month", input.month)
    .limit(20000);
  if (sourceImportId) recs.eq("source_import_id", sourceImportId);
  if (storeId) recs.eq("store_id", storeId);
  if (eRe) throw new Error(eRe.message);

  // Agrega por loja
  type Bucket = {
    storeId: string;
    storeName: string;
    chain: string | null;
    uf: string | null;
    expected: number;
    actual: number;
    actualDates: Set<string>;
  };
  const map = new Map<string, Bucket>();
  const touch = (id: string, r: { name?: string | null; chain?: string | null; uf?: string | null } | null | undefined) => {
    let b = map.get(id);
    if (!b) {
      b = {
        storeId: id,
        storeName: r?.name ?? "—",
        chain: r?.chain ?? null,
        uf: r?.uf ?? null,
        expected: 0,
        actual: 0,
        actualDates: new Set<string>(),
      };
      map.set(id, b);
    } else if (!b.storeName || b.storeName === "—") {
      b.storeName = r?.name ?? b.storeName;
      b.chain = b.chain ?? r?.chain ?? null;
      b.uf = b.uf ?? r?.uf ?? null;
    }
    return b;
  };

  for (const p of planned ?? []) {
    if (!p.store_id) continue;
    if (uf && p.store?.uf !== uf) continue;
    const b = touch(p.store_id, p.store);
    b.expected += 1;
  }
  for (const a of actuals ?? []) {
    if (!a.store_id) continue;
    if (uf && a.store?.uf !== uf) continue;
    const b = touch(a.store_id, a.store);
    b.actual += 1;
    if (a.scheduled_date) b.actualDates.add(a.scheduled_date as string);
  }

  // Monta linhas
  const plannedIdsInReport = new Set<string>();
  for (const p of planned ?? []) {
    if (!p.id) continue;
    if (storeId && p.store_id !== storeId) continue;
    if (uf && p.store?.uf !== uf) continue;
    plannedIdsInReport.add(p.id as string);
  }

  const stores: StoreLine[] = Array.from(map.values()).map((b) => {
    const validForCoverage = Math.min(b.actual, b.expected);
    const extra = Math.max(0, b.actual - b.expected);
    const pending = Math.max(0, b.expected - validForCoverage);
    const coveragePct = b.expected > 0 ? Math.round((validForCoverage / b.expected) * 100) : 0;
    let status: StoreStatus;
    if (b.expected === 0 && b.actual > 0) status = "FORA_ROTEIRO";
    else if (b.expected === 0 && b.actual === 0) status = "NAO_ATENDIDA";
    else if (b.actual >= b.expected && b.actual > b.expected) status = "ACIMA_FREQUENCIA";
    else if (b.actual >= b.expected) status = "ATENDIDA_INTEGRAL";
    else if (b.actual === 0) status = "NAO_ATENDIDA";
    else status = "ATENDIDA_PARCIAL";
    return {
      storeId: b.storeId,
      storeName: b.storeName,
      chain: b.chain,
      uf: b.uf,
      expected: b.expected,
      actual: b.actual,
      validForCoverage,
      extra,
      pending,
      coveragePct,
      actualDates: Array.from(b.actualDates).sort(),
      status,
    };
  });
  stores.sort((a, z) => a.storeName.localeCompare(z.storeName, "pt-BR"));

  // Totais
  const contracted = stores.reduce((s, x) => s + x.expected, 0);
  const actual = stores.reduce((s, x) => s + x.actual, 0);
  const validForContractCoverage = stores.reduce((s, x) => s + x.validForCoverage, 0);
  const extra = stores.reduce((s, x) => s + x.extra, 0);
  const pending = stores.reduce((s, x) => s + x.pending, 0);
  const divergent = (recs ?? []).filter((r: any) => r.status === "DATE_DIVERGENCE").length;
  const unplanned = (recs ?? []).filter((r: any) => r.status === "UNPLANNED_VISIT").length;
  const reconciledPlannedIds = new Set<string>();
  for (const r of recs ?? []) {
    const plannedVisitId = r.planned_visit_id as string | null;
    const actualVisitId = r.actual_visit_id as string | null;
    const status = r.status as string;
    if (!plannedVisitId || !actualVisitId) continue;
    if (!plannedIdsInReport.has(plannedVisitId)) continue;
    if (status === "IGNORED" || status === "NOT_COMPLETED" || status === "DUPLICATE_ACTUAL") continue;
    reconciledPlannedIds.add(plannedVisitId);
  }
  const contractualCoveragePct = contracted > 0 ? Math.round((validForContractCoverage / contracted) * 100) : 0;
  const operationalCoveragePct = contracted > 0 ? Math.round((reconciledPlannedIds.size / contracted) * 100) : 0;
  const coveragePct = contractualCoveragePct;

  // Por UF
  const ufMap = new Map<string, UfLine>();
  for (const s of stores) {
    const key = s.uf ?? "—";
    const cur = ufMap.get(key) ?? { uf: key, stores: 0, expected: 0, actual: 0, validForCoverage: 0, extra: 0, pending: 0, coveragePct: 0 };
    cur.stores += 1;
    cur.expected += s.expected;
    cur.actual += s.actual;
    cur.validForCoverage += s.validForCoverage;
    cur.extra += s.extra;
    cur.pending += s.pending;
    ufMap.set(key, cur);
  }
  const ufs: UfLine[] = Array.from(ufMap.values())
    .map((u) => ({ ...u, coveragePct: u.expected > 0 ? Math.round((u.validForCoverage / u.expected) * 100) : 0 }))
    .sort((a, b) => a.uf.localeCompare(b.uf));

  const actualDatesByStore: Record<string, string[]> = {};
  for (const s of stores) actualDatesByStore[s.storeId] = s.actualDates;

  return {
    industry: { id: industry.id, name: industry.name },
    window: { startDate: window.startDate, endDate: window.endDate, totalDays: window.totalDays },
    filters: { uf: uf ?? null, storeId: storeId ?? null, sourceImportId: sourceImportId ?? null },
    totals: {
      totalStores: stores.length,
      contracted,
      planned: contracted,
      actual,
      validForContractCoverage,
      extra,
      pending,
      divergent,
      unplanned,
      contractualCoveragePct,
      operationalCoveragePct,
      coveragePct,
    },
    stores,
    ufs,
    actualDatesByStore,
    generatedAt: new Date().toISOString(),
  };
}
