import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function check() {
  const { data, error } = await supabaseAdmin
    .from('mk9_checklist_imports')
    .select('id, is_operational_current')
    .limit(1);
  
  if (error) {
    console.error('Error with is_operational_current:', error.message);
  } else {
    console.log('Column is_operational_current exists and returned:', data);
  }
}

check();
