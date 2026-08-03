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
    console.log("[CLEANUP LOAD START]", { industryId: data.industryId, month: data.month, year: data.year });
    await requireMk9Role(["ADMIN"]);
    console.log("[CLEANUP SCOPE OK]");

    const { industryId, month, year } = data;
    const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
    console.log("[CLEANUP PERIOD RESOLVED]", { startDate, endDate });

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
        .from("mk9_visit_reconciliations")
        .select("id, actual_visit_id, planned_visit_id, created_at")
        .eq("industry_id", industryId),

      supabaseAdmin
        .from("mk9_data_quality_issues")
        .select("id, store_id, detector_id, status, created_at, severity")
        .eq("industry_id", industryId)
        .eq("competence_month", month)
        .eq("competence_year", year),
      
      supabaseAdmin
        .from("mk9_industry_period_config")
        .select("*")
        .eq("industry_id", industryId)
        .maybeSingle(),

      supabaseAdmin
        .from("mk9_industry_contract_totals")
        .select("*")
        .eq("industry_id", industryId)
        .eq("competence_month", month)
        .eq("competence_year", year)
        .maybeSingle(),
    ]);

    const getValue = <T>(res: PromiseSettledResult<T>, defaultValue: any = []) => 
      res.status === 'fulfilled' ? (res.value as any).data || defaultValue : null;

    const imports = getValue(results[0]) || [];
    const visits = getValue(results[1]) || [];
    const frequencies = getValue(results[2]) || [];
    const routes = getValue(results[3]) || [];
    const reconciliations = getValue(results[4]) || [];
    const qualityIssues = getValue(results[5]) || [];
    const periodConfig = getValue(results[6], null);
    const contractTotal = getValue(results[7], null);

    return {
      period: {
        start: periodConfig?.start_date || startDate,
        end: periodConfig?.end_date || endDate,
        is_custom: !!periodConfig
      },
      imports,
      visits,
      frequencies,
      routes,
      reconciliations,
      qualityIssues,
      contract: contractTotal,
      summary: {
        totalImports: imports.length,
        totalVisits: visits.length,
        visitsWithoutOrigin: visits.filter((v: any) => !v.source_import_id).length,
        affectedStores: new Set([...visits, ...frequencies, ...routes].map((x: any) => x.store_id)).size,
        openFrequencies: frequencies.filter((f: any) => !f.valid_until && !f.archived_at).length,
        openRoutes: routes.filter((r: any) => !r.valid_until).length,
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
