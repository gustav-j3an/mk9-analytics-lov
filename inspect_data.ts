import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function diagnostic() {
  console.log("=== MK9 DATA INSPECTION START ===");

  // 1. Listar as últimas 20 importações independente de filtros
  const { data: allImports } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("id, industry_id, operation_month, operation_year, status, is_operational_current, filename, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  console.log("LAST 20 IMPORTS:");
  allImports?.forEach(imp => {
      console.log(`[${imp.created_at}] ID: ${imp.id} | ${imp.operation_month}/${imp.operation_year} | Status: ${imp.status} | Current: ${imp.is_operational_current} | File: ${imp.filename}`);
  });

  // 2. Tentar encontrar a CICOPAL novamente por ID (agora que sabemos que é 6e8c1ff7-a364-4fcd-ad27-0a18eaf8485d)
  const cicopalId = "6e8c1ff7-a364-4fcd-ad27-0a18eaf8485d";
  const { data: cicopalImports } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("*")
    .eq("industry_id", cicopalId)
    .order("created_at", { ascending: false });

  console.log("\nALL CICOPAL IMPORTS (Count: " + (cicopalImports?.length || 0) + "):");
  cicopalImports?.forEach(imp => {
      console.log(`ID: ${imp.id} | ${imp.operation_month}/${imp.operation_year} | Status: ${imp.status} | Current: ${imp.is_operational_current} | Created: ${imp.created_at}`);
  });

  // 3. Verificar o Snapshot se houver alguma importação de Julho
  const julyImport = cicopalImports?.find(imp => imp.operation_month === 7 && imp.operation_year === 2026);
  if (julyImport) {
      console.log("\nINSPECTING SNAPSHOT FOR CICOPAL JULY:", julyImport.id);
      const { data: sn } = await supabaseAdmin
        .from("mk9_checklist_import_store_snapshots")
        .select("count", { count: 'exact' })
        .eq("import_id", julyImport.id);
      console.log("Snapshot Count:", sn);
  }

  console.log("=== MK9 DATA INSPECTION END ===");
}

diagnostic().catch(console.error);
