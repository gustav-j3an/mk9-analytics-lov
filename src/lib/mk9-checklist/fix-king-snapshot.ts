
import { supabaseAdmin } from "../../integrations/supabase/client.server";

async function fix() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const importId = '9e868554-a9f3-4a25-acc2-51e673648512';
  
  console.log(`Recuperando snapshot da importação ${importId}...`);
  
  const { data: importRow } = await supabaseAdmin
    .from('mk9_checklist_imports')
    .select('preview')
    .eq('id', importId)
    .single();
    
  if (!importRow?.preview) {
    console.error('Preview não encontrado para esta importação.');
    return;
  }
  
  const preview = importRow.preview as any;
  const freqs = preview.storeFrequencies || [];
  
  console.log(`Encontradas ${freqs.length} lojas no preview. Atualizando counters e preview snapshot...`);

  // Se não podemos criar a tabela física agora por cache, garantimos que os dados
  // estão no JSON de preview para que o motor possa ler de lá como fallback.
  const snapshotData = freqs.map((f: any) => ({
    storeId: f.storeId,
    storeName: f.storeName,
    uf: f.uf,
    weeklyFrequency: f.weeklyFrequency,
    monthlyFrequency: f.monthlyFrequency,
  })).filter((r: any) => !!r.storeId);

  const { error } = await supabaseAdmin
    .from('mk9_checklist_imports')
    .update({ 
        preview: { ...preview, snapshotStores: snapshotData } as any,
        is_operational_current: true 
    })
    .eq('id', importId);

  if (error) {
    console.error('Erro ao atualizar importação:', error.message);
  } else {
    console.log('JSON de importação atualizado com sucesso (snapshot embutido).');
  }
}

fix().catch(console.error);
