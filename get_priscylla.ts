import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function run() {
  const { data, error } = await supabaseAdmin
    .from('mk9_promoters')
    .select('id, name')
    .ilike('name', '%PRISCYLLA%')
    .maybeSingle();
    
  if (error) {
    console.log(JSON.stringify({ type: 'DB_ERROR', error }));
  } else if (!data) {
    console.log(JSON.stringify({ type: 'NOT_FOUND', message: 'Priscylla não encontrada' }));
  } else {
    console.log(JSON.stringify(data));
  }
}

run();
