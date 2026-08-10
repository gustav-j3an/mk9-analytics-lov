import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function run() {
  const { data, error } = await supabaseAdmin
    .from("mk9_stores")
    .select("*")
    .limit(1);
    
  if (error) {
    console.log("ERROR:", JSON.stringify(error, null, 2));
  } else {
    console.log("COLUMNS:", Object.keys(data[0]));
  }
}

run();
