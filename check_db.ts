
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function checkSchema() {
  const admin = supabaseAdmin as any;
  const { data, error } = await admin.rpc('get_column_type', { 
    t_name: 'mk9_freelancer_dailies', 
    c_name: 'date' 
  });
  
  if (error) {
    // If RPC doesn't exist, try a direct query to information_schema
    const { data: info, error: infoErr } = await admin.from('information_schema.columns')
      .select('data_type')
      .eq('table_name', 'mk9_freelancer_dailies')
      .eq('column_name', 'date')
      .single();
    
    console.log("Schema info:", info || infoErr);
  } else {
    console.log("Column type:", data);
  }
}
