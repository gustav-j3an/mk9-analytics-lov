// Engine de agregação do Relatório da Indústria.
// Fonte de "visitas contratadas" = roteiro planejado dentro do período (regra escolhida).
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
  /** Métricas canônicas (nova camada nomeada em PT). */
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
    /** Métricas canônicas (nova camada nomeada em PT). */
    metrics: VisitMetrics;
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
    const m = computeVisitMetrics({ contratadas: b.expected, executadas: b.actual });
    let status: StoreStatus;
    if (m.contratadas === 0 && m.executadas > 0) status = "FORA_ROTEIRO";
    else if (m.contratadas === 0 && m.executadas === 0) status = "NAO_ATENDIDA";
    else if (m.extras > 0) status = "ACIMA_FREQUENCIA";
    else if (m.executadas >= m.contratadas) status = "ATENDIDA_INTEGRAL";
    else if (m.executadas === 0) status = "NAO_ATENDIDA";
    else status = "ATENDIDA_PARCIAL";
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
      status,
      metrics: m,
    };
  });
  stores.sort((a, z) => a.storeName.localeCompare(z.storeName, "pt-BR"));
  const storeIdsInReport = new Set(stores.map((s) => s.storeId));
  const recRows = (recs ?? []).filter((r: any) => !r.store_id || storeIdsInReport.has(r.store_id as string));

  // Totais — usam a camada canônica de métricas (soma loja a loja).
  const totalsMetrics = aggregateVisitMetrics(
    stores.map((s) => ({ contratadas: s.expected, executadas: s.actual })),
  );
  const contracted = totalsMetrics.contratadas;
  const actual = totalsMetrics.executadas;
  const validForContractCoverage = totalsMetrics.validas;
  const extra = totalsMetrics.extras;
  const pending = totalsMetrics.pendencias;
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
  const contractualCoveragePct = totalsMetrics.coberturaPct;
  const operationalCoveragePct = contracted > 0 ? Math.round((reconciledPlannedIds.size / contracted) * 100) : 0;
  const coveragePct = contractualCoveragePct;

  // Por UF — também via camada canônica.
  const ufBuckets = new Map<string, Array<{ contratadas: number; executadas: number }>>();
  const ufStoreCount = new Map<string, number>();
  for (const s of stores) {
    const key = s.uf ?? "—";
    const arr = ufBuckets.get(key) ?? [];
    arr.push({ contratadas: s.expected, executadas: s.actual });
    ufBuckets.set(key, arr);
    ufStoreCount.set(key, (ufStoreCount.get(key) ?? 0) + 1);
  }
  const ufs: UfLine[] = Array.from(ufBuckets.entries())
    .map(([uf, arr]) => {
      const m = aggregateVisitMetrics(arr);
      return {
        uf,
        stores: ufStoreCount.get(uf) ?? 0,
        expected: m.contratadas,
        actual: m.executadas,
        validForCoverage: m.validas,
        extra: m.extras,
        pending: m.pendencias,
        coveragePct: m.coberturaPct,
        metrics: m,
      } as UfLine;
    })
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
