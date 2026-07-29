// Leitura de dados MK9 para consumo pelas telas.
// Todas as leituras exigem sessão válida + papel (ver mk9-auth/read-guards.server)
// e são filtradas pelo escopo resolvido no servidor (mk9-auth/access-scope.server).
// ESTRATÉGIA: cliente administrativo controlado (agregações e joins), sempre com
// restrições explícitas de indústria/UF/loja aplicadas na própria consulta.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const mk9ListIndustries = createServerFn({ method: "GET" }).handler(async () => {
  const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
  const { scope } = await requireMk9ReadScope();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (scope.allowedIndustryIds?.length === 0) return [];
  let q = supabaseAdmin
    .from("mk9_industries")
    .select(
      "id, name, monthly_contracted_frequency, monthly_estimated_frequency, frequency_difference, frequency_status, weeks_count, updated_at",
    )
    .order("name", { ascending: true });
  if (scope.allowedIndustryIds) q = q.in("id", scope.allowedIndustryIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    name: r.name as string,
    monthlyContractedFrequency: r.monthly_contracted_frequency as number | null,
    monthlyEstimatedFrequency: r.monthly_estimated_frequency as number | null,
    frequencyDifference: r.frequency_difference as number | null,
    frequencyStatus: r.frequency_status as string | null,
    weeksCount: r.weeks_count as number | null,
    updatedAt: r.updated_at as string,
  }));
});

export const mk9ListStores = createServerFn({ method: "GET" }).handler(async () => {
  const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
  const { scope } = await requireMk9ReadScope();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (scope.allowedUfs?.length === 0 || scope.allowedStoreIds?.length === 0) return [];
  let q = supabaseAdmin
    .from("mk9_stores")
    .select("id, name, chain, uf, updated_at")
    .order("name", { ascending: true });
  if (scope.allowedUfs) q = q.in("uf", scope.allowedUfs);
  if (scope.allowedStoreIds) q = q.in("id", scope.allowedStoreIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    chain: (r.chain as string | null) ?? null,
    name: r.name as string,
    uf: (r.uf as string | null) ?? null,
    updatedAt: r.updated_at as string,
  }));
});

export const mk9ListPromoters = createServerFn({ method: "GET" }).handler(async () => {
  const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
  const { scope } = await requireMk9ReadScope();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Escopo de promotor: explícito (mk9_user_scopes) ou derivado do roteiro
  // dentro das indústrias/UFs permitidas (resolvido em lote, sem N+1).
  let allowedPromoterIds: string[] | null = scope.allowedPromoterIds;
  if (!allowedPromoterIds && (scope.allowedIndustryIds || scope.allowedUfs || scope.allowedStoreIds)) {
    let rq = supabaseAdmin
      .from("mk9_planned_routes")
      .select("promoter_id, store:mk9_stores(uf)")
      .is("archived_at", null)
      .not("promoter_id", "is", null)
      .limit(50000);
    if (scope.allowedIndustryIds) rq = rq.in("industry_id", scope.allowedIndustryIds);
    if (scope.allowedStoreIds) rq = rq.in("store_id", scope.allowedStoreIds);
    const { data: routes, error: rErr } = await rq;
    if (rErr) throw new Error(rErr.message);
    allowedPromoterIds = Array.from(
      new Set(
        (routes ?? [])
          .filter((r: any) => !scope.allowedUfs || (r.store?.uf && scope.allowedUfs.includes(r.store.uf)))
          .map((r: any) => r.promoter_id as string),
      ),
    );
  }
  if (allowedPromoterIds?.length === 0) return [];

  let q = supabaseAdmin
    .from("mk9_promoters")
    .select("id, name, external_id, city, contact, notes, updated_at")
    .order("name", { ascending: true });
  if (allowedPromoterIds) q = q.in("id", allowedPromoterIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  // Dados pessoais (contato/observações) só para quem tem autorização.
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    externalId: (r.external_id as string | null) ?? null,
    name: r.name as string,
    city: (r.city as string | null) ?? null,
    contact: scope.canViewPersonalData ? ((r.contact as string | null) ?? null) : null,
    notes: scope.canViewPersonalData ? ((r.notes as string | null) ?? null) : null,
    updatedAt: r.updated_at as string,
  }));
});


