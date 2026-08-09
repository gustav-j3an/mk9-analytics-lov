import { checklistCommit } from "./src/lib/mk9-checklist.functions";
import { supabaseAdmin } from "./src/integrations/supabase/client.server";
import { loadPreviewSnapshot } from "./src/lib/mk9-checklist/persistence.server";

async function retryCommit() {
  const importId = "0030c1d4-f6f9-43b4-842b-48afd2330f27";
  const industryId = "6e8c1ff7-a364-4fcd-ad27-0a18eaf8485d";

  console.log("=== MK9 RETRY COMMIT DIAGNOSTIC: CICOPAL ===");

  const preview = await loadPreviewSnapshot(importId);
  if (!preview) {
      console.error("Preview not found for", importId);
      return;
  }

  const items = preview.items
    .filter(
      (i: any) =>
        (i.status === "found" ||
          i.status === "linked_by_similarity" ||
          i.status === "new_store") &&
        i.scheduledDate,
    )
    .map((i: any) => ({
      storeId: i.storeId,
      storeName: i.storeName,
      storeNormalized: i.storeNormalized,
      uf: i.uf,
      scheduledDate: i.scheduledDate,
      isNew: i.status === "new_store",
    }));

  console.log("Items to commit:", items.length);

  try {
      // Forçamos o contexto de ADMIN se necessário, mas o script roda como root
      // @ts-ignore
      const res = await checklistCommit({
          data: {
              importId,
              industryId,
              operationMonth: 7,
              operationYear: 2026,
              items,
              forceFrequencyConflicts: true,
              forceReason: "Forensic audit retry"
          }
      });

      console.log("Commit Result:", res);

      // Agora verificamos IMEDIATAMENTE o banco
      const { data: imp } = await supabaseAdmin.from("mk9_checklist_imports").select("id, status, is_operational_current").eq("id", importId).single();
      console.log("Post-Commit Import Status:", imp);

      const { data: visits } = await supabaseAdmin.from("mk9_actual_visits").select("count").eq("source_import_id", importId);
      console.log("Post-Commit Visits Count:", visits);

      const { data: freqs } = await supabaseAdmin.from("mk9_industry_store_frequency_versions").select("count").eq("source_import_id", importId);
      console.log("Post-Commit Frequency Versions:", freqs);

  } catch (err: any) {
      console.error("Commit failed with error:", err.message);
      try {
          const parsed = JSON.parse(err.message);
          console.dir(parsed, { depth: null });
      } catch {}
  }
}

retryCommit().catch(console.error);
