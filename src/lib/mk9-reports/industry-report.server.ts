// Engine de agregação do Relatório da Indústria.
//
// Fonte ÚNICA das "visitas contratadas" por loja: cadastro de frequência da
// indústria (mk9_industry_store_frequency). A existência ou ausência de
// roteiro planejado NÃO altera o valor contratado — o roteiro é somente
// auditoria (routeStatus). Extras de uma loja não compensam pendências de
// outra.
//
// Escala pelo período REAL da competência (não pelo mês fixo):
//   weekly  → round(weekly  * totalDays / 7)
//   monthly → round(monthly * totalDays / 30)
// Cobertura é limitada a 100 % (já garantido por validas = min(contr., exec.)).
import type { PeriodWindow } from "./period.server";
import { aggregateVisitMetrics, computeVisitMetrics, type VisitMetrics } from "./metrics";


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

export type ExecutionStatus = "OK" | "PARCIAL" | "NAO_REALIZADA";
export const EXECUTION_STATUS_LABEL: Record<ExecutionStatus, string> = {
  OK: "OK",
  PARCIAL: "Parcial",
  NAO_REALIZADA: "Não realizada",
};

export type RouteStatus = "DENTRO_ROTEIRO" | "FORA_ROTEIRO" | "SEM_ROTEIRO";
export const ROUTE_STATUS_LABEL: Record<RouteStatus, string> = {
  DENTRO_ROTEIRO: "Dentro do roteiro",
  FORA_ROTEIRO: "Fora do roteiro",
  SEM_ROTEIRO: "Sem roteiro",
};

export type ContractedSource = "WEEKLY_FREQUENCY" | "MONTHLY_FREQUENCY" | "NONE";

export interface StoreLine {
  storeId: string;
  storeName: string;
  chain: string | null;
  uf: string | null;
  expected: number;          // alias legado de contratadas
  actual: number;            // alias legado de executadas
  validForCoverage: number;  // alias legado de validas
  extra: number;             // alias legado de extras
  pending: number;           // alias legado de pendencias
  coveragePct: number;       // alias legado, limitado a 100
  actualDates: string[];
  status: StoreStatus;                 // status legado (execução + roteiro combinados)
  executionStatus: ExecutionStatus;    // novo: OK / Parcial / Não realizada
  routeStatus: RouteStatus;            // novo: Dentro / Fora / Sem roteiro
  contractedSource: ContractedSource;  // origem da métrica contratada
  weeklyFrequency: number | null;
  monthlyFrequency: number | null;
  plannedCount: number;
  metrics: VisitMetrics;
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
  metrics: VisitMetrics;
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
  window: { startDate: string; endDate: string; totalDays: number; weeks: number };
  filters: { uf: string | null; storeId: string | null; sourceImportId: string | null };
  totals: {
    totalStores: number;
    contracted: number;
    planned: number;
    actual: number;
    validForContractCoverage: number;
    extra: number;
    pending: number;
    divergent: number;
    unplanned: number;
    contractualCoveragePct: number;
    operationalCoveragePct: number;
    coveragePct: number;
    metrics: VisitMetrics;
    execution: { ok: number; parcial: number; naoRealizada: number };
    route: { dentro: number; fora: number; sem: number };
  };
  stores: StoreLine[];
  ufs: UfLine[];
  actualDatesByStore: Record<string, string[]>;
  generatedAt: string;
}

/** Semanas no período (arredondado). Mín. 1. */
function weeksInWindow(window: PeriodWindow): number {
  return Math.max(1, Math.round(window.totalDays / 7));
}

/**
 * Contratadas por loja a partir da frequência cadastrada, escalada pelo
 * período REAL da competência. Nunca negativo. Nunca usa roteiro.
 */
function contractedFromFrequency(
  weekly: number | null,
  monthly: number | null,
  totalDays: number,
): { contratadas: number; source: ContractedSource } {
  const days = Math.max(1, totalDays);
  if (weekly != null && Number.isFinite(weekly) && weekly > 0) {
    return { contratadas: Math.max(0, Math.round(weekly * (days / 7))), source: "WEEKLY_FREQUENCY" };
  }
  if (monthly != null && Number.isFinite(monthly) && monthly > 0) {
    return { contratadas: Math.max(0, Math.round(monthly * (days / 30))), source: "MONTHLY_FREQUENCY" };
  }
  return { contratadas: 0, source: "NONE" };
}


