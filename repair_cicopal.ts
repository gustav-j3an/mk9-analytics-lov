import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function repairCicopal() {
  const cicopalImportId = "0030c1d4-f6f9-43b4-842b-48afd2330f27";
  const cicopalIndustryId = "6e8c1ff7-a364-4fcd-ad27-0a18eaf8485d";

  console.log("=== REPAIRING CICOPAL JULHO 2026 ===");

  // 1. Promover a importação
  const { error: updErr } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .update({ is_operational_current: true, status: "done" })
    .eq("id", cicopalImportId);

  if (updErr) console.error("Error promoting import:", updErr);
  else console.log("Import promoted to operational current.");

  // 2. Desativar outras da mesma competência (se houver)
  await supabaseAdmin
    .from("mk9_checklist_imports")
    .update({ is_operational_current: false })
    .eq("industry_id", cicopalIndustryId)
    .eq("operation_month", 7)
    .eq("operation_year", 2026)
    .neq("id", cicopalImportId);

  console.log("Other imports for Cicopal Jul/2026 deactivated.");
  
  // 3. Verificar se as visitas estão lá (já confirmamos em global_audit, mas vamos garantir a vinculação)
  const { count } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("*", { count: 'exact', head: true })
    .eq("source_import_id", cicopalImportId);
    
  console.log(`Verified visits for CICOPAL: ${count}`);

  console.log("=== REPAIR COMPLETE ===");
}

repairCicopal().catch(console.error);
