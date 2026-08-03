import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ChecklistBatch, BatchStatus } from "./batch-types";

export async function createBatch(userId: string): Promise<ChecklistBatch> {
  const { data, error } = await supabaseAdmin
    .from("mk9_checklist_import_batches")
    .insert({
      created_by: userId,
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
    createdAt: data.created_at,
  };
}

export async function updateBatchStatus(batchId: string, status: BatchStatus) {
  const { error } = await supabaseAdmin
    .from("mk9_checklist_import_batches")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", batchId);
  if (error) throw new Error(error.message);
}

export async function listIndustries() {
  const { data, error } = await supabaseAdmin
    .from("mk9_industries")
    .select("id, name, requires_checklist, archived_at")
    .eq("requires_checklist", true)
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  return data;
}
