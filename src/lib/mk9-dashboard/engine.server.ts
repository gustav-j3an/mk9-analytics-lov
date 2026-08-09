// Motor agregado do Dashboard Operacional MK9.
// Uma única chamada devolve KPIs, séries, rankings, alertas e tabelas resumidas.
//
// FONTE DA VERDADE (Fase 1B.3 / núcleo compartilhado da Fase 3.1B)
//   contratadas = frequência VERSIONADA vigente no período
//                 (mk9_industry_store_frequency_versions), calculada por
//                 segmentos de vigência via contractedVisitsForFrequencySegments.
//   realizadas  = mk9_actual_visits (checklist) dentro da janela da indústria.
//   pendentes   = max(0, contratadas - realizadas)
//   extras      = max(0, realizadas - contratadas)
//   cobertura   = min(100, realizadas / contratadas)
//   roteiro     = mk9_planned_routes versionado (apenas auditoria de promotor).
//
// Toda a carga de dados e as agregações por loja/indústria vivem em
// `src/lib/mk9-operations` — Dashboard e Cockpit compartilham o MESMO núcleo.
import { buildDailySeries, classifyIndustry } from "@/lib/mk9-operations/buckets";
import { loadOperationCore } from "@/lib/mk9-operations/core.server";
import { pct, periodLabel, todayIso } from "@/lib/mk9-operations/periods";
import type {
  IndustryContext,
  OperationIndustryRow,
  OperationStoreRow,
  RouteInfo,
} from "@/lib/mk9-operations/types";

import {
  INDUSTRY_STATUS_LABEL,
  INDUSTRY_STATUS_ORDER,
  type DashboardAlert,
  type DashboardFilters,
  type DashboardOverview,
  type DashboardPromoterRow,
  type DashboardSeriesPoint,
  type IndustryStatusKey,
  type StoreExecStatus,
} from "./types";

export { classifyIndustry };

