import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/lib/mk9-auth/require-role.server";

export async function executeGranularCleanup(params: {
  industryId: string;
  month: number;
  year: number;
  selectedSources: {
    visitIds: string[];
    frequencyIds: string[];
    importIds: string[];
    projectionIds: string[];
    routeIds: string[];
  };
  reason: string;
  actorId: string;
}) {
  const { industryId, month, year, selectedSources, reason, actorId } = params;

  console.log(`[CLEANUP] Executando limpeza granular para: ${industryId} (${month}/${year})`);

  // 1. Snapshot ANTES
  const { loadPeriodConfig, resolveWindow } = await import("@/lib/mk9-reports/period.server");
  const { buildIndustryReport } = await import("@/lib/mk9-reports/industry-report.server");
  
  const cfg = await loadPeriodConfig(supabaseAdmin, industryId);
  const window = resolveWindow(cfg, year, month);
  const beforeReport = await buildIndustryReport(supabaseAdmin, { industryId, year, month }, window);

  // 2. Execução Transacional (Deleção de Visitas)
  let visitsRemoved = 0;
  if (selectedSources.visitIds.length > 0) {
    const { count } = await supabaseAdmin
      .from("mk9_actual_visits")
      .delete({ count: 'exact' })
      .in("id", selectedSources.visitIds);
    visitsRemoved = count || 0;
  }

  // 3. Arquivamento de Frequências
  let freqsArchived = 0;
  if (selectedSources.frequencyIds.length > 0) {
    const { count } = await supabaseAdmin
      .from("mk9_industry_store_frequency_versions")
      .update({ archived_at: new Date().toISOString() } as any)
      .in("id", selectedSources.frequencyIds);
    freqsArchived = count || 0;
  }

  // 4. Invalidação de Importações
  if (selectedSources.importIds.length > 0) {
    await supabaseAdmin
      .from("mk9_checklist_imports")
      .update({ 
        status: "reverted", 
        revert_reason: `Limpeza Administrativa: ${reason}`,
        reverted_at: new Date().toISOString(),
        reverted_by: actorId
      } as any)
      .in("id", selectedSources.importIds);
  }

  // 5. Limpeza de Projeções (invalidando para recálculo)
  if (selectedSources.projectionIds.length > 0) {
    await supabaseAdmin
      .from("mk9_industry_store_frequency")
      .delete()
      .in("id", selectedSources.projectionIds);
  }

  // 6. Snapshot DEPOIS
  const afterReport = await buildIndustryReport(supabaseAdmin, { industryId, year, month }, window);

  // 7. Auditoria
  await logAudit({ userId: actorId, roles: ["ADMIN"], email: null, devBypass: false }, "mk9.admin.cleanup.granular", "multiple", industryId, {
    industryId,
    month,
    year,
    reason,
    removed: {
      visits: visitsRemoved,
      frequencies: freqsArchived,
      imports: selectedSources.importIds.length,
      projections: selectedSources.projectionIds.length
    },
    report: {
      before: beforeReport.totals,
      after: afterReport.totals
    }
  });

  return {
    success: true,
    before: beforeReport.totals,
    after: afterReport.totals,
    removed: {
      visits: visitsRemoved,
      frequencies: freqsArchived
    }
  };
}
