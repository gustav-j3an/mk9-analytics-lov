// Motor agregado do Dashboard Operacional MK9.
// Uma única chamada devolve KPIs, séries, rankings, alertas e tabelas resumidas.
//
// FONTE DA VERDADE (Fase 1B.3)
//   contratadas = frequência VERSIONADA vigente no período
//                 (mk9_industry_store_frequency_versions), calculada por
//                 segmentos de vigência via contractedVisitsForFrequencySegments.
//   realizadas  = mk9_actual_visits (checklist) dentro da janela da indústria.
//   pendentes   = max(0, contratadas - realizadas)
//   extras      = max(0, realizadas - contratadas)
//   cobertura   = min(100, realizadas / contratadas)
//   roteiro     = mk9_planned_routes versionado (apenas auditoria de promotor).
//
// mk9_planned_visits NÃO é usada aqui.
// A projeção mk9_industry_store_frequency NÃO é mais lida por este motor.


import { resolveWindow, type PeriodConfig } from "@/lib/mk9-reports/period.server";
import {
  contractedVisitsForFrequencySegments,
  type ContractedResult,
  type FrequencySegmentInput,
} from "@/lib/mk9-frequency/segments";
import { freqKey, loadFrequencyVersionsForPeriod, segmentsForWindow } from "@/lib/mk9-frequency/versions.server";

import {
  INDUSTRY_STATUS_LABEL,
  INDUSTRY_STATUS_ORDER,
  type DashboardAlert,
  type DashboardFilters,
  type DashboardIndustryRow,
  type DashboardOverview,
  type DashboardPromoterRow,
  type DashboardSeriesPoint,
  type DashboardStoreRow,
  type IndustryStatusKey,
  type PromoterResolution,
  type StoreExecStatus,
} from "./types";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DEFAULT_CONFIG = (industryId: string): PeriodConfig => ({
  industryId,
  periodType: "CALENDAR_MONTH",
  startDay: 1,
  endDay: 31,
  usesPreviousMonth: false,
  weekGrouping: "CALENDAR_WEEK",
  active: true,
});