export async function buildDashboardOverview(
  supabase: any,
  filters: DashboardFilters,
): Promise<DashboardOverview> {
  const startedAt = Date.now();
  let core;
  try {
    core = await loadOperationCore(supabase, filters);
  } catch (err: any) {
    console.error("[DASHBOARD_CORE_FAILED]", err);
    return emptyOverview(
      todayIso(),
      filters.year,
      filters.month,
      `${filters.year}-01-01`,
      `${filters.year}-12-31`,
    );
  }

  const { year, month } = filters;

  if (core.empty) {
    return emptyOverview(core.today, year, month, core.globalStart, core.globalEnd);
  }

  const { today, storeRows, industryRows, ctxs, routeByKey } = core;

  industryRows.sort((a, b) => {
    const d = INDUSTRY_STATUS_ORDER.indexOf(a.status) - INDUSTRY_STATUS_ORDER.indexOf(b.status);
    if (d !== 0) return d;
    return a.coberturaPct - b.coberturaPct;
  });

  // ---- KPIs — FILTRAGEM ANALÍTICA v1.3.3 -------------------------------------
  // Regra de Ouro: Dashboard Analytics ignora FIXED_OPERATION.
  const monitoredStoreRows = storeRows.filter(s => {
    const ctx = ctxById.get(s.industryId);
    return ctx?.controlMode === "VISIT_CONTROLLED";
  });

  const contractedTotal = monitoredStoreRows.reduce((a, s) => a + s.contratadas, 0);
  const realizedToDate = monitoredStoreRows.reduce((a, s) => a + s.realizadas, 0);
  const expectedToDate = industryRows.reduce((a, i) => a + i.expectedToDate, 0); // industryRows já vem filtrado por loadOperationCore/buildIndustryRows
  const extras = monitoredStoreRows.reduce((a, s) => a + Math.max(0, s.realizadas - s.contratadas), 0);
  const pendentes = Math.max(0, contractedTotal - realizedToDate);
  
  const lojasAtendidas = new Set(monitoredStoreRows.filter((s) => s.realizadas > 0).map((s) => s.storeId)).size;
  const lojasContratadas = new Set(monitoredStoreRows.filter((s) => s.contratadas > 0).map((s) => s.storeId)).size;
  const lojasSemVisita = monitoredStoreRows.filter((s) => s.contratadas > 0 && s.realizadas === 0).length;
  
  const visitasSemPromotor = monitoredStoreRows
    .filter((s) => s.promoterResolution !== "MATCHED_ROUTE")
    .reduce((a, s) => a + s.realizadas, 0);
    
  const industriasEmRisco = industryRows.filter(
    (i) =>
      i.status === "CRITICA" ||
      i.status === "ATENCAO" ||
      i.status === "SEM_CHECKLIST" ||
      i.status === "SEM_FREQUENCIA",
  ).length;

  const kpis = {
    contractedTotal,
    expectedToDate,
    realizedToDate,
    deviation: realizedToDate - expectedToDate,
    pacePercentage:
      expectedToDate > 0 ? pct(realizedToDate, expectedToDate) : realizedToDate > 0 ? 100 : 0,
    realizadas: realizedToDate,
    pendentes,
    extras,
    coberturaPct: contractedTotal > 0 ? Math.min(100, pct(realizedToDate, contractedTotal)) : 0,
    lojasContratadas,
    lojasAtendidas,
    lojasSemVisita,
    industriasTotal: industryRows.length,
    industriasEmRisco,
    visitasSemPromotor,
  };

  const series: DashboardSeriesPoint[] = buildDailySeries({
    ctxs,
    industryRows,
    storeRows: monitoredStoreRows,
    globalStart: core.globalStart,
    globalEnd: core.globalEnd,
  });

  const promoters = buildPromoters(monitoredStoreRows, ctxs, routeByKey);

  const criticalAll = monitoredStoreRows
    .filter((s) => s.pendentes > 0 || s.realizadas === 0)
    .sort((a, b) => {
      const an = a.realizadas === 0 ? 0 : 1;
      const bn = b.realizadas === 0 ? 0 : 1;
      if (an !== bn) return an - bn;
      const ad = a.expectedToDate - a.realizadas;
      const bd = b.expectedToDate - b.realizadas;
      if (bd !== ad) return bd - ad;
      return (b.daysWithoutVisit ?? 9999) - (a.daysWithoutVisit ?? 9999);
    });

  const alerts = buildAlerts(industryRows, monitoredStoreRows, promoters);

  const storeExecutionDistribution = [
    {
      key: "INTEGRAL" as StoreExecStatus,
      label: "Integral",
      value: monitoredStoreRows.filter((s) => s.status === "INTEGRAL").length,
    },
    {
      key: "PARCIAL" as StoreExecStatus,
      label: "Parcial",
      value: monitoredStoreRows.filter((s) => s.status === "PARCIAL").length,
    },
    {
      key: "NAO_ATENDIDA" as StoreExecStatus,
      label: "Não atendida",
      value: monitoredStoreRows.filter((s) => s.status === "NAO_ATENDIDA").length,
    },
  ];
  const industryStatusDistribution = INDUSTRY_STATUS_ORDER.map((key) => ({
    key,
    label: INDUSTRY_STATUS_LABEL[key],
    value: industryRows.filter((i) => i.status === key).length,
  })).filter((d) => d.value > 0);

  return {
    generatedAt: new Date().toISOString(),
    today,
    periodLabel: periodLabel(year, month),
    windowStart: core.globalStart,
    windowEnd: core.globalEnd,
    usesHistoricalFrequency: core.globalEnd < today,
    checklistImports: core.checklistImportsTotal,
    monitoredIndustries: {
      total: core.monitoredIndustriesCount,
      withChecklist: core.monitoredWithChecklistCount,
      pendingChecklist: core.monitoredPendingChecklistCount,
    },
    kpis,
    industries: industryRows,
    criticalStores: criticalAll.slice(0, 15),
    criticalStoresTotal: criticalAll.length,
    promoters,
    series,
    alerts: alerts.slice(0, 10),
    alertsTotal: alerts.length,
    storeExecutionDistribution,
    industryStatusDistribution,
    availableUfs: core.availableUfs,
  };
}

