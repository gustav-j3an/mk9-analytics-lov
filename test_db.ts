import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function run() {
  const { data, error } = await supabaseAdmin
    .from("mk9_planned_routes")
    .select(`
      id, 
      weekday, 
      store:mk9_stores(id, name, chain, uf)
    `)
    .limit(1);
    
  if (error) {
    console.log("ERROR:", JSON.stringify(error, null, 2));
  } else {
    console.log("SUCCESS:", JSON.stringify(data, null, 2));
  }
}

run();
