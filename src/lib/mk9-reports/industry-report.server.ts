// Engine de agregação do Relatório da Indústria.
//
// Fonte ÚNICA das "visitas contratadas" por loja (Fase 1B.3): a frequência
// VERSIONADA da indústria (mk9_industry_store_frequency_versions), somada por
// segmento de vigência dentro da janela operacional. A existência ou ausência
// de roteiro planejado NÃO altera o valor contratado — o roteiro é somente
// auditoria (routeStatus). Extras de uma loja não compensam pendências de
// outra.
//
// Regra de contrato (centralizada em @/lib/mk9-frequency/segments):
//   monthly → proporcional aos dias de vigência dentro do período.
//   weekly  → fallback (weekly × dias/7) apenas quando não há mensal.
// Cobertura é limitada a 100 % (já garantido por validas = min(contr., exec.)).
import type { PeriodWindow } from "./period.server";
import { aggregateVisitMetrics, computeVisitMetrics, type VisitMetrics } from "./metrics";
import {
  contractedVisitsForFrequencySegments,
  describeFrequencySegments,
  type FrequencySegmentInput,
} from "@/lib/mk9-frequency/segments";
import { loadFrequencyVersionsForPeriod } from "@/lib/mk9-frequency/versions.server";



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

export type ExecutionStatus = "INTEGRAL" | "PARCIAL" | "NAO_ATENDIDA";
export const EXECUTION_STATUS_LABEL: Record<ExecutionStatus, string> = {
  INTEGRAL: "Integral",
  PARCIAL: "Parcial",
  NAO_ATENDIDA: "Não atendida",
};

export type RouteStatus = "DENTRO_ROTEIRO" | "FORA_ROTEIRO";
export const ROUTE_STATUS_LABEL: Record<RouteStatus, string> = {
  DENTRO_ROTEIRO: "Dentro do roteiro",
  FORA_ROTEIRO: "Fora do roteiro",
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
  executionStatus: ExecutionStatus;    // Integral / Parcial / Não atendida
  routeStatus: RouteStatus;            // Dentro / Fora
  contractedSource: ContractedSource;  // origem da métrica contratada
  weeklyFrequency: number | null;
  monthlyFrequency: number | null;
  /** houve troca de frequência dentro do período operacional */
  frequencyChangedInPeriod: boolean;
  /** ex.: "1x/sem até 15/07 · 2x/sem desde 16/07" (null quando sem vigência) */
  frequencyLabel: string | null;

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
  promoterId?: string | null;
  includePromoter?: boolean;
  /** Escopo de acesso resolvido no servidor (Fase 0.2). Nunca vem do navegador. */
  access?: import("@/lib/mk9-auth/access-scope.server").Mk9AccessScope | null;
}

