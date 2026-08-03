import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ChecklistBatch, BatchStatus } from "./batch-types";

export async function createBatch(userId: string): Promise<ChecklistBatch> {
  const { data, error } = await supabaseAdmin
    .from("mk9_checklist_import_batches")
    .insert({
      createdBy: userId,
      status: "DRAFT",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return {
    id: data.id,
    status: data.status as BatchStatus,
    totalFiles: 0,
    readyFiles: 0,
    importedFiles: 0,
    reviewFiles: 0,
    failedFiles: 0,
    files: [],
    createdAt: data.createdAt,
  };
}

export async function updateBatchStatus(batchId: string, status: BatchStatus) {
  const { error } = await supabaseAdmin
    .from("mk9_checklist_import_batches")
    .update({ status, updatedAt: new Date().toISOString() })
    .eq("id", batchId);
  if (error) throw new Error(error.message);
}

export async function listIndustries() {
  const { data, error } = await supabaseAdmin
    .from("mk9_industries")
    .select("id, name, requiresChecklist, archivedAt")
    .eq("requiresChecklist", true)
    .is("archivedAt", null);
  if (error) throw new Error(error.message);
  return data;
}