export const mk9ListRoutesDetailed = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2100),
  }).parse(data))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (scope.allowedIndustryIds?.length === 0 || scope.allowedStoreIds?.length === 0 || scope.allowedUfs?.length === 0) return [];
    let q = supabaseAdmin
      .from("mk9_planned_routes")
      .select(
        "id, weekday, operation_month, operation_year, source_sheet, promoter:mk9_promoters(id,name,city), store:mk9_stores(id,name,chain,uf), industry:mk9_industries(id,name)",
      )
      .eq("operation_month", data.month)
      .eq("operation_year", data.year);
    if (scope.allowedIndustryIds) q = q.in("industry_id", scope.allowedIndustryIds);
    if (scope.allowedStoreIds) q = q.in("store_id", scope.allowedStoreIds);
    if (scope.allowedPromoterIds) q = q.in("promoter_id", scope.allowedPromoterIds);
    const { data: allRows, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (allRows ?? []).filter(
      (r: any) => !scope.allowedUfs || (r.store?.uf && scope.allowedUfs.includes(r.store.uf)),
    );

    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      weekday: r.weekday as number,
      sourceSheet: (r.source_sheet as string | null) ?? null,
      promoterId: r.promoter?.id ?? null,
      promoterName: r.promoter?.name ?? "—",
      promoterCity: r.promoter?.city ?? null,
      storeId: r.store?.id ?? null,
      storeName: r.store?.name ?? "—",
      storeChain: r.store?.chain ?? null,
      storeUf: r.store?.uf ?? null,
      industryId: r.industry?.id ?? null,
      industryName: r.industry?.name ?? "—",
    }));
  });

export const mk9ListVisitsDetailed = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2100),
  }).parse(data))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (scope.allowedIndustryIds?.length === 0 || scope.allowedStoreIds?.length === 0 || scope.allowedUfs?.length === 0) return [];
    const first = new Date(Date.UTC(data.year, data.month - 1, 1)).toISOString().slice(0, 10);
    const last = new Date(Date.UTC(data.year, data.month, 0)).toISOString().slice(0, 10);
    let q = supabaseAdmin
      .from("mk9_planned_visits")
      .select(
        "id, scheduled_date, status, source_sheet, promoter:mk9_promoters(id,name), store:mk9_stores(id,name,chain,uf), industry:mk9_industries(id,name)",
      )
      .gte("scheduled_date", first)
      .lte("scheduled_date", last)
      .is("archived_at", null)
      .order("scheduled_date", { ascending: true })
      .limit(5000);
    if (scope.allowedIndustryIds) q = q.in("industry_id", scope.allowedIndustryIds);
    if (scope.allowedStoreIds) q = q.in("store_id", scope.allowedStoreIds);
    if (scope.allowedPromoterIds) q = q.in("promoter_id", scope.allowedPromoterIds);
    const { data: allRows, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (allRows ?? []).filter(
      (r: any) => !scope.allowedUfs || (r.store?.uf && scope.allowedUfs.includes(r.store.uf)),
    );

    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      scheduledDate: r.scheduled_date as string,
      status: r.status as string,
      sourceSheet: (r.source_sheet as string | null) ?? null,
      promoterName: r.promoter?.name ?? "—",
      storeName: r.store?.name ?? "—",
      storeChain: r.store?.chain ?? null,
      storeUf: r.store?.uf ?? null,
      industryName: r.industry?.name ?? "—",
    }));
  });

