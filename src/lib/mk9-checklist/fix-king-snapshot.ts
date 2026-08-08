
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
  
  console.log(`Encontradas ${freqs.length} lojas no preview. Persistindo no snapshot via REST direto...`);
  
  const snapshotRows = freqs.map((f: any) => ({
    import_id: importId,
    industry_id: industryId,
    store_id: f.storeId,
    source_store_name: f.storeName,
    uf: f.uf,
    weekly_frequency: f.weeklyFrequency,
    monthly_frequency: f.monthlyFrequency,
  })).filter((r: any) => !!r.store_id);

  const { error } = await (supabaseAdmin.from('mk9_checklist_import_store_snapshots' as any) as any).upsert(snapshotRows);
  
  if (error) {
    console.error('Erro ao persistir snapshot:', error.message);
    return;
  }
  
  console.log('Snapshot persistido com sucesso.');
}

fix().catch(console.error);
