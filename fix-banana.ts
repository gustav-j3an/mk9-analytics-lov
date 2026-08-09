import { supabaseAdmin } from "./integrations/supabase/client.server";
import { promoteChecklistImportToOperational } from "./lib/mk9-checklist/promotion.server";

async function fix() {
  const BANANA_JULY_IMPORT_ID = "691c3ba6-3eb7-423a-aa81-3bbdbe2b770c";
  const BANANA_INDUSTRY_ID = "3bd4093f-4e47-4b26-b029-38c63c945051";

  console.log("Starting structural fix for BANANA CORRENTE July/2026...");

  // 1. Force the correct import to be current
  const { error: updateError } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .update({ is_operational_current: true } as any)
    .eq("id", BANANA_JULY_IMPORT_ID);

  if (updateError) {
    console.error("Error updating import:", updateError);
    return;
  }
  console.log("Import marked as current.");

  // 2. Link the orphan frequency versions
  const { error: freqError } = await supabaseAdmin
    .from("mk9_industry_store_frequency_versions")
    .update({ source_import_id: BANANA_JULY_IMPORT_ID } as any)
    .eq("industry_id", BANANA_INDUSTRY_ID)
    .eq("valid_from", "2026-07-01")
    .is("source_import_id", null);

  if (freqError) {
    console.error("Error linking frequencies:", freqError);
  } else {
    console.log("Orphan frequencies linked to import.");
  }

  // 3. Run the structural promotion logic to ensure everything else is aligned
  try {
    const result = await promoteChecklistImportToOperational(BANANA_JULY_IMPORT_ID);
    console.log("Structural promotion result:", result);
  } catch (e) {
    console.error("Error in structural promotion:", e);
  }

  console.log("Fix complete.");
}

fix().catch(console.error);
