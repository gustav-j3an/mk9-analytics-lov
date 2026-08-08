
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function finalInvestigation() {
  console.log("--- FINAL INVESTIGATION ---");
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const startDate = '2026-08-01';
  const endDate = '2026-08-31';

  // 1. Ver Lojas na importação b8171372-b968-4881-8200-e320bacfecc4
  const { data: stores } = await supabaseAdmin
    .from('mk9_industry_store_frequency_versions')
    .select('store_id, store_name, uf, monthly_frequency, weekly_frequency')
    .eq('import_id', 'b8171372-b968-4881-8200-e320bacfecc4');
  
  console.log("Lojas na importação b8171372:", stores?.length);
  const sumMonthly = stores?.reduce((acc, s) => acc + (Number(s.monthly_frequency) || 0), 0);
  console.log("Soma contratadas mensais na importação b8171372:", sumMonthly);

  // 2. Ver Lojas vinculadas a b8171372 mas via mk9_stores
  const { data: linkedStores } = await supabaseAdmin
    .from('mk9_industry_store_frequency_versions')
    .select('id, store:mk9_stores(id, name, uf)')
    .eq('import_id', 'b8171372-b968-4881-8200-e320bacfecc4');
  
  const mismatchUf = linkedStores?.filter(s => {
    const storeObj: any = s.store;
    // Tentar achar na lista de nomes conhecidos que o usuário mencionou
    return storeObj && ["TATICO GARAVELO", "TATICO CENTRO", "TATICO - AGUAS LINDAS"].includes(storeObj.name);
  });
  console.log("UFs das lojas TATICO no cadastro vinculadas:", mismatchUf?.map((s: any) => ({ name: s.store.name, uf: s.store.uf })));

  // 3. Ver Visitas reais com import_id nulo (manuais)
  const { count: manualCount } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('id', { count: 'exact', head: true })
    .eq('industry_id', industryId)
    .is('source_import_id', null)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate);
  
  console.log("Visitas manuais no período:", manualCount);
}

finalInvestigation().catch(console.error);
