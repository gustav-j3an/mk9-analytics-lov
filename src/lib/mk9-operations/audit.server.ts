import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Motor de Auditoria Operacional (Missão 1 - KING Fix)
 * Executa um diagnóstico profundo sobre uma importação para identificar por que
 * as visitas não estão sendo contabilizadas.
 */
export async function auditChecklistImport(importId: string) {
  // 1. Dados da Importação
  const { data: imp, error: impErr } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("*, industry:mk9_industries(id, name)")
    .eq("id", importId)
    .maybeSingle();

  if (impErr || !imp) throw new Error(`Importação ${importId} não encontrada.`);

  const importData = imp as any;

  // 2. Resolver Janela Operacional Real
  const { loadPeriodConfig, resolveWindow } = await import("@/lib/mk9-reports/period.server");
  const cfg = await loadPeriodConfig(supabaseAdmin, importData.industry_id);
  const window = resolveWindow(cfg, importData.operation_year, importData.operation_month);

  // 3. Visitas Persistidas no Banco
  const { data: visits, error: vErr } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("id, scheduled_date, store_id, source_import_id")
    .eq("source_import_id", importId);

  // 4. Visitas Operacionais (Conforme novo motor)
  const { getOperationalVisits } = await import("./operational-visits.server");
  const operationalVisits = await getOperationalVisits({
    industryId: importData.industry_id,
    startDate: window.startDate,
    endDate: window.endDate,
    sourceImportId: importId,
  });

  // 5. Cruzamento de Lojas (Snapshot vs Banco)
  const preview = (importData.preview as any) || {};
  const items = (preview.items as any[]) || [];
  const storesInPreview = new Set(items.map((i) => i.storeId).filter(Boolean));
  const storesInVisits = new Set(visits?.map((v) => v.store_id).filter(Boolean));

  return {
    summary: {
      importId: importData.id,
      filename: importData.filename,
      industry: importData.industry?.name,
      competence: `${importData.operation_month}/${importData.operation_year}`,
      window: { start: window.startDate, end: window.endDate },
      status: importData.status,
      isOperationalCurrent: !!importData.is_operational_current,
      revertedAt: importData.reverted_at,
    },
    counters: {
      previewItems: items.length,
      visitsPersisted: visits?.length || 0,
      visitsOperational: operationalVisits.length,
      storesInPreview: storesInPreview.size,
      storesInVisits: storesInVisits.size,
    },
    diagnostics: {
      isCurrent: !!importData.is_operational_current,
      hasRevertedAt: !!importData.reverted_at,
      hasStatusDone: importData.status === "done",
      lostVisits: (visits?.length || 0) - operationalVisits.length,
    },
  };
}
