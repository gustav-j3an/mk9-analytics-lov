import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPeriodConfig, resolveWindow } from "@/lib/mk9-reports/period.server";
import { buildIndustryReport } from "@/lib/mk9-reports/industry-report.server";

/**
 * Executa o mesmo motor do PDF para rastrear todas as fontes que compõem os números da indústria.
 */
export async function traceIndustryReportSources(params: {
  industryId: string;
  month: number;
  year: number;
}) {
  const { industryId, month, year } = params;

  console.log(`[TRACE] Iniciando trace para: ${industryId} (${month}/${year})`);

  // 1. Resolver janela exata e motor do PDF
  const cfg = await loadPeriodConfig(supabaseAdmin, industryId);
  const window = resolveWindow(cfg, year, month);
  const report = await buildIndustryReport(supabaseAdmin, { industryId, year, month }, window);

  // 2. Investigar Visitas Reais (mesma lógica do or() no motor do PDF)
  const { data: visits } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("id, store_id, scheduled_date, source_import_id, competence_month, competence_year")
    .eq("industry_id", industryId)
    .or(`and(competence_month.eq.${month},competence_year.eq.${year}),and(scheduled_date.gte.${window.startDate},scheduled_date.lte.${window.endDate})`);

  // 3. Investigar Frequências Versionadas
  const { data: frequencies } = await supabaseAdmin
    .from("mk9_industry_store_frequency_versions")
    .select("id, store_id, valid_from, valid_until, archived_at, source_import_id, source_type")
    .eq("industry_id", industryId)
    .or(`valid_until.is.null,and(valid_until.gte.${window.startDate},valid_from.lte.${window.endDate})`);

  // 4. Investigar Roteiros Planejados
  const { data: routes } = await supabaseAdmin
    .from("mk9_planned_visits")
    .select("id, store_id, scheduled_date, source_import_id, status")
    .eq("industry_id", industryId)
    .gte("scheduled_date", window.startDate)
    .lte("scheduled_date", window.endDate)
    .is("archived_at", null);

  // 5. Identificar Importações Únicas das Fontes
  const importIds = new Set<string>();
  visits?.forEach(v => v.source_import_id && importIds.add(v.source_import_id));
  frequencies?.forEach(f => f.source_import_id && importIds.add(f.source_import_id));
  routes?.forEach(r => r.source_import_id && importIds.add(r.source_import_id));

  const { data: imports } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("id, filename, started_at, status, operation_month, operation_year")
    .in("id", Array.from(importIds));

  // 6. Projeções (mk9_industry_store_frequency) - o motor do PDF não usa isso, mas a limpeza deve invalidar
  const { data: projections } = await supabaseAdmin
    .from("mk9_industry_store_frequency")
    .select("id, store_id, competence_month, competence_year")
    .eq("industry_id", industryId)
    .eq("competence_month", month)
    .eq("competence_year", year);

  return {
    industryId,
    period: window,
    report: {
      totals: report.totals,
      storesCount: report.stores.length,
      stores: report.stores.map(s => ({
        id: s.storeId,
        name: s.storeName,
        contracted: s.expected,
        actual: s.actual,
        source: s.contractedSource
      }))
    },
    sources: {
      visits: visits || [],
      frequencies: frequencies || [],
      routes: routes || [],
      imports: imports || [],
      projections: projections || []
    }
  };
}
