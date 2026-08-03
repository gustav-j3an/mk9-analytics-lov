import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireMk9Role, logAudit } from "./mk9-auth/require-role.server";

const cleanupFilterSchema = z.object({
  industryId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

const cleanupExecuteSchema = z.object({
  industryId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  importIds: z.array(z.string().uuid()),
  justification: z.string().min(10),
  options: z.object({
    revertVisits: z.boolean(),
    archiveFrequencies: z.boolean(),
    closeFutureVigencies: z.boolean(),
  }),
});

export const getCleanupPreview = createServerFn({ method: "POST" })
  .inputValidator((data) => cleanupFilterSchema.parse(data))
  .handler(async ({ data }) => {
    await requireMk9Role(["ADMIN"]);

    // 1. Localiza importações
    const { data: imports, error } = await supabaseAdmin
      .from("mk9_checklist_imports")
      .select("id, filename, started_at, user_id, status, counters, batch_id")
      .eq("industry_id", data.industryId)
      .eq("operation_month", data.month)
      .eq("operation_year", data.year)
      .order("started_at", { ascending: false });

    if (error) throw new Error(error.message);

    const importIds = (imports || []).map(i => i.id);

    // 2. Impacto de visitas
    const { count: visitsCount } = await supabaseAdmin
      .from("mk9_actual_visits")
      .select("*", { count: 'exact', head: true })
      .in("source_import_id", importIds);

    // 3. Frequências afetadas
    const { data: freqs } = await supabaseAdmin
      .from("mk9_industry_store_frequency_versions")
      .select("id, valid_from, valid_until, source_type")
      .eq("industry_id", data.industryId)
      .in("source_import_id", importIds)
      .is("archived_at", null);

    return {
      imports: (imports || []).map(i => ({
        ...i,
        is_operational_current: false // Placeholder for type safety until migration is confirmed
      })),
      impact: {
        visits: visitsCount || 0,
        frequencies: freqs?.length || 0,
        futureAffected: freqs?.filter(f => !f.valid_until).length || 0,
      }
    };
  });

export const executeCleanup = createServerFn({ method: "POST" })
  .inputValidator((data) => cleanupExecuteSchema.parse(data))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN"]);
    
    // 1. Reverte visitas
    let visitsRemoved = 0;
    if (data.options.revertVisits) {
      const { count } = await supabaseAdmin
        .from("mk9_actual_visits")
        .delete({ count: 'exact' })
        .in("source_import_id", data.importIds);
      visitsRemoved = count || 0;
    }

    // 2. Arquiva frequências
    let frequenciesArchived = 0;
    if (data.options.archiveFrequencies) {
      const { count } = await supabaseAdmin
        .from("mk9_industry_store_frequency_versions")
        .update({ 
          archived_at: new Date().toISOString()
        } as any)
        .in("source_import_id", data.importIds);
      frequenciesArchived = count || 0;
    }

    // 3. Marca importações como revertidas
    await supabaseAdmin
      .from("mk9_checklist_imports")
      .update({ 
        status: "reverted", 
        error_message: `Limpeza administrativa: ${data.justification}`
      } as any)
      .in("id", data.importIds);

    await logAudit(ctx, "mk9.admin.cleanup", "mk9_checklist_imports", data.industryId, {
      industryId: data.industryId,
      month: data.month,
      year: data.year,
      justification: data.justification,
      importIds: data.importIds,
      visitsRemoved,
      frequenciesArchived
    });

    return { success: true, visitsRemoved, frequenciesArchived };
  });