function todayIso(): string {
  // Data operacional em São Paulo (fuso da operação).
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

function dayDiff(a: string, b: string) {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86400000);
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Contratadas de uma loja na janela: mensal explícita, senão semanal × (dias/7). */
function contractedFromFrequency(weekly: number | null, monthly: number | null, totalDays: number) {
  if (monthly != null && Number.isFinite(monthly) && monthly > 0) return Math.max(0, Math.round(monthly));
  if (weekly != null && Number.isFinite(weekly) && weekly > 0) {
    return Math.max(0, Math.round(weekly * (Math.max(1, totalDays) / 7)));
  }
  return 0;
}

/**
 * Fração do período já transcorrida até hoje.
 *   período futuro   -> 0
 *   período encerrado-> 1
 *   período corrente -> dias transcorridos / total de dias
 */
function elapsedFraction(win: { startDate: string; endDate: string; totalDays: number }, today: string) {
  if (today < win.startDate) return 0;
  if (today > win.endDate) return 1;
  const elapsed = dayDiff(win.startDate, today) + 1;
  return Math.min(1, Math.max(0, elapsed / Math.max(1, win.totalDays)));
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

interface StoreBucket {
  storeId: string;
  storeName: string;
  chain: string | null;
  uf: string | null;
  weekly: number | null;
  monthly: number | null;
  visits: string[];
}

interface IndustryCtx {
  id: string;
  name: string;
  win: { startDate: string; endDate: string; totalDays: number };
  fraction: number;
  buckets: Map<string, StoreBucket>;
  checklistImports: number;
}

export async function buildDashboardOverview(
  supabase: any,
  filters: DashboardFilters,
): Promise<DashboardOverview> {
  const today = todayIso();
  const { year, month } = filters;

  // ---- escopo do supervisor (mk9_user_scopes) --------------------------------
  let scopeIndustryIds: string[] | null = null;
  let scopeUfs: string[] | null = null;
  if (filters.supervisorUserId) {
    const { data: scopes, error } = await supabase
      .from("mk9_user_scopes")
      .select("scope_type, scope_value")
      .eq("user_id", filters.supervisorUserId);
    if (error) throw new Error(error.message);
    const inds = (scopes ?? []).filter((s: any) => s.scope_type === "INDUSTRY").map((s: any) => s.scope_value);
    const ufs = (scopes ?? []).filter((s: any) => s.scope_type === "UF").map((s: any) => s.scope_value);
    if (inds.length) scopeIndustryIds = inds;
    if (ufs.length) scopeUfs = ufs;
  }
  // Escopo de acesso do usuário (Fase 0.2) — sempre intersectado, nunca ampliado.
  const access = filters.access ?? null;
  if (access?.allowedIndustryIds) {
    scopeIndustryIds = scopeIndustryIds
      ? scopeIndustryIds.filter((id) => access.allowedIndustryIds!.includes(id))
      : access.allowedIndustryIds;
  }
  if (access?.allowedUfs) {
    scopeUfs = scopeUfs ? scopeUfs.filter((u) => access.allowedUfs!.includes(u)) : access.allowedUfs;
  }
  const accessStoreIds = access?.allowedStoreIds ?? null;
  const accessPromoterIds = access?.allowedPromoterIds ?? null;
  const ufFilter = filters.uf ?? null;
  if (
    (filters.industryId && access?.allowedIndustryIds && !access.allowedIndustryIds.includes(filters.industryId)) ||
    (ufFilter && access?.allowedUfs && !access.allowedUfs.includes(ufFilter)) ||
    (filters.promoterId && accessPromoterIds && !accessPromoterIds.includes(filters.promoterId)) ||
    scopeIndustryIds?.length === 0 ||
    scopeUfs?.length === 0 ||
    accessStoreIds?.length === 0
  ) {
    return emptyOverview(todayIso(), year, month, `${year}-01-01`, `${year}-12-31`);
  }

  // ---- indústrias e configurações de período --------------------------------
  let indQuery = supabase.from("mk9_industries").select("id,name").order("name", { ascending: true });
  if (filters.industryId) indQuery = indQuery.eq("id", filters.industryId);
  if (scopeIndustryIds) indQuery = indQuery.in("id", scopeIndustryIds);

  const [indRes, cfgRes] = await Promise.all([
    indQuery,
    supabase
      .from("mk9_industry_period_config")
      .select("industry_id, period_type, start_day, end_day, uses_previous_month, week_grouping, active")
      .eq("active", true),
  ]);
  if (indRes.error) throw new Error(indRes.error.message);
  if (cfgRes.error) throw new Error(cfgRes.error.message);

  const industries = (indRes.data ?? []) as Array<{ id: string; name: string }>;
  const cfgByIndustry = new Map<string, PeriodConfig>();
  for (const c of cfgRes.data ?? []) {
    cfgByIndustry.set(c.industry_id, {
      industryId: c.industry_id,
      periodType: c.period_type,
      startDay: c.start_day,
      endDay: c.end_day,
      usesPreviousMonth: c.uses_previous_month,
      weekGrouping: c.week_grouping,
      active: c.active,
    });
  }

  const ctxs: IndustryCtx[] = industries.map((ind) => {
    const win = resolveWindow(cfgByIndustry.get(ind.id) ?? DEFAULT_CONFIG(ind.id), year, month);
    return {
      id: ind.id,
      name: ind.name,
      win: { startDate: win.startDate, endDate: win.endDate, totalDays: win.totalDays },
      fraction: elapsedFraction(win, today),
      buckets: new Map(),
      checklistImports: 0,
    };
  });
  const ctxById = new Map(ctxs.map((c) => [c.id, c]));
  const industryIds = ctxs.map((c) => c.id);

  const globalStart = ctxs.length ? ctxs.reduce((a, c) => (c.win.startDate < a ? c.win.startDate : a), ctxs[0].win.startDate) : `${year}-01-01`;
  const globalEnd = ctxs.length ? ctxs.reduce((a, c) => (c.win.endDate > a ? c.win.endDate : a), ctxs[0].win.endDate) : `${year}-12-31`;

  if (!industryIds.length) {
    return emptyOverview(today, year, month, globalStart, globalEnd);
  }

  // ---- consultas em paralelo -------------------------------------------------
  const [freqRes, visitRes, routeRes, importRes, storeRes] = await Promise.all([
    supabase
      .from("mk9_industry_store_frequency")
      .select("industry_id, store_id, weekly_frequency, monthly_frequency, store:mk9_stores(id,name,chain,uf)")
      .in("industry_id", industryIds)
      .limit(50000),
    supabase
      .from("mk9_actual_visits")
      .select("industry_id, store_id, scheduled_date, store:mk9_stores(id,name,chain,uf)")
      .in("industry_id", industryIds)
      .gte("scheduled_date", globalStart)
      .lte("scheduled_date", globalEnd)
      .limit(100000),
    supabase
      .from("mk9_planned_routes")
      .select("industry_id, store_id, promoter_id, weekday, valid_from, valid_until, promoter:mk9_promoters(id,name)")
      .in("industry_id", industryIds)
      .eq("is_active", true)
      .is("archived_at", null)
      .lte("valid_from", globalEnd)
      .or(`valid_until.is.null,valid_until.gte.${globalStart}`)
      .limit(100000),
    supabase
      .from("mk9_checklist_imports")
      .select("id, industry_id, status")
      .in("industry_id", industryIds)
      .eq("operation_month", month)
      .eq("operation_year", year)
      .in("status", ["done", "confirmed", "committing"])
      .limit(5000),
    (() => {
      let q = supabase.from("mk9_stores").select("uf").not("uf", "is", null).limit(50000);
      if (scopeUfs) q = q.in("uf", scopeUfs);
      if (accessStoreIds) q = q.in("id", accessStoreIds);
      return q;
    })(),
  ]);
  for (const r of [freqRes, visitRes, routeRes, importRes, storeRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const availableUfs = Array.from(
    new Set((storeRes.data ?? []).map((s: any) => s.uf).filter(Boolean) as string[]),
  ).sort();

  for (const imp of importRes.data ?? []) {
    const ctx = ctxById.get(imp.industry_id);
    if (ctx) ctx.checklistImports += 1;
  }

  // ---- roteiro vigente: promotor + dias previstos por (indústria, loja) ------
  interface RouteInfo {
    votes: Map<string, { name: string; count: number }>;
    weekdays: Set<number>;
  }
  const routeByKey = new Map<string, RouteInfo>();
  for (const r of routeRes.data ?? []) {
    if (!r.store_id) continue;
    const key = `${r.industry_id}|${r.store_id}`;
    const info = routeByKey.get(key) ?? { votes: new Map(), weekdays: new Set<number>() };
    info.weekdays.add(Number(r.weekday));
    if (r.promoter_id) {
      const cur = info.votes.get(r.promoter_id) ?? { name: r.promoter?.name ?? "—", count: 0 };
      cur.count += 1;
      info.votes.set(r.promoter_id, cur);
    }
    routeByKey.set(key, info);
  }
  function resolvePromoter(key: string): { id: string | null; name: string | null; resolution: PromoterResolution } {
    const info = routeByKey.get(key);
    if (!info || info.votes.size === 0) return { id: null, name: null, resolution: "UNASSIGNED_ROUTE" };
    let best: { id: string; name: string; count: number } | null = null;
    for (const [pid, v] of info.votes) {
      if (!best || v.count > best.count) best = { id: pid, name: v.name, count: v.count };
    }
    return {
      id: best!.id,
      name: best!.name,
      resolution: info.votes.size > 1 ? "AMBIGUOUS_ROUTE" : "MATCHED_ROUTE",
    };
  }

  // ---- montagem dos buckets por (indústria, loja) ---------------------------
  const passesUf = (uf: string | null) => {
    if (ufFilter && uf !== ufFilter) return false;
    if (scopeUfs && (!uf || !scopeUfs.includes(uf))) return false;
    return true;
  };
  const passesStore = (storeId: string) => !accessStoreIds || accessStoreIds.includes(storeId);
  const touch = (ctx: IndustryCtx, storeId: string, store: any) => {
    let b = ctx.buckets.get(storeId);
    if (!b) {
      b = {
        storeId,
        storeName: store?.name ?? "—",
        chain: store?.chain ?? null,
        uf: store?.uf ?? null,
        weekly: null,
        monthly: null,
        visits: [],
      };
      ctx.buckets.set(storeId, b);
    }
    return b;
  };

  for (const f of freqRes.data ?? []) {
    const ctx = ctxById.get(f.industry_id);
    if (!ctx || !f.store_id) continue;
    if (!passesUf(f.store?.uf ?? null)) continue;
    if (!passesStore(f.store_id)) continue;
    const b = touch(ctx, f.store_id, f.store);
    b.weekly = (f.weekly_frequency as number | null) ?? b.weekly;
    b.monthly = (f.monthly_frequency as number | null) ?? b.monthly;
  }
  for (const v of visitRes.data ?? []) {
    const ctx = ctxById.get(v.industry_id);
    if (!ctx || !v.store_id) continue;
    const d = String(v.scheduled_date);
    if (d < ctx.win.startDate || d > ctx.win.endDate) continue; // respeita a janela da indústria
    if (!passesUf(v.store?.uf ?? null)) continue;
    if (!passesStore(v.store_id)) continue;
    const b = touch(ctx, v.store_id, v.store);
    b.visits.push(d);
  }

  // ---- linhas por loja -------------------------------------------------------
  const storeRows: DashboardStoreRow[] = [];
  for (const ctx of ctxs) {
    for (const b of ctx.buckets.values()) {
      const key = `${ctx.id}|${b.storeId}`;
      const promo = resolvePromoter(key);
      if (filters.promoterId && promo.id !== filters.promoterId) continue;
      if (accessPromoterIds && (!promo.id || !accessPromoterIds.includes(promo.id))) continue;

      const contratadas = contractedFromFrequency(b.weekly, b.monthly, ctx.win.totalDays);
      const realizadas = b.visits.length;
      const expectedToDate = Math.round(contratadas * ctx.fraction);
      const lastVisit = b.visits.length ? b.visits.slice().sort()[b.visits.length - 1] : null;
      const status: StoreExecStatus =
        realizadas === 0 ? "NAO_ATENDIDA" : contratadas > 0 && realizadas >= contratadas ? "INTEGRAL" : "PARCIAL";
      storeRows.push({
        storeId: b.storeId,
        storeName: b.storeName,
        chain: b.chain,
        uf: b.uf,
        industryId: ctx.id,
        industryName: ctx.name,
        weeklyFrequency: b.weekly,
        monthlyFrequency: b.monthly,
        contratadas,
        expectedToDate,
        realizadas,
        pendentes: Math.max(0, contratadas - realizadas),
        lastVisit,
        daysWithoutVisit: lastVisit ? Math.max(0, dayDiff(lastVisit, today)) : null,
        promoterId: promo.id,
        promoterName: promo.name,
        promoterResolution: promo.resolution,
        status,
      });
    }
  }

  // ---- linhas por indústria --------------------------------------------------
  // Indústrias sem qualquer operação no período (sem frequência, sem execução e
  // sem roteiro vigente) são cadastros inativos e ficam fora do painel.
  const industriesWithRoute = new Set(Array.from(routeByKey.keys()).map((k) => k.split("|")[0]));
  const industryRows: DashboardIndustryRow[] = ctxs
    .filter((ctx) => {
      const rows = storeRows.filter((s) => s.industryId === ctx.id);
      const hasAny =
        rows.some((s) => s.contratadas > 0 || s.realizadas > 0) ||
        industriesWithRoute.has(ctx.id) ||
        ctx.checklistImports > 0;
      return hasAny;
    })
    .map((ctx) => {
    const rows = storeRows.filter((s) => s.industryId === ctx.id);
    const contratadas = rows.reduce((a, s) => a + s.contratadas, 0);
    const realizadas = rows.reduce((a, s) => a + s.realizadas, 0);
    const expectedToDate = Math.round(contratadas * ctx.fraction);
    const lojasAtendidas = rows.filter((s) => s.realizadas > 0).length;
    const lojasContratadas = rows.filter((s) => s.contratadas > 0).length;
    const status = classifyIndustry({
      contratadas,
      realizadas,
      expectedToDate,
      lojasContratadas,
      checklistImports: ctx.checklistImports,
      hasExecutionOrRoute: realizadas > 0 || industriesWithRoute.has(ctx.id),
    });
    return {
      industryId: ctx.id,
      industryName: ctx.name,
      windowStart: ctx.win.startDate,
      windowEnd: ctx.win.endDate,
      totalDays: ctx.win.totalDays,
      elapsedDays: Math.round(ctx.win.totalDays * ctx.fraction),
      isHistorical: ctx.win.endDate < today,
      lojasContratadas,
      lojasAtendidas,
      contratadas,
      expectedToDate,
      realizadas,
      pendentes: Math.max(0, contratadas - realizadas),
      coberturaPct: contratadas > 0 ? Math.min(100, pct(realizadas, contratadas)) : 0,
      deviation: realizadas - expectedToDate,
      pacePercentage: expectedToDate > 0 ? pct(realizadas, expectedToDate) : realizadas > 0 ? 100 : 0,
      status,
      checklistImports: ctx.checklistImports,
    };
  });

  industryRows.sort((a, b) => {
    const d = INDUSTRY_STATUS_ORDER.indexOf(a.status) - INDUSTRY_STATUS_ORDER.indexOf(b.status);
    if (d !== 0) return d;
    return a.coberturaPct - b.coberturaPct;
  });

  // ---- KPIs ------------------------------------------------------------------
  const contractedTotal = storeRows.reduce((a, s) => a + s.contratadas, 0);
  const realizedToDate = storeRows.reduce((a, s) => a + s.realizadas, 0);
  const expectedToDate = industryRows.reduce((a, i) => a + i.expectedToDate, 0);
  const extras = storeRows.reduce((a, s) => a + Math.max(0, s.realizadas - s.contratadas), 0);
  const pendentes = Math.max(0, contractedTotal - realizedToDate);
  const lojasAtendidas = new Set(storeRows.filter((s) => s.realizadas > 0).map((s) => s.storeId)).size;
  const lojasContratadas = new Set(storeRows.filter((s) => s.contratadas > 0).map((s) => s.storeId)).size;
  const lojasSemVisita = storeRows.filter((s) => s.contratadas > 0 && s.realizadas === 0).length;
  const visitasSemPromotor = storeRows
    .filter((s) => s.promoterResolution !== "MATCHED_ROUTE")
    .reduce((a, s) => a + s.realizadas, 0);
  const industriasEmRisco = industryRows.filter(
    (i) => i.status === "CRITICA" || i.status === "ATENCAO" || i.status === "SEM_CHECKLIST" || i.status === "SEM_FREQUENCIA",
  ).length;

  const kpis = {
    contractedTotal,
    expectedToDate,
    realizedToDate,
    deviation: realizedToDate - expectedToDate,
    pacePercentage: expectedToDate > 0 ? pct(realizedToDate, expectedToDate) : realizedToDate > 0 ? 100 : 0,
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

  // ---- série acumulada: esperado (proporcional) × realizado ------------------
  const series = buildSeries(ctxs, industryRows, storeRows, globalStart, globalEnd, today);

  // ---- promotores ------------------------------------------------------------
  const promoters = buildPromoters(storeRows, ctxs, routeByKey);

  // ---- lojas críticas --------------------------------------------------------
  const criticalAll = storeRows
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

  // ---- alertas ---------------------------------------------------------------
  const alerts = buildAlerts(industryRows, storeRows, promoters);

  const storeExecutionDistribution = [
    { key: "INTEGRAL" as StoreExecStatus, label: "Integral", value: storeRows.filter((s) => s.status === "INTEGRAL").length },
    { key: "PARCIAL" as StoreExecStatus, label: "Parcial", value: storeRows.filter((s) => s.status === "PARCIAL").length },
    { key: "NAO_ATENDIDA" as StoreExecStatus, label: "Não atendida", value: storeRows.filter((s) => s.status === "NAO_ATENDIDA").length },
  ];
  const industryStatusDistribution = INDUSTRY_STATUS_ORDER.map((key) => ({
    key,
    label: INDUSTRY_STATUS_LABEL[key],
    value: industryRows.filter((i) => i.status === key).length,
  })).filter((d) => d.value > 0);

  return {
    generatedAt: new Date().toISOString(),
    today,
    periodLabel: `${MONTHS_PT[month - 1]}/${year}`,
    windowStart: globalStart,
    windowEnd: globalEnd,
    usesHistoricalFrequency: globalEnd < today,
    checklistImports: ctxs.reduce((a, c) => a + c.checklistImports, 0),
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
    availableUfs,
  };
}

// ---------------------------------------------------------------------------

export function classifyIndustry(input: {
  contratadas: number;
  realizadas: number;
  expectedToDate: number;
  lojasContratadas: number;
  checklistImports: number;
  hasExecutionOrRoute: boolean;
}): IndustryStatusKey {
  const { contratadas, realizadas, expectedToDate, lojasContratadas, checklistImports, hasExecutionOrRoute } = input;
  // Sem frequência configurada, mas com execução ou roteiro vigente.
  if (contratadas <= 0 && lojasContratadas <= 0) return "SEM_FREQUENCIA";
  if (realizadas === 0 && checklistImports === 0) return "SEM_CHECKLIST";
  if (realizadas >= contratadas) return "CONCLUIDA";
  if (expectedToDate <= 0) return "EM_DIA";
  if (realizadas >= expectedToDate) return "EM_DIA";
  const ratio = realizadas / expectedToDate;
  if (ratio >= 0.9) return "ATENCAO";
  return "CRITICA";
}

function buildSeries(
  ctxs: IndustryCtx[],
  industryRows: DashboardIndustryRow[],
  storeRows: DashboardStoreRow[],
  globalStart: string,
  globalEnd: string,
  today: string,
): DashboardSeriesPoint[] {
  const contractedByIndustry = new Map<string, number>();
  for (const i of industryRows) contractedByIndustry.set(i.industryId, i.contratadas);

  // realizadas por dia (todas as indústrias no escopo já filtrado)
  const realizedByDay = new Map<string, number>();
  const visitsByStoreRow = storeRows; // já filtrado por UF/promotor
  const ctxWindows = new Map(ctxs.map((c) => [c.id, c.win]));
  for (const s of visitsByStoreRow) {
    // reconstroi datas a partir do bucket original
    const ctx = ctxs.find((c) => c.id === s.industryId);
    const bucket = ctx?.buckets.get(s.storeId);
    for (const d of bucket?.visits ?? []) {
      realizedByDay.set(d, (realizedByDay.get(d) ?? 0) + 1);
    }
  }

  const points: DashboardSeriesPoint[] = [];
  const totalDaysSpan = dayDiff(globalStart, globalEnd);
  if (totalDaysSpan < 0 || totalDaysSpan > 400) return points;

  let realizedAcc = 0;
  for (let i = 0; i <= totalDaysSpan; i += 1) {
    const date = addDays(globalStart, i);
    realizedAcc += realizedByDay.get(date) ?? 0;
    // esperado acumulado: meta contratada distribuída linearmente na janela de cada indústria
    let expectedAcc = 0;
    for (const [industryId, contracted] of contractedByIndustry) {
      const win = ctxWindows.get(industryId);
      if (!win) continue;
      if (date < win.startDate) continue;
      const frac = date >= win.endDate ? 1 : (dayDiff(win.startDate, date) + 1) / Math.max(1, win.totalDays);
      expectedAcc += contracted * frac;
    }
    const expected = Math.round(expectedAcc);
    points.push({
      date,
      expected,
      realized: date > today ? realizedAcc : realizedAcc,
      diff: realizedAcc - expected,
    });
  }
  return points;
}

function buildPromoters(
  storeRows: DashboardStoreRow[],
  ctxs: IndustryCtx[],
  routeByKey: Map<string, { votes: Map<string, { name: string; count: number }>; weekdays: Set<number> }>,
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
      : s.promoterName ?? "—";
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

    // visitas fora do dia previsto pelo roteiro vigente
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
      const coberturaPct = a.expected > 0 ? Math.min(100, pct(a.realized, a.expected)) : a.realized > 0 ? 100 : 0;
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
    .sort((a, b) => a.coberturaPct - b.coberturaPct || a.promoterName.localeCompare(b.promoterName, "pt-BR"));
}

const SEVERITY_RANK: Record<DashboardAlert["severity"], number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };

function buildAlerts(
  industries: DashboardIndustryRow[],
  stores: DashboardStoreRow[],
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
        industryId: i.industryId, storeId: null, promoterId: null, uf: null,
      });
    } else if (i.status === "SEM_CHECKLIST") {
      alerts.push({
        id: `ind-nochk-${i.industryId}`,
        kind: "CHECKLIST_NAO_IMPORTADO",
        severity: "ALTA",
        title: `${i.industryName} sem checklist importado`,
        description: `${i.contratadas} visitas contratadas no período e nenhuma execução registrada.`,
        industryId: i.industryId, storeId: null, promoterId: null, uf: null,
      });
    } else if (i.status === "SEM_FREQUENCIA") {
      alerts.push({
        id: `ind-nofreq-${i.industryId}`,
        kind: "FREQUENCIA_NAO_CADASTRADA",
        severity: "ALTA",
        title: `${i.industryName} sem frequência cadastrada`,
        description: "Há execução ou roteiro, mas nenhuma frequência contratada configurada.",
        industryId: i.industryId, storeId: null, promoterId: null, uf: null,
      });
    } else if (i.status === "ATENCAO") {
      alerts.push({
        id: `ind-meta-${i.industryId}`,
        kind: "INDUSTRIA_ABAIXO_META",
        severity: "MEDIA",
        title: `${i.industryName} abaixo da meta proporcional`,
        description: `Desvio de ${i.deviation} visitas em relação ao esperado até hoje.`,
        industryId: i.industryId, storeId: null, promoterId: null, uf: null,
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
      industryId: s.industryId, storeId: s.storeId, promoterId: s.promoterId, uf: s.uf,
    });
  }

  const abaixo = stores
    .filter((s) => s.realizadas > 0 && s.expectedToDate > 0 && s.realizadas / s.expectedToDate < 0.5)
    .sort((a, b) => (b.expectedToDate - b.realizadas) - (a.expectedToDate - a.realizadas));
  for (const s of abaixo.slice(0, 8)) {
    alerts.push({
      id: `store-low-${s.industryId}-${s.storeId}`,
      kind: "LOJA_ABAIXO_FREQUENCIA",
      severity: "MEDIA",
      title: `${s.storeName} muito abaixo da frequência`,
      description: `${s.realizadas} de ${s.expectedToDate} esperadas até hoje (${s.industryName}).`,
      industryId: s.industryId, storeId: s.storeId, promoterId: s.promoterId, uf: s.uf,
    });
  }

  const unassigned = stores.filter((s) => s.promoterResolution === "UNASSIGNED_ROUTE" && s.realizadas > 0);
  if (unassigned.length) {
    const total = unassigned.reduce((a, s) => a + s.realizadas, 0);
    alerts.push({
      id: "visits-unassigned",
      kind: "VISITA_UNASSIGNED",
      severity: "MEDIA",
      title: `${total} visitas sem roteiro vigente`,
      description: `${unassigned.length} lojas executadas sem promotor resolvido. Contam para indústria e loja.`,
      industryId: null, storeId: null, promoterId: null, uf: null,
    });
  }
  const ambiguous = stores.filter((s) => s.promoterResolution === "AMBIGUOUS_ROUTE" && s.realizadas > 0);
  if (ambiguous.length) {
    const total = ambiguous.reduce((a, s) => a + s.realizadas, 0);
    alerts.push({
      id: "visits-ambiguous",
      kind: "VISITA_AMBIGUOUS",
      severity: "MEDIA",
      title: `${total} visitas com roteiro ambíguo`,
      description: `${ambiguous.length} lojas com mais de um promotor vigente no período.`,
      industryId: null, storeId: null, promoterId: null, uf: null,
    });
  }

  for (const p of promoters.filter((x) => x.status === "CRITICA" && x.expectedToDate >= 5).slice(0, 5)) {
    alerts.push({
      id: `promoter-crit-${p.promoterId}`,
      kind: "PROMOTOR_CRITICO",
      severity: "ALTA",
      title: `${p.promoterName} com cobertura crítica`,
      description: `${p.realizadas} de ${p.expectedToDate} esperadas · ${p.storesWithoutVisit} lojas sem visita.`,
      industryId: null, storeId: null, promoterId: p.promoterId, uf: null,
    });
  }

  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

function emptyOverview(
  today: string, year: number, month: number, start: string, end: string,
): DashboardOverview {
  return {
    generatedAt: new Date().toISOString(),
    today,
    periodLabel: `${MONTHS_PT[month - 1]}/${year}`,
    windowStart: start,
    windowEnd: end,
    usesHistoricalFrequency: false,
    checklistImports: 0,
    kpis: {
      contractedTotal: 0, expectedToDate: 0, realizedToDate: 0, deviation: 0, pacePercentage: 0,
      realizadas: 0, pendentes: 0, extras: 0, coberturaPct: 0,
      lojasContratadas: 0, lojasAtendidas: 0, lojasSemVisita: 0,
      industriasTotal: 0, industriasEmRisco: 0, visitasSemPromotor: 0,
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
