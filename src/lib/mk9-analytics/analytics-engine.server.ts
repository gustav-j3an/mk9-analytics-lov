import type {
  OperationCore,
  OperationFilters,
  OperationIndustryRow,
  OperationStoreRow,
} from "@/lib/mk9-operations/types";
import { loadOperationCore } from "@/lib/mk9-operations/core.server";
import type {
  AnalyticsDashboardPayload,
  AnalyticsMetric,
  IndustryEvolution,
  RiskScore,
  TrendStatus,
  UfPerformance,
  RecurrenceRecord,
  FrequencyExecutionGroup,
  ExecutionMatrixCell,
} from "./analytics-types";

export async function getAnalyticsDashboard(
  supabase: any,
  filters: OperationFilters & { compareYear?: number; compareMonth?: number },
): Promise<AnalyticsDashboardPayload> {
  const current = await loadOperationCore(supabase, filters);

  const compareFilters = {
    ...filters,
    year: filters.compareYear || (filters.month === 1 ? filters.year - 1 : filters.year),
    month: filters.compareMonth || (filters.month === 1 ? 12 : filters.month - 1),
  };

  const previous = await loadOperationCore(supabase, compareFilters);

  const dashboard = buildDashboard(current, previous);
  return dashboard;
}

function buildDashboard(
  current: OperationCore,
  previous: OperationCore,
): AnalyticsDashboardPayload {
  const curAgg = aggregate(current);
  const prevAgg = aggregate(previous);

  const industries = buildIndustriesEvolution(current.industryRows, previous.industryRows);
  const recurrence = buildRecurrence(current, previous);
  const frequencies = buildFrequencyAnalytics(current);
  const projection = buildProjection(current);

  return {
    period: {
      current: `${current.month}/${current.year}`,
      previous: `${previous.month}/${previous.year}`,
      isClosed: current.globalEnd < current.today,
    },
    executive: {
      contracted: calcMetric(curAgg.contracted, prevAgg.contracted),
      realized: calcMetric(curAgg.realized, prevAgg.realized),
      pending: calcMetric(curAgg.pending, prevAgg.pending),
      extras: calcMetric(curAgg.extras, prevAgg.extras),
      coverage: calcMetric(curAgg.coverage, prevAgg.coverage, true),
      zeroVisits: calcMetric(curAgg.zeroVisits, prevAgg.zeroVisits),
    },
    industries,
    ufs: buildUfPerformance(current, previous),
    recurrence,
    frequencies,
    matrix: buildExecutionMatrix(current),
    projection,
    topPriorities: buildTopPriorities(current, industries, recurrence),
    positives: {
      bestIndustries: industries
        .filter((i) => i.coverage.current >= 95)
        .sort((a, b) => b.coverage.current - a.coverage.current)
        .slice(0, 3)
        .map((i) => ({ name: i.industryName, coverage: i.coverage.current })),
      bestUfs: buildUfPerformance(current, previous)
        .filter((u) => u.variationVsPrevious > 0)
        .sort((a, b) => b.variationVsPrevious - a.variationVsPrevious)
        .slice(0, 3)
        .map((u) => ({ name: u.uf, evolution: u.variationVsPrevious })),
    },
    lastUpdate: new Date().toISOString(),
    perf: {
      coreMs: current.coreMs,
      queryCount: current.queryCount,
      monitoredIndustriesCount: current.monitoredIndustriesCount,
      monitoredWithChecklistCount: current.monitoredWithChecklistCount,
      monitoredPendingChecklistCount: current.monitoredPendingChecklistCount,
    },
  };
}

function aggregate(core: OperationCore) {
  let contracted = 0;
  let realized = 0;
  let pending = 0;
  let zeroVisits = 0;
  let extras = 0;

  // REESTRUTURAÇÃO DO ESCOPO ANALÍTICO (v1.3.3)
  // Dashboard Analytics ignora FIXED_OPERATION.
  const monitoredStoreRows = core.storeRows.filter(s => {
    const ctx = core.ctxById.get(s.industryId);
    return ctx?.controlMode === "VISIT_CONTROLLED";
  });

  for (const row of core.industryRows) {
    // industryRows já vem filtrado por loadOperationCore
    contracted += row.contratadas;
    realized += row.realizadas;
    pending += row.pendentes;
    zeroVisits += row.zeradasCount;
  }

  // Extras vêm da diferença positiva nas lojas monitoradas
  for (const store of monitoredStoreRows) {
    if (store.realizadas > store.contratadas) {
      extras += store.realizadas - store.contratadas;
    }
  }

  return {
    contracted,
    realized,
    pending,
    extras,
    zeroVisits,
    coverage: contracted > 0 ? (realized / contracted) * 100 : 0,
  };
}

function calcMetric(cur: number, prev: number, isPct = false): AnalyticsMetric {
  const delta = cur - prev;
  return {
    current: cur,
    previous: prev,
    delta,
    percentChange: prev > 0 ? (delta / prev) * 100 : undefined,
  };
}

