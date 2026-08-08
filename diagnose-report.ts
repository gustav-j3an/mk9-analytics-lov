
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function diagnoseReportMismatch() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const startDate = '2026-08-01';
  const endDate = '2026-08-31';

  console.log("--- DIAGNÓSTICO DE DIVERGÊNCIA PDF/RELATÓRIO ---");

  // 1. Verificar Importação Operacional
  const { data: activeImports } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("id, is_operational_current, stores_count, realized_count")
    .eq("industry_id", industryId)
    .eq("is_operational_current", true);
  
  console.log("Importações Operacionais (Vigentes):", activeImports);
  const activeIds = activeImports?.map(i => i.id) || [];

  // 2. Simular getOperationalVisits (Realizadas)
  const { count: actualCount } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("id", { count: 'exact', head: true })
    .eq("industry_id", industryId)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate)
    .or(`source_import_id.is.null,source_import_id.in.(${activeIds.map(id => `"${id}"`).join(",")})`);
  
  console.log(`Visitas Realizadas (via query operacional): ${actualCount}`);

  // 3. Simular loadFrequencyVersionsForPeriod (Contratadas)
  const { data: freqs } = await supabaseAdmin
    .from("mk9_industry_store_frequency_versions")
    .select("id, store_id, weekly_frequency, monthly_frequency, valid_from, valid_until, import_id")
    .eq("industry_id", industryId)
    .or(`valid_until.is.null,valid_until.gte.${startDate}`)
    .lte("valid_from", endDate);

  console.log(`Versões de Frequência encontradas: ${freqs?.length}`);
  
  // O PDF filtra por import_id? 
  // mk9-reports/industry-report.server.ts:197 usa loadFrequencyVersionsForPeriod
  // que por sua vez (em src/lib/mk9-frequency/versions.server.ts) 
  // verifica se as vigências batem com a janela.

  // 4. Investigar divergência de UF e Lojas
  const { data: stores } = await supabaseAdmin
    .from("mk9_stores")
    .select("id, name, uf")
    .in("name", ["DIA A DIA - FORMOSA", "TATICO - AGUAS LINDAS", "TATICO CENTRO", "TATICO GARAVELO"]);
  
  console.log("Lojas no cadastro (mk9_stores):", stores);

  const { data: importFreqs } = await supabaseAdmin
    .from("mk9_industry_store_frequency_versions")
    .select("store_name, uf, import_id")
    .eq("industry_id", industryId)
    .in("store_name", ["DIA A DIA - FORMOSA", "TATICO - AGUAS LINDAS", "TATICO CENTRO", "TATICO GARAVELO"]);
  
  console.log("Lojas na Frequência (Importação):", importFreqs);
}

diagnoseReportMismatch().catch(console.error);
