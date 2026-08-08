import type { 
  OperationCore, 
  OperationFilters, 
  OperationIndustryRow, 
  OperationStoreRow 
} from "@/lib/mk9-operations/types";
import { loadOperationCore } from "@/lib/mk9-operations/core.server";
import type { 
  AnalyticsDashboardPayload, 
  AnalyticsMetric, 
  IndustryEvolution, 
  RiskScore, 
  TrendStatus, 
  UfPerformance 
} from "./analytics-types";

export async function getAnalyticsDashboard(
  supabase: any,
  filters: OperationFilters & { compareYear?: number; compareMonth?: number }
): Promise<AnalyticsDashboardPayload> {
  const current = await loadOperationCore(supabase, filters);
  
  const compareFilters = {
    ...filters,
    year: filters.compareYear || (filters.month === 1 ? filters.year - 1 : filters.year),
    month: filters.compareMonth || (filters.month === 1 ? 12 : filters.month - 1)
  };
  
  const previous = await loadOperationCore(supabase, compareFilters);
  
  const dashboard = buildDashboard(current, previous);
  return dashboard;
}

function buildDashboard(current: OperationCore, previous: OperationCore): AnalyticsDashboardPayload {
  const curAgg = aggregate(current);
  const prevAgg = aggregate(previous);
  
  return {
    period: {
      current: `${current.month}/${current.year}`,
      previous: `${previous.month}/${previous.year}`,
      isClosed: current.globalEnd < current.today
    },
    executive: {
      contracted: calcMetric(curAgg.contracted, prevAgg.contracted),
      realized: calcMetric(curAgg.realized, prevAgg.realized),
      pending: calcMetric(curAgg.pending, prevAgg.pending),
      extras: calcMetric(curAgg.extras, prevAgg.extras),
      coverage: calcMetric(curAgg.coverage, prevAgg.coverage, true),
      zeroVisits: calcMetric(curAgg.zeroVisits, prevAgg.zeroVisits)
    },
    industries: buildIndustriesEvolution(current.industryRows, previous.industryRows),
    ufs: buildUfPerformance(current, previous),
    recurrence: [], // TODO: Identificar reincidência entre as duas competências
    frequencies: [],
    lastUpdate: new Date().toISOString()
  };
}

function aggregate(core: OperationCore) {
  let contracted = 0;
  let realized = 0;
  let pending = 0;
  let zeroVisits = 0;
  
  for (const row of core.industryRows) {
    contracted += row.contratadas;
    realized += row.realizadas;
    pending += row.pendentes;
    zeroVisits += row.zeradasCount;
  }
  
  return {
    contracted,
    realized,
    pending,
    extras: 0, // Extras devem ser extraídos das lojas
    zeroVisits,
    coverage: contracted > 0 ? (realized / contracted) * 100 : 0
  };
}

function calcMetric(cur: number, prev: number, isPct = false): AnalyticsMetric {
  const delta = cur - prev;
  return {
    current: cur,
    previous: prev,
    delta,
    percentChange: prev > 0 ? (delta / prev) * 100 : undefined
  };
}

function buildIndustriesEvolution(current: OperationIndustryRow[], previous: OperationIndustryRow[]): IndustryEvolution[] {
  const prevMap = new Map(previous.map(i => [i.industryId, i]));
  
  return current.map(cur => {
    const prev = prevMap.get(cur.industryId);
    const coverage = calcMetric(cur.coberturaPct, prev?.coberturaPct ?? 0, true);
    const zeroVisits = calcMetric(cur.zeradasCount, prev?.zeradasCount ?? 0);
    
    let trend: TrendStatus = "STABLE";
    if (coverage.delta > 2) trend = "IMPROVING";
    if (coverage.delta < -2) trend = "WORSENING";
    
    let risk: RiskScore = "LOW";
    if (cur.coberturaPct < 50) risk = "HIGH";
    if (cur.zeradasCount > 0) risk = "MEDIUM";
    if (cur.coberturaPct < 30 || cur.zeradasCount > (cur.lojasContratadas * 0.2)) risk = "CRITICAL";

    return {
      industryId: cur.industryId,
      industryName: cur.industryName,
      coverage,
      zeroVisits,
      trend,
      risk
    };
  });
}

function buildUfPerformance(current: OperationCore, previous: OperationCore): UfPerformance[] {
  // Simplificação para primeira entrega
  const ufs = current.availableUfs;
  return ufs.map(uf => {
    const stores = current.storeRows.filter(s => s.uf === uf);
    const contracted = stores.reduce((a, b) => a + b.contratadas, 0);
    const realized = stores.reduce((a, b) => a + b.realizadas, 0);
    return {
      uf,
      stores: stores.length,
      contracted,
      realized,
      coverage: contracted > 0 ? (realized / contracted) * 100 : 0,
      zeroVisits: stores.filter(s => s.realizadas === 0).length,
      variationVsPrevious: 0 // TODO: Calcular delta real por UF
    };
  });
}
