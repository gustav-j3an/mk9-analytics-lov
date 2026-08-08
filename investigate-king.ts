
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function investigate() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  
  console.log("--- INVESTIGAÇÃO PROFUNDA KING ---");

  // 1. Verificar a indústria
  const { data: ind } = await supabaseAdmin.from('mk9_industries').select('*').eq('id', industryId).single();
  console.log("Indústria:", ind);

  // 2. Verificar TODAS as importações dessa indústria
  const { data: imps } = await supabaseAdmin.from('mk9_checklist_imports').select('*').eq('industry_id', industryId);
  console.log("Importações Totais:", imps?.map(i => ({ id: i.id, current: i.is_operational_current, stores: i.stores_count, realized: i.realized_count, competence: i.operation_year + '-' + i.operation_month })));

  // 3. Verificar o que existe na tabela de versões de frequência para esta indústria em Ago/2026
  const startDate = '2026-08-01';
  const endDate = '2026-08-31';
  const { data: freqs } = await supabaseAdmin
    .from('mk9_industry_store_frequency_versions')
    .select('id, store_id, weekly_frequency, monthly_frequency, valid_from, valid_until, import_id')
    .eq('industry_id', industryId)
    .lte('valid_from', endDate)
    .or(`valid_until.is.null,valid_until.gte.${startDate}`);

  console.log(`Contagem de versões de frequência na janela: ${freqs?.length}`);
  
  // 4. Verificar visitas reais físicas
  const { data: visits } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('id, source_import_id, scheduled_date')
    .eq('industry_id', industryId)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate);
  
  console.log(`Visitas reais físicas encontradas: ${visits?.length}`);
  if (visits && visits.length > 0) {
    const importIds = [...new Set(visits.map(v => v.source_import_id))];
    console.log("Import IDs encontrados nas visitas:", importIds);
  }

  // 5. Verificar duplicidade de lojas críticas
  const { data: duplicates } = await supabaseAdmin
    .from('mk9_stores')
    .select('id, name, uf')
    .ilike('name', '%TATICO%');
  console.log("Lojas TATICO no cadastro:", duplicates);
}

investigate().catch(console.error);
