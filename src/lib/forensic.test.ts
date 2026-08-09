import { describe, it, expect } from "vitest";
import { checklistCommit } from "./mk9-checklist.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPreviewSnapshot } from "./mk9-checklist/persistence.server";

describe("Forensic Audit Test", () => {
  it("should process CICOPAL Julho 2026 correctly", async () => {
    const importId = "0030c1d4-f6f9-43b4-842b-48afd2330f27";
    const industryId = "6e8c1ff7-a364-4fcd-ad27-0a18eaf8485d";

    console.log("=== MK9 TEST AUDIT START ===");

    const preview = await loadPreviewSnapshot(importId);
    expect(preview).toBeDefined();

    const items = preview!.items
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

    console.log("Items count:", items.length);

    // @ts-ignore
    const res = await checklistCommit({
      data: {
        importId,
        industryId,
        operationMonth: 7,
        operationYear: 2026,
        items,
        forceFrequencyConflicts: true,
        forceReason: "Vitest forensic audit"
      }
    });

    console.log("Commit Result:", res);

    const { data: imp } = await supabaseAdmin.from("mk9_checklist_imports").select("*").eq("id", importId).single();
    console.log("Import Status:", imp?.status, "Current:", imp?.is_operational_current);

    const { count: visitsCount } = await supabaseAdmin
      .from("mk9_actual_visits")
      .select("*", { count: 'exact', head: true })
      .eq("source_import_id", importId);
    console.log("Visits in DB:", visitsCount);

    const { count: freqCount } = await supabaseAdmin
      .from("mk9_industry_store_frequency_versions")
      .select("*", { count: 'exact', head: true })
      .eq("source_import_id", importId);
    console.log("Frequency Versions in DB:", freqCount);
    
    expect(visitsCount).toBe(28);
    expect(imp?.is_operational_current).toBe(true);
  });
});
