import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function checkSchema() {
  const { data, error } = await supabaseAdmin.rpc('get_table_schema', { table_name: 'mk9_actual_visits' });
  
  if (error) {
    // If RPC doesn't exist, try a simple select from the table and look at keys
    const { data: sample } = await supabaseAdmin.from('mk9_actual_visits').select('*').limit(1);
    console.log('Sample record keys:', Object.keys(sample?.[0] || {}));
    console.log('Sample record:', sample?.[0]);
  } else {
    console.log('Schema:', data);
  }
}

checkSchema();
