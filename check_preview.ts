import { loadPreviewSnapshot } from "./src/lib/mk9-checklist/persistence.server";
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function checkPreview() {
  const julyImportId = "0030c1d4-f6f9-43b4-842b-48afd2330f27";
  const preview = await loadPreviewSnapshot(julyImportId);
  
  console.log("=== PREVIEW SNAPSHOT INSPECTION ===");
  console.log("Found preview:", !!preview);
  if (preview) {
      console.log("Industry:", preview.industryName);
      console.log("Items count:", preview.items?.length);
      
      const validItems = preview.items?.filter(
            (i: any) =>
              (i.status === "found" ||
                i.status === "linked_by_similarity" ||
                i.status === "new_store") &&
              i.scheduledDate
      );
      console.log("Valid Items for Commit:", validItems?.length);
      if (validItems && validItems.length > 0) {
          console.log("Sample Item:", validItems[0]);
      }
  }

  // Verificando também a coluna preview_snapshot bruta
  const { data: raw } = await supabaseAdmin.from("mk9_checklist_imports").select("preview_snapshot").eq("id", julyImportId).single();
  console.log("\nRAW PREVIEW_SNAPSHOT COLUMN (keys):", Object.keys(raw?.preview_snapshot || {}));
}

checkPreview().catch(console.error);
