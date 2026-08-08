/**
 * MK9 — Núcleo operacional compartilhado (Fase 3.1B): carregamento de dados.
 *
 * Uma única função carrega tudo que Dashboard e Cockpit precisam:
 * janelas por indústria, frequências versionadas, visitas, roteiros vigentes,
 * importações de checklist da competência e UFs disponíveis.
 *
 * NADA aqui inventa fórmula: os cálculos vivem em ./buckets.
 * Segurança: o escopo (`filters.access`) é sempre INTERSECTADO — filtros do
 * navegador nunca ampliam o que o usuário enxerga.
 */
import { resolveWindow, type PeriodConfig } from "@/lib/mk9-reports/period.server";
import { loadFrequencyVersionsForPeriod, segmentsForWindow } from "@/lib/mk9-frequency/versions.server";

import { buildIndustryRows, buildStoreRows } from "./buckets";
import { DEFAULT_PERIOD_CONFIG, elapsedFraction, todayIso } from "./periods";
import type { IndustryContext, OperationCore, OperationFilters, RouteInfo, StoreBucket } from "./types";

function emptyCore(
  today: string,
  year: number,
  month: number,
  globalStart: string,
  globalEnd: string,
  queryCount: number,
  startedAt: number,
): OperationCore {
  return {
    today,
    year,
    month,
    globalStart,
    globalEnd,
    empty: true,
    ctxs: [],
    ctxById: new Map(),
    routeByKey: new Map(),
    storeRows: [],
    industryRows: [],
    availableUfs: [],
    industryIds: [],
    checklistImportsTotal: 0,
    queryCount,
    coreMs: Math.round(Date.now() - startedAt),
  };
}

