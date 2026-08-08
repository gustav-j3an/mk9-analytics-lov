import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function verify() {
  const { data, error } = await supabaseAdmin
    .from('mk9_checklist_imports')
    .select('id, filename, is_operational_current')
    .eq('id', '9e868554-a9f3-4a25-acc2-51e673648512')
    .single();
  
  if (error) {
    console.error('Column still missing or record not found:', error.message);
  } else {
    console.log('Record after migration:', JSON.stringify(data, null, 2));
  }
}
verify();
