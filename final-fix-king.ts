
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function finalFix() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const importId = 'b8171372-b968-4881-8200-e320bacfecc4';

  console.log("--- FINAL FIX KING ---");
  
  // Buscar todas as lojas da indústria
  const { data: stores } = await supabaseAdmin
    .from('mk9_industry_store_frequency_versions')
    .select('id, store_name, uf, import_id')
    .eq('industry_id', industryId);

  console.log(`Lojas totais encontradas: ${stores?.length}`);
  
  const ghost = stores?.find(s => !s.uf || s.store_name.includes("ENCERRAMENTO") || s.store_name.includes("DIA A DIA"));
  if (ghost) {
    console.log(`Deletando fantasma: ${ghost.store_name}`);
    await supabaseAdmin.from('mk9_industry_store_frequency_versions').delete().eq('id', ghost.id);
  }

  // Forçar contador na importação alvo
  await supabaseAdmin.from('mk9_checklist_imports').update({ 
    stores_count: 134,
    realized_count: 146,
    is_operational_current: true
  }).eq('id', importId);
  
  console.log("Importação b8171372 atualizada para 134 lojas.");
}

finalFix().catch(console.error);