export async function loadOperationCore(supabase: any, filters: OperationFilters): Promise<OperationCore> {
  const startedAt = Date.now();
  const today = todayIso();
  const { year, month } = filters;
  let queryCount = 0;

  // ---- escopo do supervisor (mk9_user_scopes) --------------------------------
  let scopeIndustryIds: string[] | null = null;
  let scopeUfs: string[] | null = null;
  if (filters.supervisorUserId) {
    queryCount += 1;
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
    return emptyCore(today, year, month, `${year}-01-01`, `${year}-12-31`, queryCount, startedAt);
  }

  // ---- indústrias e configurações de período --------------------------------
  let indQuery = supabase.from("mk9_industries").select("id,name,requires_checklist,checklist_enabled_at").order("name", { ascending: true });
  if (filters.industryId) indQuery = indQuery.eq("id", filters.industryId);
  if (scopeIndustryIds) indQuery = indQuery.in("id", scopeIndustryIds);

  queryCount += 2;
  const [indRes, cfgRes] = await Promise.all([
    indQuery,
    supabase
      .from("mk9_industry_period_config")
      .select("industry_id, period_type, start_day, end_day, uses_previous_month, week_grouping, active")
      .eq("active", true),
  ]);
  if (indRes.error) throw new Error(indRes.error.message);
  if (cfgRes.error) throw new Error(cfgRes.error.message);

  const industries = (indRes.data ?? []) as Array<{ id: string; name: string; requires_checklist?: boolean; checklist_enabled_at?: string | null }>;
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

  const ctxs: IndustryContext[] = industries.map((ind) => {
    const win = resolveWindow(cfgByIndustry.get(ind.id) ?? DEFAULT_PERIOD_CONFIG(ind.id), year, month);
    const w = { startDate: win.startDate, endDate: win.endDate, totalDays: win.totalDays };
    return {
      id: ind.id,
      name: ind.name,
      requiresChecklist: ind.requires_checklist === true,
      checklistEnabledAt: ind.checklist_enabled_at ?? null,
      win: w,
      fraction: elapsedFraction(w, today),
      buckets: new Map(),
      checklistImports: 0,
    };
  });
  const ctxById = new Map(ctxs.map((c) => [c.id, c]));
  const industryIds = ctxs.map((c) => c.id);

  const globalStart = ctxs.length
    ? ctxs.reduce((a, c) => (c.win.startDate < a ? c.win.startDate : a), ctxs[0].win.startDate)
    : `${year}-01-01`;
  const globalEnd = ctxs.length
    ? ctxs.reduce((a, c) => (c.win.endDate > a ? c.win.endDate : a), ctxs[0].win.endDate)
    : `${year}-12-31`;

  if (!industryIds.length) {
    return emptyCore(today, year, month, globalStart, globalEnd, queryCount, startedAt);
  }

  // ---- consultas em paralelo -------------------------------------------------
  // BLINDAGEM: Envolvemos as consultas em um bloco que captura falhas individuais.
  // Se uma consulta de visitas falhar, o dashboard ainda carrega o roteiro.
  queryCount += 5;
  const { listBulkOperationalActualVisits } = await import("./operational-visits.server");
  
  const safeQuery = async (promise: Promise<any>, fallback: any = { data: [], error: null }) => {
    try {
      const res = await promise;
      if (res && res.error) {
        console.error("[CORE_QUERY_ERROR]", res.error);
        return fallback;
      }
      return res;
    } catch (e) {
      console.error("[CORE_CRITICAL_ERROR]", e);
      return fallback;
    }
  };
  
  // Otimização: Promise.all centralizado para evitar N+1
  const [freqVersions, bulkVisits, routeRes, importRes, storeRes] = await Promise.all([
    loadFrequencyVersionsForPeriod(supabase, {
      industryIds,
      storeIds: accessStoreIds,
      periodStart: globalStart,
      periodEnd: globalEnd,
      accessScope: access,
    }).catch(err => {
      console.error("[CORE_FREQ_ERROR]", err);
      return new Map();
    }),
    safeQuery(listBulkOperationalActualVisits({ 
      industryIds, 
      startDate: globalStart, 
      endDate: globalEnd 
    })),
    safeQuery(supabase
      .from("mk9_planned_routes")
      .select("industry_id, store_id, promoter_id, weekday, valid_from, valid_until, promoter:mk9_promoters(id,name,employee_number)")
      .in("industry_id", industryIds)
      .eq("is_active", true)
      .is("archived_at", null)
      .lte("valid_from", globalEnd)
      .or(`valid_until.is.null,valid_until.gte.${globalStart}`)
      .limit(100000)),
    safeQuery(supabase
      .from("mk9_checklist_imports")
      .select("id, industry_id, status")
      .in("industry_id", industryIds)
      .eq("operation_month", month)
      .eq("operation_year", year)
      .in("status", ["done", "confirmed", "committing"])
      .limit(5000)),
    safeQuery((() => {
      let q = supabase.from("mk9_stores").select("uf").not("uf", "is", null).limit(50000);
      if (scopeUfs) q = q.in("uf", scopeUfs);
      if (accessStoreIds) q = q.in("id", accessStoreIds);
      return q;
    })()),
  ]);
  
  // Normalizar bulkVisits
  const visitRes = Array.isArray(bulkVisits) ? { data: bulkVisits } : { data: (bulkVisits as any)?.data || [] };

  // BLINDAGEM: Não lançamos erro se uma query secundária falhar. O dashboard deve tentar renderizar.
  // if (r.error) throw new Error(r.error.message); // REMOVIDO PARA PROTEÇÃO


  const availableUfs = Array.from(
    new Set((storeRes.data ?? []).map((s: any) => s.uf).filter(Boolean) as string[]),
  ).sort();

  for (const imp of importRes.data ?? []) {
    const ctx = ctxById.get(imp.industry_id);
    if (ctx) ctx.checklistImports += 1;
  }

  // ---- roteiro vigente: promotor + dias previstos por (indústria, loja) ------
  const routeByKey = new Map<string, RouteInfo & { promoterEmployeeNumber?: string | null }>();
  for (const r of routeRes.data ?? []) {
    if (!r.store_id) continue;
    const key = `${r.industry_id}|${r.store_id}`;
    const info = (routeByKey.get(key) ?? { votes: new Map(), weekdays: new Set<number>() }) as any;
    info.weekdays.add(Number(r.weekday));
    if (r.promoter_id) {
      const cur = info.votes.get(r.promoter_id) ?? { name: r.promoter?.name ?? "—", employeeNumber: r.promoter?.employee_number ?? null, count: 0 };
      cur.count += 1;
      info.votes.set(r.promoter_id, cur);
      if (!info.promoterEmployeeNumber && r.promoter?.employee_number) {
        info.promoterEmployeeNumber = r.promoter.employee_number;
      }
    }
    routeByKey.set(key, info);
  }

  // ---- buckets por (indústria, loja) ----------------------------------------
  const passesUf = (uf: string | null) => {
    if (ufFilter && uf !== ufFilter) return false;
    if (scopeUfs && (!uf || !scopeUfs.includes(uf))) return false;
    return true;
  };
  const passesStore = (storeId: string) => !accessStoreIds || accessStoreIds.includes(storeId);
  const touch = (ctx: IndustryContext, storeId: string, store: any): StoreBucket => {
    let b = ctx.buckets.get(storeId);
    if (!b) {
      b = {
        storeId,
        storeName: store?.name ?? "—",
        chain: store?.chain ?? null,
        uf: store?.uf ?? null,
        weekly: null,
        monthly: null,
        segments: [],
        visits: [],
      };
      ctx.buckets.set(storeId, b);
    }
    return b;
  };

  for (const [key, segs] of freqVersions) {
    const [industryId, storeId] = key.split("|");
    const ctx = ctxById.get(industryId);
    if (!ctx || !storeId) continue;
    const inWindow = segmentsForWindow(segs, ctx.win.startDate, ctx.win.endDate);
    if (!inWindow.length) continue;
    const store = inWindow[0].store;
    if (!passesUf(store?.uf ?? null)) continue;
    if (!passesStore(storeId)) continue;
    const b = touch(ctx, storeId, store);
    b.segments = inWindow.map((s) => ({
      validFrom: s.validFrom,
      validUntil: s.validUntil,
      weeklyFrequency: s.weeklyFrequency,
      monthlyFrequency: s.monthlyFrequency,
    }));
    const last = inWindow[inWindow.length - 1];
    b.weekly = last.weeklyFrequency;
    b.monthly = last.monthlyFrequency;
  }

  // Nota: O filtro operacional (is_operational_current) deve ser aplicado aqui para dashboards
  // se quisermos paridade absoluta com o PDF.
  // ---- processamento de visitas operacionais ----
  // A filtragem operacional já foi realizada na query inicial via getOperationalVisits.
  // Aqui apenas distribuímos as visitas nos buckets correspondentes.
  for (const v of visitRes.data ?? []) {
    const ctx = ctxById.get(v.industry_id);
    if (!ctx || !v.store_id) continue;
    
    const d = String(v.scheduled_date);
    // Embora a query já filtre, mantemos a verificação de segurança por janela específica da indústria
    if (d < ctx.win.startDate || d > ctx.win.endDate) continue;
    if (!passesUf(v.store?.uf ?? null)) continue;
    if (!passesStore(v.store_id)) continue;
    touch(ctx, v.store_id, v.store).visits.push(d);
  }

  const storeRows = buildStoreRows({
    ctxs,
    routeByKey,
    today,
    promoterFilter: filters.promoterId ?? null,
    allowedPromoterIds: accessPromoterIds,
  });
  const industriesWithRoute = new Set(Array.from(routeByKey.keys()).map((k) => k.split("|")[0]));
  const industryRows = buildIndustryRows({ ctxs, storeRows, industriesWithRoute, today });

  return {
    today,
    year,
    month,
    globalStart,
    globalEnd,
    empty: false,
    ctxs,
    ctxById,
    routeByKey,
    storeRows,
    industryRows,
    availableUfs,
    industryIds,
    checklistImportsTotal: ctxs.reduce((a, c) => a + c.checklistImports, 0),
    queryCount,
    coreMs: Math.round(Date.now() - startedAt),
  };
}