export const getCleanupDiagnosis = createServerFn({ method: "POST" })
  .inputValidator((data) => cleanupFilterSchema.parse(data))
  .handler(async ({ data }) => {
    console.log("[CLEANUP DIAGNOSIS START]", { industryId: data.industryId, month: data.month, year: data.year });
    await requireMk9Role(["ADMIN"]);
    
    const { industryId, month, year } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPeriodConfig, resolveWindow } = await import("@/lib/mk9-reports/period.server");
    const { buildIndustryReport } = await import("@/lib/mk9-reports/industry-report.server");

    // 1. Resolver janela exata do PDF
    const cfg = await loadPeriodConfig(supabaseAdmin, industryId);
    const window = resolveWindow(cfg, year, month);
    const startDate = window.startDate;
    const endDate = window.endDate;
    
    console.log("[CLEANUP PERIOD RESOLVED]", { startDate, endDate });

    // 2. Executar o motor do relatório para pegar os números oficiais
    const report = await buildIndustryReport(supabaseAdmin, {
      industryId, year, month
    }, window);

    // 3. Cruzar com fontes de dados para o Trace
    const results = await Promise.allSettled([
      supabaseAdmin
        .from("mk9_checklist_imports")
        .select("id, filename, started_at, user_id, status, counters, batch_id")
        .eq("industry_id", industryId)
        .eq("operation_month", month)
        .eq("operation_year", year)
        .order("started_at", { ascending: false }),

      supabaseAdmin
        .from("mk9_actual_visits")
        .select("id, store_id, visit_date, source_import_id, competence_month, competence_year, created_at, status")
        .eq("industry_id", industryId)
        .or(`and(competence_month.eq.${month},competence_year.eq.${year}),and(visit_date.gte.${startDate},visit_date.lte.${endDate})`),

      supabaseAdmin
        .from("mk9_industry_store_frequency_versions")
        .select("id, store_id, valid_from, valid_until, source_type, source_import_id, created_at, archived_at")
        .eq("industry_id", industryId)
        .or(`valid_until.is.null,and(valid_until.gte.${startDate},valid_from.lte.${endDate})`),

      supabaseAdmin
        .from("mk9_planned_routes")
        .select("id, store_id, valid_from, valid_until, source_type, created_at")
        .eq("industry_id", industryId)
        .or(`valid_until.is.null,and(valid_until.gte.${startDate},valid_from.lte.${endDate})`),

      supabaseAdmin
        .from("mk9_data_quality_issues")
        .select("id, store_id, detector_id, status, created_at, severity")
        .eq("industry_id", industryId)
        .eq("competence_month", month)
        .eq("competence_year", year),
    ]);

    const getValue = <T>(res: PromiseSettledResult<T>, defaultValue: any = []) => 
      res.status === 'fulfilled' ? (res.value as any).data || defaultValue : null;

    const imports = getValue(results[0]) || [];
    const visits = getValue(results[1]) || [];
    const frequencies = getValue(results[2]) || [];
    const routes = getValue(results[3]) || [];
    const qualityIssues = getValue(results[4]) || [];

    // 4. Montar DTO de Trace do Relatório
    const trace = {
      period: { start: startDate, end: endDate, is_custom: cfg.periodType === 'CUSTOM_CYCLE' },
      stores: report.stores.map(s => ({
        id: s.storeId,
        name: s.storeName,
        expected: s.expected,
        actual: s.actual,
        frequencyLabel: s.frequencyLabel,
        contractedSource: s.contractedSource
      })),
      totals: report.totals
    };

    return {
      trace,
      imports: imports.map((i: any) => ({ ...i, started_at: i.started_at ? new Date(i.started_at).toISOString() : null })),
      visits: visits.map((v: any) => ({ ...v, visit_date: v.visit_date ? new Date(v.visit_date).toISOString() : null })),
      frequencies: frequencies.map((f: any) => ({ ...f, valid_from: f.valid_from ? new Date(f.valid_from).toISOString() : null, valid_until: f.valid_until ? new Date(f.valid_until).toISOString() : null })),
      routes: routes.map((r: any) => ({ ...r, valid_from: r.valid_from ? new Date(r.valid_from).toISOString() : null, valid_until: r.valid_until ? new Date(r.valid_until).toISOString() : null })),
      qualityIssues: qualityIssues.map((q: any) => ({ ...q, created_at: q.created_at ? new Date(q.created_at).toISOString() : null })),
      summary: {
        totalImports: imports.length,
        totalVisits: visits.length,
        affectedStores: new Set([...visits, ...frequencies, ...routes].map((x: any) => x.store_id)).size,
        openFrequencies: frequencies.filter((f: any) => !f.valid_until && !f.archived_at).length,
        activeIssues: qualityIssues.filter((i: any) => i.status !== 'resolved').length
      }
    };
  });

export const executeGranularCleanup = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    industryId: z.string().uuid(),
    month: z.number(),
    year: z.number(),
    justification: z.string().min(10),
    selections: z.object({
      importIds: z.array(z.string().uuid()),
      visitIds: z.array(z.string().uuid()),
      frequencyIds: z.array(z.string().uuid()),
      routeIds: z.array(z.string().uuid()),
    })
  }).parse(data))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN"]);
    
    let visitsAffected = 0;
    if (data.selections.visitIds.length > 0) {
      const { count } = await supabaseAdmin
        .from("mk9_actual_visits")
        .delete({ count: 'exact' })
        .in("id", data.selections.visitIds);
      visitsAffected = count || 0;
    }

    let frequenciesAffected = 0;
    if (data.selections.frequencyIds.length > 0) {
      const { count } = await supabaseAdmin
        .from("mk9_industry_store_frequency_versions")
        .update({ archived_at: new Date().toISOString() } as any)
        .in("id", data.selections.frequencyIds);
      frequenciesAffected = count || 0;
    }

    let routesAffected = 0;
    if (data.selections.routeIds.length > 0) {
      const { count } = await supabaseAdmin
        .from("mk9_planned_routes")
        .update({ valid_until: new Date().toISOString() } as any)
        .in("id", data.selections.routeIds);
      routesAffected = count || 0;
    }

    if (data.selections.importIds.length > 0) {
      await supabaseAdmin
        .from("mk9_checklist_imports")
        .update({ 
          status: "reverted", 
          error_message: `Limpeza Granular: ${data.justification}`
        } as any)
        .in("id", data.selections.importIds);
    }

    await logAudit(ctx, "mk9.admin.cleanup.granular", "multiple", data.industryId, {
      ...data,
      results: { visitsAffected, frequenciesAffected, routesAffected }
    });

    return { success: true, visitsAffected, frequenciesAffected, routesAffected };
  });
