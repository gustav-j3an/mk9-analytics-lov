import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function diagnostic() {
  console.log("=== MK9 FORENSIC AUDIT START ===");

  // 1. Encontrar IDs das indústrias
  const { data: industries } = await supabaseAdmin
    .from("mk9_industries")
    .select("id, name, control_mode")
    .or("name.ilike.*CICOPAL*,name.ilike.*KING*");

  console.log("Industries found:", industries);

  const cicopal = industries?.find(i => i.name.toUpperCase().includes("CICOPAL"));
  const king = industries?.find(i => i.name.toUpperCase().includes("KING"));

  if (!cicopal) {
    console.error("CICOPAL not found");
    return;
  }

  // 2. Localizar Importações CICOPAL Julho/2026
  console.log("\n--- 1. LOCALIZAR IMPORTAÇÕES CICOPAL JULHO ---");
  const { data: imports } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("id, industry_id, operation_month, operation_year, status, is_operational_current, created_at, superseded_at, reverted_at")
    .eq("industry_id", cicopal.id)
    .eq("operation_month", 7)
    .eq("operation_year", 2026)
    .order("created_at", { ascending: false });

  console.log("CICOPAL Imports (Julho/2026):", imports);

  if (!imports || imports.length === 0) {
    console.error("No imports found for CICOPAL Julho/2026");
  } else {
    const currentImport = imports.find(i => i.is_operational_current);
    console.log("CURRENT IMPORT ID:", currentImport?.id || "NONE");
    
    if (currentImport) {
        // 3. Inspecionar Snapshot Real
        console.log("\n--- 4. INSPECIONAR SNAPSHOT REAL ---");
        const { data: snapshots } = await supabaseAdmin
            .from("mk9_checklist_import_store_snapshots")
            .select("*")
            .eq("import_id", currentImport.id);
        
        console.log("Snapshot Stores count:", snapshots?.length || 0);
        if (snapshots && snapshots.length > 0) {
            console.log("Snapshot Sample (first 2):", snapshots.slice(0, 2));
        }

        // 4. Inspecionar Frequências
        console.log("\n--- 5. INSPECIONAR FREQUÊNCIAS ---");
        // Tentando localizar a tabela de frequências mencionada na memória
        const { data: freqs } = await supabaseAdmin
            .from("mk9_industry_store_frequency_versions")
            .select("*")
            .eq("industry_id", cicopal.id)
            .eq("source_import_id", currentImport.id);
        
        console.log("Frequency rows (by source_import_id):", freqs?.length || 0);

        // 5. Inspecionar Actual Visits
        console.log("\n--- 7. INSPECIONAR ACTUAL VISITS ---");
        const { data: visits } = await supabaseAdmin
            .from("mk9_actual_visits")
            .select("visit_date, store_id, source_import_id, industry_id")
            .eq("source_import_id", currentImport.id);
        
        console.log("Actual Visits count:", visits?.length || 0);
        if (visits && visits.length > 0) {
            console.log("Visits Sample (first 2):", visits.slice(0, 2));
        }
    }
  }

  // 6. Testar o Core diretamente
  console.log("\n--- 9. EXECUTAR O CORE DIRETAMENTE ---");
  try {
    const { loadOperationCore } = await import("./src/lib/mk9-operations/core.server");
    const coreResult = await loadOperationCore({
        industryId: cicopal.id,
        month: 7,
        year: 2026
    });
    console.log("CORE RESULT Summary:", {
        stores: coreResult.stores.length,
        contracted: coreResult.totals.contracted,
        realized: coreResult.totals.realized,
        coverage: coreResult.totals.coverage
    });
  } catch (err) {
    console.error("Error running loadOperationCore:", err);
  }

  console.log("=== MK9 FORENSIC AUDIT END ===");
}

diagnostic().catch(console.error);
