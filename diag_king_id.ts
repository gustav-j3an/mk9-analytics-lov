import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function diag() {
  const { data: industries } = await supabaseAdmin.from("mk9_industries").select("id, name");
  console.log("Indústrias cadastradas:", JSON.stringify(industries, null, 2));

  const { data: allImports } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("id, industry_id, operation_month, operation_year, status")
    .order("started_at", { ascending: false })
    .limit(10);
  console.log("Últimas 10 importações:", JSON.stringify(allImports, null, 2));
}

diag();
