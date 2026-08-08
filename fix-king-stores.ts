
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function fixKingStores() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  
  console.log("Iniciando auditoria de lojas para KING...");
  
  // 1. Encontrar a importação operacional atual
  const { data: currentImport } = await supabaseAdmin
    .from('mk9_checklist_imports')
    .select('id, stores_count, realized_count')
    .eq('industry_id', industryId)
    .eq('is_operational_current', true)
    .single();
    
  if (!currentImport) {
    console.error("Nenhuma importação operacional encontrada.");
    return;
  }
  
  console.log(`Importação atual: ${currentImport.id} - Lojas: ${currentImport.stores_count}`);

  // 2. Identificar a "loja fantasma" (anotação)
  // Lojas sem UF ou com nomes muito longos que parecem frases
  const { data: stores } = await supabaseAdmin
    .from('mk9_industry_store_frequency_versions')
    .select('id, store_name, uf')
    .eq('industry_id', industryId)
    .eq('import_id', currentImport.id);
    
  if (!stores) return;
  
  const ghostStore = stores.find(s => 
    !s.uf || 
    s.store_name.includes("ENCERRAMENTO") || 
    s.store_name.length > 50
  );
  
  if (ghostStore) {
    console.log(`Identificada loja fantasma: "${ghostStore.store_name}" (ID: ${ghostStore.id})`);
    
    // 3. Remover a loja fantasma das frequências e visitas (se houver)
    // Primeiro removemos visitas associadas (embora o prompt diga que tem 0)
    await supabaseAdmin
      .from('mk9_actual_visits')
      .delete()
      .eq('industry_id', industryId)
      .eq('store_name', ghostStore.store_name);
      
    // Remove da frequência
    const { error: delErr } = await supabaseAdmin
      .from('mk9_industry_store_frequency_versions')
      .delete()
      .eq('id', ghostStore.id);
      
    if (delErr) {
      console.error("Erro ao deletar loja fantasma:", delErr);
    } else {
      console.log("Loja fantasma removida com sucesso.");
      
      // 4. Atualizar o contador da importação
      const newCount = currentImport.stores_count - 1;
      await supabaseAdmin
        .from('mk9_checklist_imports')
        .update({ stores_count: newCount })
        .eq('id', currentImport.id);
        
      console.log(`Contador de lojas atualizado para: ${newCount}`);
    }
  } else {
    console.log("Nenhuma loja fantasma óbvia encontrada.");
  }
  
  // 5. Verificação final
  const { data: finalCount } = await supabaseAdmin
    .from('mk9_industry_store_frequency_versions')
    .select('id', { count: 'exact' })
    .eq('industry_id', industryId)
    .eq('import_id', currentImport.id);
    
  console.log(`Resultado final no banco: ${finalCount?.length} lojas.`);
}

fixKingStores().catch(console.error);
