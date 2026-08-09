import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function diagnostic() {
  const cicopalId = "6e8c1ff7-a364-4fcd-ad27-0a18eaf8485d";
  const julyImportId = "0030c1d4-f6f9-43b4-842b-48afd2330f27";

  console.log("=== MK9 DEEP AUDIT: CICOPAL JULY ===");

  // 3. Inspecionar Preview
  const { data: impData } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("preview_snapshot")
    .eq("id", julyImportId)
    .single();
  
  const preview = impData?.preview_snapshot as any;
  console.log("PREVIEW JSON SUMMARY:");
  console.log("- stores:", preview?.counters?.totalStores);
  console.log("- visits:", preview?.counters?.totalMarks);

  // 4. Snapshot Real
  const { data: snapshots } = await supabaseAdmin
    .from("mk9_checklist_import_store_snapshots")
    .select("store_id, source_store_name, weekly_frequency, monthly_frequency")
    .eq("import_id", julyImportId);
  
  console.log("SNAPSHOT DATA (Rows: " + snapshots?.length + "):");
  snapshots?.forEach(s => console.log(`  Store: ${s.source_store_name} | Freq: ${s.weekly_frequency}w / ${s.monthly_frequency}m`));

  // 5 & 6. Frequências (Tabela mk9_industry_store_frequency_versions)
  const { data: freqs } = await supabaseAdmin
    .from("mk9_industry_store_frequency_versions")
    .select("*")
    .eq("industry_id", cicopalId)
    .eq("source_import_id", julyImportId);
  
  console.log("\nFREQUENCY VERSIONS (Count: " + freqs?.length + "):");
  freqs?.forEach(f => console.log(`  StoreID: ${f.store_id} | Import: ${f.source_import_id} | ValidFrom: ${f.valid_from}`));

  // 7 & 8. Actual Visits
  const { data: visits } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("id, visit_date, store_id, source_import_id")
    .eq("source_import_id", julyImportId);
  
  console.log("\nACTUAL VISITS (Count: " + (visits?.length || 0) + "):");
  if (visits && visits.length > 0) {
      console.log("  Sample Visit:", visits[0]);
  }

  // 9. Core Operacional direto
  console.log("\n--- CORE OPERACIONAL DIRECT CALL ---");
  const { loadOperationCore } = await import("./src/lib/mk9-operations/core.server");
  const core = await loadOperationCore({
      industryId: cicopalId,
      month: 7,
      year: 2026
  });

  console.log("CORE OUTPUT:");
  console.log("- Total Stores:", core.stores.length);
  console.log("- Total Realized:", core.totals.realized);
  console.log("- Total Contracted:", core.totals.contracted);
  
  // 10. Auditando Filtros do Core
  console.log("\n--- CORE FILTERS AUDIT ---");
  // O Core filtra por is_operational_current?
  // Vamos ver se o Core retorna a CICOPAL se passarmos a importId explicitamente ou se ele busca a "current".
  
  // 11. Control Mode
  const { data: ind } = await supabaseAdmin
    .from("mk9_industries")
    .select("control_mode")
    .eq("id", cicopalId)
    .single();
  console.log("CICOPAL CONTROL MODE:", ind?.control_mode);

  console.log("=== MK9 DEEP AUDIT END ===");
}

diagnostic().catch(console.error);