export const mk9DashboardContractMetrics = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2100),
  }).parse(data))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveWindow } = await import("@/lib/mk9-reports/period.server");
    const empty = { contratadas: 0, executadas: 0, validas: 0, extras: 0, pendencias: 0, coverage: 0 };
    if (scope.allowedIndustryIds?.length === 0 || scope.allowedStoreIds?.length === 0 || scope.allowedUfs?.length === 0) return empty;

    // Fase 1B.3: contratadas vêm da frequência VERSIONADA, com a mesma
    // matemática proporcional do Dashboard/Auditoria/Relatório.
    // A antiga fórmula `weekly × 4` foi eliminada.
    const { contractedVisitsForFrequencySegments } = await import("@/lib/mk9-frequency/segments");
    const { loadFrequencyVersionsForPeriod, segmentsForWindow } = await import(
      "@/lib/mk9-frequency/versions.server"
    );

    let indQuery = supabaseAdmin.from("mk9_industries").select("id").limit(20000);
    if (scope.allowedIndustryIds) indQuery = indQuery.in("id", scope.allowedIndustryIds);

    const [
      { data: industryRows, error: indError },
      { data: configs, error: configError },
    ] = await Promise.all([
      indQuery,
      supabaseAdmin
        .from("mk9_industry_period_config")
        .select("industry_id, period_type, start_day, end_day, uses_previous_month, week_grouping")
        .eq("active", true)
        .limit(20000),
    ]);
    if (indError) throw new Error(indError.message);
    if (configError) throw new Error(configError.message);

    const industryIds = (industryRows ?? []).map((i: any) => i.id as string);
    if (!industryIds.length) return empty;

    const configByIndustry = new Map<string, any>();
    for (const cfg of configs ?? []) configByIndustry.set(cfg.industry_id as string, cfg);
    const windows = new Map<string, { startDate: string; endDate: string }>();
    for (const industryId of industryIds) {
      const cfg = configByIndustry.get(industryId) ?? {
        industryId,
        periodType: "CALENDAR_MONTH",
        startDay: 1,
        endDay: 31,
        usesPreviousMonth: false,
        weekGrouping: "CALENDAR_WEEK",
        active: true,
      };
      windows.set(industryId, resolveWindow(cfg, data.year, data.month));
    }
    const globalStart = Array.from(windows.values()).reduce(
      (a, w) => (w.startDate < a ? w.startDate : a),
      `${data.year}-12-31`,
    );
    const globalEnd = Array.from(windows.values()).reduce((a, w) => (w.endDate > a ? w.endDate : a), `${data.year}-01-01`);

    const freqVersions = await loadFrequencyVersionsForPeriod(supabaseAdmin, {
      industryIds,
      storeIds: scope.allowedStoreIds,
      periodStart: globalStart,
      periodEnd: globalEnd,
      accessScope: scope,
    });

    const perStore = new Map<string, { contratadas: number; executadas: number }>();
    for (const [key, segs] of freqVersions) {
      const industryId = key.slice(0, key.indexOf("|"));
      const win = windows.get(industryId);
      if (!win) continue;
      const inWindow = segmentsForWindow(segs, win.startDate, win.endDate);
      if (!inWindow.length) continue;
      const contracted = contractedVisitsForFrequencySegments({
        segments: inWindow,
        operationPeriodStart: win.startDate,
        operationPeriodEnd: win.endDate,
      });
      perStore.set(key, { contratadas: contracted.contratadas, executadas: 0 });
    }
    const scopedStoreIds = new Set(perStore.keys());

    const actualQueries = Array.from(windows.entries()).map(([industryId, window]) =>
      supabaseAdmin
        .from("mk9_actual_visits")
        .select("industry_id, store_id, scheduled_date")
        .eq("industry_id", industryId)
        .gte("scheduled_date", window.startDate)
        .lte("scheduled_date", window.endDate)
        .limit(20000),
    );
    const actualResults = await Promise.all(actualQueries);
    const actuals: any[] = [];
    for (const result of actualResults) {
      if (result.error) throw new Error(result.error.message);
      // Extras fora do escopo não podem vazar para os totais.
      actuals.push(...(result.data ?? []).filter((a: any) => scopedStoreIds.has(`${a.industry_id}|${a.store_id}`)));
    }

    for (const a of actuals) {
      const key = `${a.industry_id}|${a.store_id}`;
      const cur = perStore.get(key) ?? { contratadas: 0, executadas: 0 };
      cur.executadas += 1;
      perStore.set(key, cur);
    }


    let contratadas = 0;
    let executadas = 0;
    let extras = 0;
    for (const s of perStore.values()) {
      contratadas += s.contratadas;
      executadas += s.executadas;
      extras += Math.max(0, s.executadas - s.contratadas);
    }
    // Nova regra: realizadas é o total bruto do checklist (nunca reduzido).
    // Pendentes e cobertura globais usam contratadas - realizadas.
    const pendencias = Math.max(0, contratadas - executadas);
    const validas = Math.min(contratadas, executadas);
    const coverage = contratadas > 0 ? Math.min(100, Math.round((executadas / contratadas) * 100)) : 0;
    return { contratadas, executadas, validas, extras, pendencias, coverage };
  });