export async function buildIndustryReport(
  supabase: any,
  input: IndustryReportInput,
  window: PeriodWindow,
): Promise<IndustryReport> {
  const { industryId, uf, storeId, sourceImportId } = input;
  const weeks = weeksInWindow(window);

  // 1) Indústria
  const { data: industry, error: eInd } = await supabase
    .from("mk9_industries")
    .select("id, name")
    .eq("id", industryId)
    .maybeSingle();
  if (eInd) throw new Error(eInd.message);
  if (!industry) throw new Error("Indústria não encontrada");

  // 2) Frequência por loja (fonte principal de "contratadas")
  let freqQ = supabase
    .from("mk9_industry_store_frequency")
    .select("store_id, weekly_frequency, monthly_frequency, store:mk9_stores(id,name,chain,uf)")
    .eq("industry_id", industryId)
    .limit(20000);
  if (storeId) freqQ = freqQ.eq("store_id", storeId);
  const { data: freqs, error: eFq } = await freqQ;
  if (eFq) throw new Error(eFq.message);

  // 3) Roteiro planejado (usado para status_roteiro e como fallback de contratadas)
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

  // 4) Visitas realizadas no período (checklist)
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

  // 5) Reconciliações no período
  let recQ = supabase
    .from("mk9_visit_reconciliations")
    .select("status, store_id, planned_visit_id, actual_visit_id, source_import_id")
    .eq("industry_id", industryId)
    .eq("operation_year", input.year)
    .eq("operation_month", input.month)
    .limit(20000);
  if (sourceImportId) recQ = recQ.eq("source_import_id", sourceImportId);
  if (storeId) recQ = recQ.eq("store_id", storeId);
  const { data: recs, error: eRe } = await recQ;
  if (eRe) throw new Error(eRe.message);

  // -------- Agregação por loja --------
  type Bucket = {
    storeId: string;
    storeName: string;
    chain: string | null;
    uf: string | null;
    weekly: number | null;
    monthly: number | null;
    plannedCount: number;
    actual: number;
    actualDates: Set<string>;
  };
  const map = new Map<string, Bucket>();
  const touch = (
    id: string,
    r: { name?: string | null; chain?: string | null; uf?: string | null } | null | undefined,
  ) => {
    let b = map.get(id);
    if (!b) {
      b = {
        storeId: id,
        storeName: r?.name ?? "—",
        chain: r?.chain ?? null,
        uf: r?.uf ?? null,
        weekly: null,
        monthly: null,
        plannedCount: 0,
        actual: 0,
        actualDates: new Set<string>(),
      };
      map.set(id, b);
    } else {
      if (!b.storeName || b.storeName === "—") b.storeName = r?.name ?? b.storeName;
      if (!b.chain) b.chain = r?.chain ?? null;
      if (!b.uf) b.uf = r?.uf ?? null;
    }
    return b;
  };

  // Frequência cadastrada (nunca filtrar por UF antes de existir a loja no bucket)
  for (const f of freqs ?? []) {
    if (!f.store_id) continue;
    if (uf && f.store?.uf !== uf) continue;
    const b = touch(f.store_id, f.store);
    b.weekly = (f.weekly_frequency as number | null) ?? b.weekly;
    b.monthly = (f.monthly_frequency as number | null) ?? b.monthly;
  }
  for (const p of planned ?? []) {
    if (!p.store_id) continue;
    if (uf && p.store?.uf !== uf) continue;
    const b = touch(p.store_id, p.store);
    b.plannedCount += 1;
  }
  for (const a of actuals ?? []) {
    if (!a.store_id) continue;
    if (uf && a.store?.uf !== uf) continue;
    const b = touch(a.store_id, a.store);
    b.actual += 1;
    if (a.scheduled_date) b.actualDates.add(a.scheduled_date as string);
  }

  // Ids de rotas planejadas dentro do escopo (para cobertura operacional)
  const plannedIdsInReport = new Set<string>();
  for (const p of planned ?? []) {
    if (!p.id) continue;
    if (storeId && p.store_id !== storeId) continue;
    if (uf && p.store?.uf !== uf) continue;
    plannedIdsInReport.add(p.id as string);
  }

  // Monta linhas por loja
  const stores: StoreLine[] = Array.from(map.values()).map((b) => {
    // Contratadas: frequência > rota planejada > 0
    const fromFreq = contractedFromFrequency(b.weekly, b.monthly, weeks);
    let contratadas = fromFreq.contratadas;
    let source: ContractedSource = fromFreq.source;
    if (contratadas === 0 && b.plannedCount > 0) {
      contratadas = b.plannedCount;
      source = "PLANNED_ROUTE";
    }
    const m = computeVisitMetrics({ contratadas, executadas: b.actual });

    // status_execucao (independe de roteiro)
    const executionStatus: ExecutionStatus =
      contratadas === 0 && b.actual === 0
        ? "NAO_REALIZADA"
        : m.executadas === 0
          ? "NAO_REALIZADA"
          : m.executadas >= m.contratadas && m.contratadas > 0
            ? "OK"
            : "PARCIAL";

    // status_roteiro (fonte separada)
    const routeStatus: RouteStatus =
      b.plannedCount > 0
        ? "DENTRO_ROTEIRO"
        : b.actual > 0
          ? "FORA_ROTEIRO"
          : "SEM_ROTEIRO";

    // status legado (usado no PDF antigo): combina execução + roteiro
    let legacy: StoreStatus;
    if (routeStatus === "FORA_ROTEIRO") legacy = "FORA_ROTEIRO";
    else if (m.extras > 0) legacy = "ACIMA_FREQUENCIA";
    else if (executionStatus === "OK") legacy = "ATENDIDA_INTEGRAL";
    else if (executionStatus === "PARCIAL") legacy = "ATENDIDA_PARCIAL";
    else legacy = "NAO_ATENDIDA";

    return {
      storeId: b.storeId,
      storeName: b.storeName,
      chain: b.chain,
      uf: b.uf,
      expected: m.contratadas,
      actual: m.executadas,
      validForCoverage: m.validas,
      extra: m.extras,
      pending: m.pendencias,
      coveragePct: m.coberturaPct,
      actualDates: Array.from(b.actualDates).sort(),
      status: legacy,
      executionStatus,
      routeStatus,
      contractedSource: source,
      weeklyFrequency: b.weekly,
      monthlyFrequency: b.monthly,
      plannedCount: b.plannedCount,
      metrics: m,
    };
  });
  stores.sort((a, z) => a.storeName.localeCompare(z.storeName, "pt-BR"));
  const storeIdsInReport = new Set(stores.map((s) => s.storeId));
  const recRows = (recs ?? []).filter((r: any) => !r.store_id || storeIdsInReport.has(r.store_id as string));

  // Totais canônicos via camada de métricas
  const totalsMetrics = aggregateVisitMetrics(
    stores.map((s) => ({ contratadas: s.metrics.contratadas, executadas: s.metrics.executadas })),
  );
  const divergent = recRows.filter((r: any) => r.status === "DATE_DIVERGENCE").length;
  const unplanned = recRows.filter((r: any) => r.status === "UNPLANNED_VISIT").length;

  const reconciledPlannedIds = new Set<string>();
  for (const r of recRows) {
    const plannedVisitId = r.planned_visit_id as string | null;
    const actualVisitId = r.actual_visit_id as string | null;
    const status = r.status as string;
    if (!plannedVisitId || !actualVisitId) continue;
    if (!plannedIdsInReport.has(plannedVisitId)) continue;
    if (status === "IGNORED" || status === "NOT_COMPLETED" || status === "DUPLICATE_ACTUAL") continue;
    reconciledPlannedIds.add(plannedVisitId);
  }
  const operationalCoveragePct =
    plannedIdsInReport.size > 0
      ? Math.min(100, Math.round((reconciledPlannedIds.size / plannedIdsInReport.size) * 100))
      : 0;

  // UFs
  const ufBuckets = new Map<string, UfLine & { pairs: Array<{ contratadas: number; executadas: number }> }>();
  for (const s of stores) {
    const key = s.uf ?? "—";
    const cur = ufBuckets.get(key) ?? {
      uf: key,
      stores: 0,
      expected: 0,
      actual: 0,
      validForCoverage: 0,
      extra: 0,
      pending: 0,
      coveragePct: 0,
      metrics: { contratadas: 0, executadas: 0, validas: 0, extras: 0, pendencias: 0, coberturaPct: 0 },
      pairs: [],
    };
    cur.stores += 1;
    cur.pairs.push({ contratadas: s.metrics.contratadas, executadas: s.metrics.executadas });
    ufBuckets.set(key, cur);
  }
  const ufs: UfLine[] = Array.from(ufBuckets.values())
    .map((u) => {
      const agg = aggregateVisitMetrics(u.pairs);
      return {
        uf: u.uf,
        stores: u.stores,
        expected: agg.contratadas,
        actual: agg.executadas,
        validForCoverage: agg.validas,
        extra: agg.extras,
        pending: agg.pendencias,
        coveragePct: agg.coberturaPct,
        metrics: agg,
      };
    })
    .sort((a, b) => a.uf.localeCompare(b.uf));

  const execCounts = { ok: 0, parcial: 0, naoRealizada: 0 };
  const routeCounts = { dentro: 0, fora: 0, sem: 0 };
  for (const s of stores) {
    if (s.executionStatus === "OK") execCounts.ok += 1;
    else if (s.executionStatus === "PARCIAL") execCounts.parcial += 1;
    else execCounts.naoRealizada += 1;
    if (s.routeStatus === "DENTRO_ROTEIRO") routeCounts.dentro += 1;
    else if (s.routeStatus === "FORA_ROTEIRO") routeCounts.fora += 1;
    else routeCounts.sem += 1;
  }

  const actualDatesByStore: Record<string, string[]> = {};
  for (const s of stores) actualDatesByStore[s.storeId] = s.actualDates;

  return {
    industry: { id: industry.id, name: industry.name },
    window: {
      startDate: window.startDate,
      endDate: window.endDate,
      totalDays: window.totalDays,
      weeks,
    },
    filters: { uf: uf ?? null, storeId: storeId ?? null, sourceImportId: sourceImportId ?? null },
    totals: {
      totalStores: stores.length,
      contracted: totalsMetrics.contratadas,
      planned: totalsMetrics.contratadas,
      actual: totalsMetrics.executadas,
      validForContractCoverage: totalsMetrics.validas,
      extra: totalsMetrics.extras,
      pending: totalsMetrics.pendencias,
      divergent,
      unplanned,
      contractualCoveragePct: totalsMetrics.coberturaPct,
      operationalCoveragePct,
      coveragePct: totalsMetrics.coberturaPct,
      metrics: totalsMetrics,
      execution: execCounts,
      route: routeCounts,
    },
    stores,
    ufs,
    actualDatesByStore,
    generatedAt: new Date().toISOString(),
  };
}

