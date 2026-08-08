
import { supabaseAdmin } from "./integrations/supabase/client.server";
import { persistImportSnapshot } from "./lib/mk9-checklist/persistence.server";

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
  
  console.log(`Encontradas ${freqs.length} lojas no preview. Persistindo no snapshot...`);
  
  const snapshotRows = freqs.map((f: any) => ({
    storeId: f.storeId,
    storeName: f.storeName,
    uf: f.uf,
    weeklyFrequency: f.weeklyFrequency,
    monthlyFrequency: f.monthlyFrequency,
  })).filter((r: any) => !!r.storeId);
  
  await persistImportSnapshot(importId, industryId, snapshotRows);
  
  console.log('Snapshot persistido com sucesso.');
}

fix().catch(console.error);
