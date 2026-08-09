import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function globalAudit() {
  console.log("=== GLOBAL ACTUAL VISITS AUDIT ===");
  
  // As últimas 50 visitas inseridas no sistema
  const { data: visits } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("id, industry_id, store_id, scheduled_date, source_import_id, created_at, origin")
    .order("created_at", { ascending: false })
    .limit(50);
  
  console.log("Last 50 visits:");
  visits?.forEach(v => {
      console.log(`[${v.created_at}] Ind: ${v.industry_id} | Store: ${v.store_id} | Import: ${v.source_import_id} | Origin: ${v.origin}`);
  });

  // Verificando se a CICOPAL (6e8c1ff7-a364-4fcd-ad27-0a18eaf8485d) tem visitas em Julho
  const cicopalId = "6e8c1ff7-a364-4fcd-ad27-0a18eaf8485d";
  const { data: cicopalVisits } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("id, scheduled_date, source_import_id")
    .eq("industry_id", cicopalId)
    .gte("scheduled_date", "2026-07-01")
    .lte("scheduled_date", "2026-07-31");
  
  console.log("\nCICOPAL JULHO VISITS (Count: " + (cicopalVisits?.length || 0) + "):");
  const importsFound = new Set(cicopalVisits?.map(v => v.source_import_id));
  console.log("Imports referenced in visits:", Array.from(importsFound));

  console.log("=== GLOBAL AUDIT END ===");
}

globalAudit().catch(console.error);
