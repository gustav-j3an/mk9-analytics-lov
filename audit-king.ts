
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function auditAndFix() {
  console.log("--- AUDITORIA DE INDÚSTRIAS ---");
  const { data: industries } = await supabaseAdmin.from('mk9_industries').select('id, name');
  console.log("Indústrias:", industries);

  const king = industries?.find(i => i.name.toLowerCase().includes('king'));
  if (!king) {
    console.log("KING não encontrada pelo nome.");
    return;
  }
  
  const industryId = king.id;
  console.log(`ID da KING: ${industryId}`);

  const { data: imports } = await supabaseAdmin
    .from('mk9_checklist_imports')
    .select('*')
    .eq('industry_id', industryId)
    .order('created_at', { ascending: false });

  console.log("Importações da KING:", imports?.map(i => ({
    id: i.id,
    current: i.is_operational_current,
    stores: i.stores_count,
    realized: i.realized_count,
    created: i.created_at
  })));

  const opImport = imports?.find(i => i.is_operational_current);
  if (!opImport) {
    console.log("Nenhuma importação operacional. Tentando ativar a mais recente com 135 lojas...");
    const latest = imports?.[0];
    if (latest) {
      await supabaseAdmin.from('mk9_checklist_imports').update({ is_operational_current: true }).eq('id', latest.id);
      console.log(`Ativada importação ${latest.id}`);
      return auditAndFix(); // Recarrega
    }
    return;
  }

  // Verificar lojas físicas
  const { data: stores } = await supabaseAdmin
    .from('mk9_industry_store_frequency_versions')
    .select('id, store_name, uf')
    .eq('import_id', opImport.id);

  console.log(`Lojas físicas encontradas: ${stores?.length}`);
  
  const ghost = stores?.find(s => !s.uf || s.store_name.length > 50);
  if (ghost) {
    console.log(`Removendo loja fantasma: "${ghost.store_name}"`);
    await supabaseAdmin.from('mk9_industry_store_frequency_versions').delete().eq('id', ghost.id);
    await supabaseAdmin.from('mk9_checklist_imports').update({ stores_count: opImport.stores_count - 1 }).eq('id', opImport.id);
    console.log("Removido e atualizado.");
  }
}

auditAndFix().catch(console.error);