function buildIndustriesEvolution(
  current: OperationIndustryRow[],
  previous: OperationIndustryRow[],
): IndustryEvolution[] {
  const prevMap = new Map(previous.map((i) => [i.industryId, i]));

  return current.map((cur) => {
    const prev = prevMap.get(cur.industryId);
    const contracted = calcMetric(cur.contratadas, prev?.contratadas ?? 0);
    const realized = calcMetric(cur.realizadas, prev?.realizadas ?? 0);
    const coverage = calcMetric(cur.coberturaPct, prev?.coberturaPct ?? 0, true);

    const zeroVisits = calcMetric(cur.zeradasCount, prev?.zeradasCount ?? 0);

    let trend: TrendStatus = "STABLE";
    if (coverage.delta > 2) trend = "IMPROVING";
    if (coverage.delta < -2) trend = "WORSENING";

    let risk: RiskScore = "LOW";
    if (cur.coberturaPct < 50) risk = "HIGH";
    if (cur.zeradasCount > 0) risk = "MEDIUM";
    if (cur.coberturaPct < 30 || cur.zeradasCount > cur.lojasContratadas * 0.2) risk = "CRITICAL";

    return {
      industryId: cur.industryId,
      industryName: cur.industryName,
      frequency: cur.frequency,
      contracted,
      realized,
      coverage,

      zeroVisits,
      trend,
      risk,
      pendingCount: cur.pendentes,
    };
  });
}

function buildUfPerformance(current: OperationCore, previous: OperationCore): UfPerformance[] {
  const ufs = current.availableUfs;
  const prevStoresByUf = new Map<string, OperationStoreRow[]>();
  previous.storeRows.forEach((s) => {
    if (s.uf) {
      const list = prevStoresByUf.get(s.uf) || [];
      list.push(s);
      prevStoresByUf.set(s.uf, list);
    }
  });

  return ufs.map((uf) => {
    const stores = current.storeRows.filter((s) => {
      const ctx = current.ctxById.get(s.industryId);
      return s.uf === uf && ctx?.controlMode === "VISIT_CONTROLLED";
    });
    const prevStores = previous.storeRows.filter((s) => {
      const ctx = previous.ctxById.get(s.industryId);
      return s.uf === uf && ctx?.controlMode === "VISIT_CONTROLLED";
    });

    const contracted = stores.reduce((a, b) => a + b.contratadas, 0);
    const realized = stores.reduce((a, b) => a + b.realizadas, 0);
    const coverage = contracted > 0 ? (realized / contracted) * 100 : 0;

    const prevContracted = prevStores.reduce((a, b) => a + b.contratadas, 0);
    const prevRealized = prevStores.reduce((a, b) => a + b.realizadas, 0);
    const prevCoverage = prevContracted > 0 ? (prevRealized / prevContracted) * 100 : 0;

    return {
      uf,
      stores: stores.length,
      contracted,
      realized,
      coverage,
      zeroVisits: stores.filter((s) => s.realizadas === 0).length,
      variationVsPrevious: coverage - prevCoverage,
    };
  });
}

function buildRecurrence(current: OperationCore, previous: OperationCore): RecurrenceRecord[] {
  const prevMap = new Map(previous.storeRows.map((s) => [`${s.storeId}-${s.industryId}`, s]));
  const recurrence: RecurrenceRecord[] = [];

  for (const cur of current.storeRows) {
    const ctx = current.ctxById.get(cur.industryId);
    if (ctx?.controlMode !== "VISIT_CONTROLLED") continue;

    const prev = prevMap.get(`${cur.storeId}-${cur.industryId}`);
    if (!prev) continue;

    const curCov = cur.contratadas > 0 ? (cur.realizadas / cur.contratadas) * 100 : 0;
    const prevCov = prev.contratadas > 0 ? (prev.realizadas / prev.contratadas) * 100 : 0;

    // Critério: zerada ou < 50% em ambas (considerando lojas com contrato ativo)
    if (cur.contratadas > 0 && prev.contratadas > 0) {
      if ((cur.realizadas === 0 && prev.realizadas === 0) || (curCov < 50 && prevCov < 50)) {
        recurrence.push({
          storeId: cur.storeId,
          storeName: cur.storeName,
          industryName: cur.industryName,
          uf: cur.uf || "—",
          currentFrequency: cur.monthlyFrequency || 0,
          currentRealized: cur.realizadas,
          history: [
            {
              period: `${previous.month}/${previous.year}`,
              realized: prev.realizadas,
              contracted: prev.contratadas,
              coverage: prevCov,
            },
            {
              period: `${current.month}/${current.year}`,
              realized: cur.realizadas,
              contracted: cur.contratadas,
              coverage: curCov,
            },
          ],
          status: curCov < prevCov ? "CRITICAL_RECURRENT" : "STABLE",
        });
      }
    }
  }

  return recurrence;
}

