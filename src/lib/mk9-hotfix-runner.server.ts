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
    console.log("[HOTFIX] ERRO: Nenhuma indústria encontrada.");
    return { error: "Nenhuma indústria encontrada com esse nome." };
  }

  const ind = industries[0];
  console.log(`[HOTFIX] Indústria: ${ind.name} (${ind.id})`);

  // 2. Executar Motor do Relatório (Trace)
  const cfg = await loadPeriodConfig(supabaseAdmin, ind.id);
  const window = resolveWindow(cfg, year, month);
  const report = await buildIndustryReport(
    supabaseAdmin,
    { industryId: ind.id, year, month },
    window,
  );

  console.log(
    `[HOTFIX] Relatório ANTES: ${report.totals.totalStores} lojas, ${report.totals.contracted}c, ${report.totals.actual}r`,
  );

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
    .or(
      `valid_until.is.null,and(valid_until.gte.${window.startDate},valid_from.lte.${window.endDate})`,
    );

  const activeFreqs = (freqs || []).filter((f) => !f.archived_at);

  console.log(
    `[HOTFIX] Registros: ${visits?.length || 0} visitas, ${activeFreqs.length} frequências ativas.`,
  );

  // --- EXECUÇÃO DO HOTFIX ---
  console.log("[HOTFIX] INICIANDO REMOÇÃO...");

  let visitsRemoved = 0;
  if (visits && visits.length > 0) {
    const { count } = await supabaseAdmin
      .from("mk9_actual_visits")
      .delete({ count: "exact" })
      .in(
        "id",
        visits.map((v) => v.id),
      );
    visitsRemoved = count || 0;
  }

  let freqsArchived = 0;
  if (activeFreqs.length > 0) {
    const { count } = await supabaseAdmin
      .from("mk9_industry_store_frequency_versions")
      .update({ archived_at: new Date().toISOString() } as any)
      .in(
        "id",
        activeFreqs.map((f) => f.id),
      );
    freqsArchived = count || 0;
  }

  // 4. Snapshot DEPOIS
  const afterReport = await buildIndustryReport(
    supabaseAdmin,
    { industryId: ind.id, year, month },
    window,
  );
  console.log(
    `[HOTFIX] Relatório DEPOIS: ${afterReport.totals.totalStores} lojas, ${afterReport.totals.contracted}c, ${afterReport.totals.actual}r`,
  );

  return {
    success: true,
    industry: ind.name,
    before: {
      contracted: report.totals.contracted,
      actual: report.totals.actual,
      stores: report.totals.totalStores,
    },
    after: {
      contracted: afterReport.totals.contracted,
      actual: afterReport.totals.actual,
      stores: afterReport.totals.totalStores,
    },
    removed: {
      visits: visitsRemoved,
      frequencies: freqsArchived,
    },
  };
}
