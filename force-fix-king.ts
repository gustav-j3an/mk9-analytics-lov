
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function forceFix() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const importId = 'b8171372-b968-4881-8200-e320bacfecc4';

  console.log(`Forçando correção na importação: ${importId}`);

  // 1. Garantir que é a operacional
  await supabaseAdmin.from('mk9_checklist_imports').update({ is_operational_current: true }).eq('id', importId);

  // 2. Listar lojas
  const { data: stores } = await supabaseAdmin
    .from('mk9_industry_store_frequency_versions')
    .select('*')
    .eq('import_id', importId);

  console.log(`Lojas totais: ${stores?.length}`);

  // 3. Identificar o fantasma
  const ghost = stores?.find(s => !s.uf || s.store_name.includes("ENCERRAMENTO"));
  if (ghost) {
    console.log(`Removendo loja fantasma: "${ghost.store_name}"`);
    await supabaseAdmin.from('mk9_industry_store_frequency_versions').delete().eq('id', ghost.id);
    await supabaseAdmin.from('mk9_checklist_imports').update({ 
      stores_count: 134,
      realized_count: 146
    }).eq('id', importId);
    console.log("Correção aplicada com sucesso.");
  } else {
    console.log("Loja fantasma não encontrada na lista.");
  }
}

forceFix().catch(console.error);
