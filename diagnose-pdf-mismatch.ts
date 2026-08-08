
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function diagnoseMismatch() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const importId = 'b8171372-b968-4881-8200-e320bacfecc4';
  const startDate = '2026-08-01';
  const endDate = '2026-08-31';

  console.log("--- DIAGNÓSTICO DE DIVERGÊNCIA PDF/AUDITORIA ---");

  // 1. Verificar visitas físicas (Actual Visits)
  const { data: visits } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('id, source_import_id, store_id')
    .eq('industry_id', industryId)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate);

  console.log(`\n1. Visitas físicas (mk9_actual_visits): ${visits?.length}`);
  const importStats = visits?.reduce((acc: any, v: any) => {
    acc[v.source_import_id || 'manual'] = (acc[v.source_import_id || 'manual'] || 0) + 1;
    return acc;
  }, {});
  console.log("Distribuição por source_import_id:", importStats);

  // 2. Verificar o que o PDF (buildIndustryReport) enxerga
  const { data: activeImports } = await supabaseAdmin
    .from('mk9_checklist_imports')
    .select('id, stores_count, realized_count, is_operational_current')
    .eq('industry_id', industryId)
    .eq('is_operational_current', true);
  
  console.log("\n2. Importações operacionais (is_operational_current=true):", activeImports);

  // 3. Investigar UFs das lojas "TATICO" e "DIA A DIA"
  const { data: stores } = await supabaseAdmin
    .from('mk9_stores')
    .select('id, name, uf')
    .or('name.ilike.%TATICO%,name.ilike.%DIA A DIA%');
  
  console.log("\n3. Cadastro de Lojas (mk9_stores):");
  stores?.forEach(s => console.log(`- ${s.name}: ${s.uf} (ID: ${s.id})`));

  const { data: freqVersions } = await supabaseAdmin
    .from('mk9_industry_store_frequency_versions')
    .select('store_id, store_name, uf, import_id, monthly_frequency')
    .eq('industry_id', industryId)
    .eq('import_id', importId);

  console.log(`\n4. Frequências na importação auditada (${importId}): ${freqVersions?.length}`);
  const sumMonthly = freqVersions?.reduce((acc, f) => acc + (Number(f.monthly_frequency) || 0), 0);
  console.log(`Soma contratadas mensais (b8171372): ${sumMonthly}`);
}

diagnoseMismatch().catch(console.error);