export interface IndustryReport {
  industry: { id: string; name: string };
  window: { startDate: string; endDate: string; totalDays: number; weeks: number | string[] };
  filters: { uf: string | null; storeId: string | null; sourceImportId: string | null; promoterId?: string | null };
  totals: {
    totalStores: number;
    promoterName?: string | null;
    promoterEmployeeNumber?: string | null;
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
    promoterStats?: {
      totalVisits: number;
      uniqueStores: number;
      uniqueIndustries: number;
      byWeekday: number[];
    };
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

// Contratadas por loja vêm de contractedVisitsForFrequencySegments
// (@/lib/mk9-frequency/segments) — motor único, com um só arredondamento.



export async function buildIndustryReport(
  supabase: any,
  input: IndustryReportInput,
  window: PeriodWindow,
): Promise<IndustryReport> {
  const { industryId, uf, storeId, sourceImportId, promoterId } = input;
  const weeks = weeksInWindow(window);
  const access = input.access ?? null;
  if (access) {
    const { assertIndustryAllowed, assertStoreAllowed, Mk9ScopeError } = await import(
      "@/lib/mk9-auth/access-scope.server"
    );
    assertIndustryAllowed(access, industryId);
    if (storeId) assertStoreAllowed(access, storeId, null);
    if (uf && access.allowedUfs && !access.allowedUfs.includes(uf.toUpperCase())) throw new Mk9ScopeError();
  }
  const inAccess = (store: any, sid: string | null) => {
    if (!access) return true;
    if (access.allowedStoreIds && (!sid || !access.allowedStoreIds.includes(sid))) return false;
    if (access.allowedUfs && !(store?.uf && access.allowedUfs.includes(store.uf))) return false;
    return true;
  };

  // 1) Indústria
  const { data: industry, error: eInd } = await supabase
    .from("mk9_industries")
    .select("id, name")
    .eq("id", industryId)
    .maybeSingle();
  if (eInd) throw new Error(eInd.message);
  if (!industry) throw new Error("Indústria não encontrada");

  // Motor operacional core (Fase 3: loadOperationCore)
  const { loadOperationCore } = await import("@/lib/mk9-operations/core.server");
  const core = await loadOperationCore(supabase, {
    year: input.year,
    month: input.month,
    uf: uf ?? undefined,
    industryId: industryId,
    promoterId: promoterId ?? undefined,
    access,
  });

  // 2) Frequência por loja (fonte principal de "contratadas")
  // Frequência VERSIONADA vigente na janela (fonte de "contratadas").
  const freqVersions = await loadFrequencyVersionsForPeriod(supabase, {
    industryIds: [industryId],
    storeIds: storeId ? [storeId] : (access?.allowedStoreIds ?? null),
    periodStart: window.startDate,
    periodEnd: window.endDate,
    accessScope: access,
  });


  // 3) Roteiro planejado (usado só para status_roteiro; nunca altera contrato)
  let plannedQ = supabase
    .from("mk9_planned_visits")
    .select("id, scheduled_date, store_id, store:mk9_stores(id,name,chain,uf)")
    .eq("industry_id", industryId)
    .gte("scheduled_date", window.startDate)
    .lte("scheduled_date", window.endDate)
    .is("archived_at", null)
    .limit(20000);
  if (storeId) plannedQ = plannedQ.eq("store_id", storeId);
  const { data: planned, error: ePl } = await plannedQ;
  if (ePl) throw new Error(ePl.message);

  // 4) Visitas realizadas no período (checklist) - Fonte Única Operacional
  const { getOperationalVisits } = await import("@/lib/mk9-operations/operational-visits.server");
  const actuals = await getOperationalVisits({
    industryId,
    startDate: window.startDate,
    endDate: window.endDate,
    storeId: storeId ?? null,
    sourceImportId: sourceImportId ?? null
  });




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
    segments: FrequencySegmentInput[];

    plannedCount: number;
    actual: number;
    actualDates: Set<string>;
  };
  const map = new Map<string, Bucket>();
  const touch = (
    id: string,
    r: { name?: string | null; chain?: string | null; uf?: string | null } | null | undefined,
  ): Bucket => {
    let b = map.get(id);
    if (!b) {
      b = {
        storeId: id,
        storeName: r?.name ?? "—",
        chain: r?.chain ?? null,
        uf: r?.uf ?? null,
        weekly: null,
        monthly: null,
        segments: [],
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

  // Vigências de frequência (nunca filtrar por UF antes de existir a loja no bucket)
  for (const [key, segs] of freqVersions) {
    const sid = key.slice(key.indexOf("|") + 1);
    if (!sid || !segs.length) continue;
    const store = segs[0].store;
    if (uf && store?.uf !== uf) continue;
    if (!inAccess(store, sid)) continue;
    const b = touch(sid, store);
    b.segments = segs.map((s) => ({
      validFrom: s.validFrom,
      validUntil: s.validUntil,
      weeklyFrequency: s.weeklyFrequency,
      monthlyFrequency: s.monthlyFrequency,
    }));
    const last = segs[segs.length - 1];
    b.weekly = last.weeklyFrequency;
    b.monthly = last.monthlyFrequency;
  }

  for (const p of planned ?? []) {
    if (!p.store_id) continue;
    if (uf && p.store?.uf !== uf) continue;
    if (!inAccess(p.store, p.store_id ?? null)) continue;
    const b = map.get(p.store_id);
    if (b) b.plannedCount += 1;
  }
  for (const a of actuals ?? []) {
    if (!a.store_id) continue;
    if (uf && a.store?.uf !== uf) continue;
    if (!inAccess(a.store, a.store_id ?? null)) continue;
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
    if (!inAccess(p.store, p.store_id ?? null)) continue;
    plannedIdsInReport.add(p.id as string);
  }

  // Monta linhas por loja
  const stores: StoreLine[] = Array.from(map.values()).map((b) => {
    // Contratadas: SEMPRE da frequência versionada vigente no período.
    // Roteiro planejado é auditoria (routeStatus) — nunca substitui contrato.
    const contracted = contractedVisitsForFrequencySegments({
      segments: b.segments,
      operationPeriodStart: window.startDate,
      operationPeriodEnd: window.endDate,
    });
    const contratadas = contracted.contratadas;
    const source: ContractedSource = contracted.source;
    const m = computeVisitMetrics({ contratadas, executadas: b.actual });



    // status_execucao (independe de roteiro)
    const executionStatus: ExecutionStatus =
      contratadas === 0 && b.actual === 0
        ? "NAO_ATENDIDA"
        : m.executadas === 0
          ? "NAO_ATENDIDA"
          : m.executadas >= m.contratadas && m.contratadas > 0
            ? "INTEGRAL"
            : "PARCIAL";

    // status_roteiro (fonte separada)
    const routeStatus: RouteStatus =
      b.plannedCount > 0 ? "DENTRO_ROTEIRO" : "FORA_ROTEIRO";

    // status legado: somente execução/contrato. Roteiro fica em routeStatus.
    let legacy: StoreStatus;
    if (m.extras > 0) legacy = "ACIMA_FREQUENCIA";
    else if (executionStatus === "INTEGRAL") legacy = "ATENDIDA_INTEGRAL";
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
      frequencyChangedInPeriod: contracted.hasMultipleSegments,
      frequencyLabel: describeFrequencySegments(contracted, {
        start: window.startDate,
        end: window.endDate,
      }),

      plannedCount: b.plannedCount,
      metrics: m,
    };
  });
  stores.sort((a, z) => a.storeName.localeCompare(z.storeName, "pt-BR"));
  const storeIdsInReport = new Set(stores.map((s) => s.storeId));
  const recRows = (recs ?? []).filter((r: any) => !r.store_id || storeIdsInReport.has(r.store_id as string));

  // Totais canônicos via camada de métricas (para 'validas' e 'extras' agregados)
  const totalsMetrics = aggregateVisitMetrics(
    stores.map((s) => ({ contratadas: s.metrics.contratadas, executadas: s.metrics.executadas })),
  );
  // Nova regra: realizadas é SEMPRE o total bruto do checklist (nunca reduzido).
  // Pendentes e cobertura globais usam contratadas - realizadas.
  const contractedVisitsCount = totalsMetrics.contratadas;
  const executedVisitsCount = totalsMetrics.executadas;
  const pendingVisitsCount = Math.max(0, contractedVisitsCount - executedVisitsCount);
  const contractCoveragePct =
    contractedVisitsCount > 0
      ? Math.min(100, Math.round((executedVisitsCount / contractedVisitsCount) * 100))
      : 0;
  totalsMetrics.pendencias = pendingVisitsCount;
  totalsMetrics.coberturaPct = contractCoveragePct;

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
    if (s.executionStatus === "INTEGRAL") execCounts.ok += 1;
    else if (s.executionStatus === "PARCIAL") execCounts.parcial += 1;
    else execCounts.naoRealizada += 1;
    if (s.routeStatus === "DENTRO_ROTEIRO") routeCounts.dentro += 1;
    else routeCounts.fora += 1;
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
    filters: { uf: uf ?? null, storeId: storeId ?? null, sourceImportId: sourceImportId ?? null, promoterId: promoterId ?? null },
    totals: {
      totalStores: stores.length,
      promoterName: input.promoterId ? core.storeRows.find(s => s.promoterId === input.promoterId)?.promoterName : null,
      promoterEmployeeNumber: input.promoterId ? core.storeRows.find(s => s.promoterId === input.promoterId)?.promoterEmployeeNumber : null,

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
      promoterStats: promoterId ? {
        totalVisits: Math.round(stores.reduce((sum, s) => sum + s.expected, 0)),
        uniqueStores: stores.length,
        uniqueIndustries: 1, // Dentro do IndustryReport é sempre 1
        byWeekday: [0, 1, 2, 3, 4, 5, 6].map(wd => {
          let visits = 0;
          for (const s of stores) {
            const routeInfo = core.routeByKey.get(`${industryId}|${s.storeId}`);
            if (routeInfo?.weekdays.has(wd)) {
              visits += s.expected / routeInfo.weekdays.size;
            }
          }
          return Math.round(visits);
        })
      } : undefined
    },
    stores,
    ufs,
    actualDatesByStore,
    generatedAt: new Date().toISOString(),
  };
}