/**
 * DIAGNÓSTICO DE INTEGRIDADE: Varre o core operacional em busca de dados inconsistentes
 * que podem causar erros de renderização ou cálculos errados.
 */
export async function checkDashboardIntegrity(supabase: any, filters: DashboardFilters) {
  const core = await loadOperationCore(supabase, filters);
  const issues: Array<{ kind: string; detail: string; severity: "WARN" | "ERROR" }> = [];

  // 1. Visitas sem indústria (raro, mas possível se FK falhar)
  const { data: orphanVisits } = await supabase
    .from("mk9_actual_visits")
    .select("id")
    .is("industry_id", null)
    .limit(10);
  if (orphanVisits?.length) {
    issues.push({
      kind: "ORPHAN_VISITS",
      detail: `${orphanVisits.length} visitas sem indústria vinculada.`,
      severity: "ERROR",
    });
  }

  // 2. Lojas sem UF (quebra filtros geográficos)
  const { data: invalidStores } = await supabase
    .from("mk9_stores")
    .select("id, name")
    .is("uf", null)
    .limit(10);
  if (invalidStores?.length) {
    issues.push({
      kind: "INVALID_STORES",
      detail: `${invalidStores.length} lojas sem UF cadastrada (ex: ${invalidStores[0].name}).`,
      severity: "WARN",
    });
  }

  // 3. Promotores sem nome
  const { data: invalidPromoters } = await supabase
    .from("mk9_promoters")
    .select("id")
    .or("name.is.null,name.eq.''")
    .limit(10);
  if (invalidPromoters?.length) {
    issues.push({
      kind: "INVALID_PROMOTERS",
      detail: `${invalidPromoters.length} promotores com nome em branco ou nulo.`,
      severity: "ERROR",
    });
  }

  // 4. Inconsistência de Frequência (Frequência > 31 visitas/mês)
  for (const row of core.storeRows) {
    if (row.contratadas > 31) {
      issues.push({
        kind: "HIGH_FREQUENCY",
        detail: `Loja ${row.storeName} com ${row.contratadas} visitas contratadas (verificar versão).`,
        severity: "WARN",
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------

function buildPromoters(
  storeRows: OperationStoreRow[],
  ctxs: IndustryContext[],
  routeByKey: Map<string, RouteInfo>,
): DashboardPromoterRow[] {
  interface Acc {
    name: string;
    stores: Set<string>;
    industries: Set<string>;
    expected: number;
    realized: number;
    withoutVisit: number;
    offSchedule: number;
    unresolved: boolean;
  }
  const map = new Map<string, Acc>();
  for (const s of storeRows) {
    const unresolved = s.promoterResolution !== "MATCHED_ROUTE";
    const key = unresolved ? `__${s.promoterResolution}__` : s.promoterId!;
    const name = unresolved
      ? s.promoterResolution === "AMBIGUOUS_ROUTE"
        ? "Roteiro ambíguo"
        : "Sem roteiro vigente"
      : (s.promoterName ?? "—");
    const acc = map.get(key) ?? {
      name,
      stores: new Set<string>(),
      industries: new Set<string>(),
      expected: 0,
      realized: 0,
      withoutVisit: 0,
      offSchedule: 0,
      unresolved,
    };
    acc.stores.add(s.storeId);
    acc.industries.add(s.industryId);
    acc.expected += s.expectedToDate;
    acc.realized += s.realizadas;
    if (s.contratadas > 0 && s.realizadas === 0) acc.withoutVisit += 1;

    const info = routeByKey.get(`${s.industryId}|${s.storeId}`);
    if (info && info.weekdays.size > 0) {
      const ctx = ctxs.find((c) => c.id === s.industryId);
      for (const d of ctx?.buckets.get(s.storeId)?.visits ?? []) {
        const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
        if (!info.weekdays.has(wd)) acc.offSchedule += 1;
      }
    }
    map.set(key, acc);
  }

  return Array.from(map.entries())
    .map(([id, a]) => {
      const coberturaPct =
        a.expected > 0 ? Math.min(100, pct(a.realized, a.expected)) : a.realized > 0 ? 100 : 0;
      const status: DashboardPromoterRow["status"] = a.unresolved
        ? "NAO_RESOLVIDO"
        : coberturaPct >= 100
          ? "EM_DIA"
          : coberturaPct >= 90
            ? "ATENCAO"
            : "CRITICA";
      return {
        promoterId: id.startsWith("__") ? null : id,
        promoterName: a.name,
        storesCount: a.stores.size,
        industriesCount: a.industries.size,
        expectedToDate: a.expected,
        realizadas: a.realized,
        coberturaPct,
        storesWithoutVisit: a.withoutVisit,
        visitsOffSchedule: a.offSchedule,
        status,
      };
    })
    .sort(
      (a, b) =>
        a.coberturaPct - b.coberturaPct || a.promoterName.localeCompare(b.promoterName, "pt-BR"),
    );
}

const SEVERITY_RANK: Record<DashboardAlert["severity"], number> = {
  CRITICA: 0,
  ALTA: 1,
  MEDIA: 2,
  BAIXA: 3,
};

function buildAlerts(
  industries: OperationIndustryRow[],
  stores: OperationStoreRow[],
  promoters: DashboardPromoterRow[],
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  for (const i of industries) {
    if (i.status === "CRITICA") {
      alerts.push({
        id: `ind-crit-${i.industryId}`,
        kind: "INDUSTRIA_CRITICA",
        severity: "CRITICA",
        title: `${i.industryName} está crítica`,
        description: `${i.realizadas} de ${i.expectedToDate} visitas esperadas até hoje (${i.pacePercentage}% do ritmo).`,
        industryId: i.industryId,
        storeId: null,
        promoterId: null,
        uf: null,
      });
    } else if (i.status === "SEM_CHECKLIST") {
      alerts.push({
        id: `ind-nochk-${i.industryId}`,
        kind: "CHECKLIST_NAO_IMPORTADO",
        severity: "ALTA",
        title: `${i.industryName} sem checklist importado`,
        description: `${i.contratadas} visitas contratadas no período e nenhuma execução registrada.`,
        industryId: i.industryId,
        storeId: null,
        promoterId: null,
        uf: null,
      });
    } else if (i.status === "SEM_FREQUENCIA") {
      alerts.push({
        id: `ind-nofreq-${i.industryId}`,
        kind: "FREQUENCIA_NAO_CADASTRADA",
        severity: "ALTA",
        title: `${i.industryName} sem frequência cadastrada`,
        description: "Há execução ou roteiro, mas nenhuma frequência contratada configurada.",
        industryId: i.industryId,
        storeId: null,
        promoterId: null,
        uf: null,
      });
    } else if (i.status === "ATENCAO") {
      alerts.push({
        id: `ind-meta-${i.industryId}`,
        kind: "INDUSTRIA_ABAIXO_META",
        severity: "MEDIA",
        title: `${i.industryName} abaixo da meta proporcional`,
        description: `Desvio de ${i.deviation} visitas em relação ao esperado até hoje.`,
        industryId: i.industryId,
        storeId: null,
        promoterId: null,
        uf: null,
      });
    }
  }

  const semVisita = stores.filter((s) => s.contratadas > 0 && s.realizadas === 0);
  for (const s of semVisita.slice(0, 12)) {
    alerts.push({
      id: `store-none-${s.industryId}-${s.storeId}`,
      kind: "LOJA_SEM_VISITA",
      severity: "ALTA",
      title: `${s.storeName} sem nenhuma visita`,
      description: `${s.industryName} · ${s.contratadas} contratadas · ${s.uf ?? "—"}`,
      industryId: s.industryId,
      storeId: s.storeId,
      promoterId: s.promoterId,
      uf: s.uf,
    });
  }

  const abaixo = stores
    .filter(
      (s) => s.realizadas > 0 && s.expectedToDate > 0 && s.realizadas / s.expectedToDate < 0.5,
    )
    .sort((a, b) => b.expectedToDate - b.realizadas - (a.expectedToDate - a.realizadas));
  for (const s of abaixo.slice(0, 8)) {
    alerts.push({
      id: `store-low-${s.industryId}-${s.storeId}`,
      kind: "LOJA_ABAIXO_FREQUENCIA",
      severity: "MEDIA",
      title: `${s.storeName} muito abaixo da frequência`,
      description: `${s.realizadas} de ${s.expectedToDate} esperadas até hoje (${s.industryName}).`,
      industryId: s.industryId,
      storeId: s.storeId,
      promoterId: s.promoterId,
      uf: s.uf,
    });
  }

  const unassigned = stores.filter(
    (s) => s.promoterResolution === "UNASSIGNED_ROUTE" && s.realizadas > 0,
  );
  if (unassigned.length) {
    const total = unassigned.reduce((a, s) => a + s.realizadas, 0);
    alerts.push({
      id: "visits-unassigned",
      kind: "VISITA_UNASSIGNED",
      severity: "MEDIA",
      title: `${total} visitas sem roteiro vigente`,
      description: `${unassigned.length} lojas executadas sem promotor resolvido. Contam para indústria e loja.`,
      industryId: null,
      storeId: null,
      promoterId: null,
      uf: null,
    });
  }
  const ambiguous = stores.filter(
    (s) => s.promoterResolution === "AMBIGUOUS_ROUTE" && s.realizadas > 0,
  );
  if (ambiguous.length) {
    const total = ambiguous.reduce((a, s) => a + s.realizadas, 0);
    alerts.push({
      id: "visits-ambiguous",
      kind: "VISITA_AMBIGUOUS",
      severity: "MEDIA",
      title: `${total} visitas com roteiro ambíguo`,
      description: `${ambiguous.length} lojas com mais de um promotor vigente no período.`,
      industryId: null,
      storeId: null,
      promoterId: null,
      uf: null,
    });
  }

  for (const p of promoters
    .filter((x) => x.status === "CRITICA" && x.expectedToDate >= 5)
    .slice(0, 5)) {
    alerts.push({
      id: `promoter-crit-${p.promoterId}`,
      kind: "PROMOTOR_CRITICO",
      severity: "ALTA",
      title: `${p.promoterName} com cobertura crítica`,
      description: `${p.realizadas} de ${p.expectedToDate} esperadas · ${p.storesWithoutVisit} lojas sem visita.`,
      industryId: null,
      storeId: null,
      promoterId: p.promoterId,
      uf: null,
    });
  }

  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

function emptyOverview(
  today: string,
  year: number,
  month: number,
  start: string,
  end: string,
): DashboardOverview {
  return {
    generatedAt: new Date().toISOString(),
    today: today || todayIso(),
    periodLabel: periodLabel(year, month),
    windowStart: start,
    windowEnd: end,
    usesHistoricalFrequency: false,
    checklistImports: 0,
    kpis: {
      contractedTotal: 0,
      expectedToDate: 0,
      realizedToDate: 0,
      deviation: 0,
      pacePercentage: 0,
      realizadas: 0,
      pendentes: 0,
      extras: 0,
      coberturaPct: 0,
      lojasContratadas: 0,
      lojasAtendidas: 0,
      lojasSemVisita: 0,
      industriasTotal: 0,
      industriasEmRisco: 0,
      visitasSemPromotor: 0,
    },
    industries: [],
    criticalStores: [],
    criticalStoresTotal: 0,
    promoters: [],
    series: [],
    alerts: [],
    alertsTotal: 0,
    storeExecutionDistribution: [],
    industryStatusDistribution: [],
    availableUfs: [],
  };
}
