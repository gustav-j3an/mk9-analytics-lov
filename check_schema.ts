import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function checkSchema() {
  const { data, error } = await supabaseAdmin.rpc("get_table_columns", { table_name: "mk9_checklist_imports" });
  // If rpc doesn't exist, we'll try a raw query
  if (error) {
      const { data: cols } = await supabaseAdmin.from("mk9_checklist_imports").select("*").limit(1);
      console.log("Columns in mk9_checklist_imports:", Object.keys(cols?.[0] || {}));
  } else {
      console.log("Columns:", data);
  }
}

checkSchema().catch(console.error);
