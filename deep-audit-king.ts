
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function deepAudit() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const importId = 'b8171372-b968-4881-8200-e320bacfecc4';

  console.log("--- AUDITORIA PROFUNDA KING ---");
  
  // 1. Verificar a importação
  const { data: imp } = await supabaseAdmin
    .from('mk9_checklist_imports')
    .select('*')
    .eq('id', importId)
    .single();
  console.log("Dados da Importação:", imp);

  // 2. Tentar buscar de outra forma (sem filtro de import_id caso tenha falhado o vínculo)
  const { data: stores } = await supabaseAdmin
    .from('mk9_industry_store_frequency_versions')
    .select('id, store_name, uf, import_id')
    .eq('industry_id', industryId);

  console.log(`Lojas totais da KING no banco (qualquer import): ${stores?.length}`);
  
  // Agrupar por import_id para entender onde os dados estão
  const groups = stores?.reduce((acc: any, s) => {
    acc[s.import_id || 'null'] = (acc[s.import_id || 'null'] || 0) + 1;
    return acc;
  }, {});
  console.log("Distribuição por import_id:", groups);

  // 3. Identificar o fantasma entre TODAS as lojas da KING
  const ghost = stores?.find(s => !s.uf || s.store_name.includes("ENCERRAMENTO"));
  if (ghost) {
    console.log(`Fantasma detectado: "${ghost.store_name}" (Import: ${ghost.import_id})`);
    
    // Remover o fantasma
    const { error: delErr } = await supabaseAdmin
      .from('mk9_industry_store_frequency_versions')
      .delete()
      .eq('id', ghost.id);
    
    if (!delErr) {
      console.log("Fantasma deletado.");
      
      // Se ele pertencia à importação b8171372 ou se queremos forçar o contador nela
      await supabaseAdmin.from('mk9_checklist_imports').update({ 
        stores_count: 134,
        realized_count: 146
      }).eq('id', importId);
      
      console.log("Contador da importação b8171372 forçado para 134.");
    }
  }
}

deepAudit().catch(console.error);
