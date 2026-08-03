import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPeriodConfig, resolveWindow } from "@/lib/mk9-reports/period.server";
import { buildIndustryReport } from "@/lib/mk9-reports/industry-report.server";

export async function runBananaHotfix() {
  const month = 7;
  const year = 2026;
  const name = "BANANA CORRENTE";

  console.log(`\n[HOTFIX] Iniciando busca por: ${name} (${month}/${year})`);

  // 1. Encontrar Indústria
  const { data: industries, error: e1 } = await supabaseAdmin
    .from("mk9_industries")
    .select("id, name, requires_checklist")
    .ilike("name", `%${name}%`);

  if (e1) throw e1;
  if (!industries || industries.length === 0) {
    return { error: "Nenhuma indústria encontrada com esse nome." };
  }

  const ind = industries[0];
  
  // 2. Executar Motor do Relatório (Trace)
  const cfg = await loadPeriodConfig(supabaseAdmin, ind.id);
  const window = resolveWindow(cfg, year, month);
  const report = await buildIndustryReport(supabaseAdmin, { industryId: ind.id, year, month }, window);

  // 3. Investigar Fontes
  const { data: visits } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("id, store_id, scheduled_date, source_import_id")
    .eq("industry_id", ind.id)
    .gte("scheduled_date", window.startDate)
    .lte("scheduled_date", window.endDate);

  const { data: freqs } = await supabaseAdmin
    .from("mk9_industry_store_frequency_versions")
    .select("id, store_id, valid_from, valid_until, archived_at, source_import_id")
    .eq("industry_id", ind.id)
    .or(`valid_until.is.null,and(valid_until.gte.${window.startDate},valid_from.lte.${window.endDate})`);

  const { data: routes } = await supabaseAdmin
    .from("mk9_planned_routes")
    .select("id, store_id, valid_from, valid_until")
    .eq("industry_id", ind.id)
    .or(`valid_until.is.null,and(valid_until.gte.${window.startDate},valid_from.lte.${window.endDate})`);

  const activeFreqs = (freqs || []).filter(f => !f.archived_at);
  const importIds = [...new Set([
    ...(visits || []).map(v => v.source_import_id),
    ...(freqs || []).map(f => f.source_import_id)
  ].filter(Boolean))];

  return {
    industry: ind,
    window,
    reportBefore: {
      stores: report.totals.totalStores,
      contracted: report.totals.contracted,
      actual: report.totals.actual
    },
    counts: {
      visits: visits?.length || 0,
      frequencies: freqs?.length || 0,
      activeFrequencies: activeFreqs.length,
      routes: routes?.length || 0
    },
    importIds,
    activeFreqs: activeFreqs.map(f => ({
      id: f.id,
      store: f.store_id,
      from: f.valid_from,
      until: f.valid_until
    }))
  };
}
