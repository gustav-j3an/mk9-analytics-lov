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
    const { data: imports } = await supabaseAdmin
      .from("mk9_checklist_imports")
      .select("id, filename, started_at, user_id, status, counters, batch_id, is_operational_current")
      .eq("industry_id", data.industryId)
      .eq("operation_month", data.month)
      .eq("operation_year", data.year)
      .order("started_at", { ascending: false });

    const importIds = imports?.map(i => i.id) || [];

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
      imports: imports || [],
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
    
    // Auditoria inicial
    const logId = await supabaseAdmin
      .from("mk9_checklist_cleanup_logs")
      .insert({
        industry_id: data.industryId,
        operation_month: data.month,
        operation_year: data.year,
        justification: data.justification,
        impact_summary: { 
          import_ids: data.importIds,
          options: data.options 
        },
        created_by: ctx.userId
      })
      .select("id")
      .single()
      .then(res => res.data?.id);

    // Ações transacionais simuladas (atômicas por tipo)
    let visitsRemoved = 0;
    let frequenciesArchived = 0;

    if (data.options.revertVisits) {
      const { count } = await supabaseAdmin
        .from("mk9_actual_visits")
        .delete({ count: 'exact' })
        .in("source_import_id", data.importIds);
      visitsRemoved = count || 0;
    }

    if (data.options.archiveFrequencies) {
      const { count } = await supabaseAdmin
        .from("mk9_industry_store_frequency_versions")
        .update({ 
          archived_at: new Date().toISOString(),
          // @ts-ignore
          archived_by: ctx.userId,
          // @ts-ignore
          archive_reason: `LIMPEZA_ADMIN: ${data.justification}`
        } as any)
        .in("source_import_id", data.importIds);
      frequenciesArchived = count || 0;
    }

    // Marca importações como revertidas/limpas
    await supabaseAdmin
      .from("mk9_checklist_imports")
      .update({ 
        status: "reverted", 
        is_operational_current: false,
        error_message: `Limpeza administrativa: ${data.justification}`
      } as any)
      .in("id", data.importIds);

    await logAudit(ctx, "mk9.admin.cleanup", "mk9_checklist_imports", data.industryId, {
      logId,
      ...data
    });

    return { success: true, visitsRemoved, frequenciesArchived };
  });
