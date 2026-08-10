import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function run() {
  const { data, error } = await supabaseAdmin.rpc('get_table_cols', { table_name: 'mk9_stores' });
  
  if (error) {
    // Se a RPC não existir, tentar via query normal no information_schema (provavelmente bloqueado)
    console.log("RPC failed, trying raw select on store...");
    const { data: d2, error: e2 } = await supabaseAdmin.from('mk9_stores').select('*').limit(1);
    if (e2) console.log("Select * failed:", e2);
    else console.log("Cols:", Object.keys(d2[0]));
  } else {
    console.log("Cols via RPC:", data);
  }
}
run();
