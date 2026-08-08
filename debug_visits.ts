import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function debug() {
  const importId = '9e868554-a9f3-4a25-acc2-51e673648512';

  const { data, error } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('id, visit_date, industry_id, store_id, source_import_id')
    .eq('source_import_id', importId)
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Sample visits for import:', JSON.stringify(data, null, 2));

  const { count } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('*', { count: 'exact', head: true })
    .eq('source_import_id', importId);
  
  console.log('Total count for import:', count);
}

debug();
