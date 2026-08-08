
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
  
  console.log(`Encontradas ${freqs.length} lojas no preview. Persistindo via REST nativo...`);
  
  const snapshotRows = freqs.map((f: any) => ({
    import_id: importId,
    industry_id: industryId,
    store_id: f.storeId,
    source_store_name: f.storeName,
    uf: f.uf,
    weekly_frequency: f.weeklyFrequency,
    monthly_frequency: f.monthlyFrequency,
  })).filter((r: any) => !!r.store_id);

  // Usando fetch direto para contornar o schema cache do PostgREST
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    // Se não tiver service role, usamos o client mas forçamos o path
    console.log("Service role não disponível, tentando via client as any...");
    const { error } = await (supabaseAdmin.from('mk9_checklist_import_store_snapshots' as any) as any).upsert(snapshotRows);
    if (error) console.error("Erro final:", error.message);
    else console.log("Sucesso via as any");
    return;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/mk9_checklist_import_store_snapshots`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(snapshotRows)
  });

  if (response.ok) {
    console.log('Snapshot persistido com sucesso via REST.');
  } else {
    const err = await response.text();
    console.error('Erro REST:', response.status, err);
  }
}

fix().catch(console.error);