function buildFrequencyAnalytics(current: OperationCore): FrequencyExecutionGroup[] {
  const groups = new Map<number, FrequencyExecutionGroup>();

  for (const s of current.storeRows) {
    const ctx = current.ctxById.get(s.industryId);
    if (ctx?.controlMode !== "VISIT_CONTROLLED") continue;
    
    const freq = s.monthlyFrequency || 0;
    const group = groups.get(freq) || {
      frequency: freq > 0 ? `${freq}x/mês` : "Manual",
      stores: 0,
      avgCoverage: 0,
      completedCount: 0,
      partialCount: 0,
      zeroCount: 0,
      extras: 0,
    };

    group.stores++;
    const cov = s.contratadas > 0 ? (s.realizadas / s.contratadas) * 100 : 0;
    group.avgCoverage += cov;

    if (s.realizadas === 0) group.zeroCount++;
    else if (s.realizadas >= s.contratadas) group.completedCount++;
    else group.partialCount++;

    if (s.realizadas > s.contratadas) group.extras += s.realizadas - s.contratadas;

    groups.set(freq, group);
  }

  return Array.from(groups.values())
    .map((g) => ({
      ...g,
      avgCoverage: g.stores > 0 ? g.avgCoverage / g.stores : 0,
    }))
    .sort((a, b) => parseInt(a.frequency) - parseInt(b.frequency));
}

function buildExecutionMatrix(current: OperationCore): ExecutionMatrixCell[] {
  const matrix: ExecutionMatrixCell[] = [];
  const frequencies = Array.from(
    new Set(current.storeRows.filter(s => {
      const ctx = current.ctxById.get(s.industryId);
      return ctx?.controlMode === "VISIT_CONTROLLED";
    }).map((s) => s.monthlyFrequency || 0)),
  ).sort((a, b) => a - b);
  const ranges = [
    { label: "0%", min: 0, max: 0 },
    { label: "1-49%", min: 1, max: 49 },
    { label: "50-99%", min: 50, max: 99 },
    { label: "100%", min: 100, max: 100 },
    { label: ">100%", min: 101, max: 1000 },
  ];

  for (const f of frequencies) {
    const stores = current.storeRows.filter((s) => {
      const ctx = current.ctxById.get(s.industryId);
      return ctx?.controlMode === "VISIT_CONTROLLED" && (s.monthlyFrequency || 0) === f;
    });
    for (const r of ranges) {
      const count = stores.filter((s) => {
        const cov = s.contratadas > 0 ? (s.realizadas / s.contratadas) * 100 : 0;
        return cov >= r.min && cov <= r.max;
      }).length;

      matrix.push({
        frequency: f > 0 ? `${f}x/mês` : "Manual",
        coverageLabel: r.label,
        count,
      });
    }
  }

  return matrix;
}

function buildProjection(current: OperationCore): AnalyticsDashboardPayload["projection"] {
  const today = new Date(current.today);
  const start = new Date(current.globalStart);
  const end = new Date(current.globalEnd);

  const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;
  const elapsedDays = (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, totalDays - elapsedDays);

  const curAgg = aggregate(current);
  const pace = elapsedDays > 0 ? curAgg.realized / elapsedDays : 0;
  const projected = curAgg.realized + pace * daysRemaining;

  let riskStatus: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  const projectedCoverage = curAgg.contracted > 0 ? (projected / curAgg.contracted) * 100 : 0;

  if (projectedCoverage < 90) riskStatus = "MEDIUM";
  if (projectedCoverage < 70) riskStatus = "HIGH";
  if (projectedCoverage < 50) riskStatus = "CRITICAL";

  return {
    realized: curAgg.realized,
    projected: Math.round(projected),
    contracted: curAgg.contracted,
    riskStatus,
    daysRemaining: Math.round(daysRemaining),
  };
}

function buildTopPriorities(
  current: OperationCore,
  industries: IndustryEvolution[],
  recurrence: RecurrenceRecord[],
) {
  const priorities: {
    storeId: string;
    storeName: string;
    industryName: string;
    score: number;
    reason: string;
  }[] = [];

  // 1. Lojas reincidentes críticas
  recurrence
    .filter((r) => r.status === "CRITICAL_RECURRENT")
    .slice(0, 5)
    .forEach((r) => {
      priorities.push({
        storeId: r.storeId,
        storeName: r.storeName,
        industryName: r.industryName,
        score: 100,
        reason: "REINCIDÊNCIA CRÍTICA",
      });
    });

  // 2. Lojas zeradas em indústrias críticas
  const criticalIndNames = new Set(
    industries.filter((i) => i.risk === "CRITICAL").map((i) => i.industryName),
  );
  current.storeRows
    .filter((s) => {
      const ctx = current.ctxById.get(s.industryId);
      return ctx?.controlMode === "VISIT_CONTROLLED" && s.realizadas === 0 && criticalIndNames.has(s.industryName);
    })
    .slice(0, 5)
    .forEach((s) => {
      priorities.push({
        storeId: s.storeId,
        storeName: s.storeName,
        industryName: s.industryName,
        score: 90,
        reason: "ZERO VISITAS EM INDÚSTRIA CRÍTICA",
      });
    });

  return priorities.sort((a, b) => b.score - a.score).slice(0, 10);
}
