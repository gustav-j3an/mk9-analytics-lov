import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface RevertPreview {
  importId: string;
  filename: string;
  industryName: string;
  operationMonth: number;
  operationYear: number;
  batchId: string | null;
  visitsCount: number;
  frequencyVersionsCount: number;
  storesCreatedCount: number;
  reconciliationsCount: number;
  qualityIssuesCount: number;
  hasPosteriorImports: boolean;
  manualDependenciesCount: number;
  canRevert: boolean;
  blockReason: string | null;
}

export async function getRevertPreview(importId: string): Promise<RevertPreview> {
  const { data: imp, error: impErr } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("*, industry:mk9_industries(name)")
    .eq("id", importId)
    .single();

  if (impErr || !imp) throw new Error("Importação não encontrada");

  // Counts
  const { count: visitsCount } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("*", { count: "exact", head: true })
    .eq("source_import_id", importId);

  const { count: freqCount } = await supabaseAdmin
    .from("mk9_industry_store_frequency_versions")
    .select("*", { count: "exact", head: true })
    .eq("source_import_id", importId);

  const { count: storeCount } = await supabaseAdmin
    .from("mk9_stores")
    .select("*", { count: "exact", head: true })
    // @ts-ignore - column added via migration
    .eq("created_by_checklist_import_id", importId);

  const { count: reconCount } = await supabaseAdmin
    .from("mk9_visit_reconciliations")
    .select("*", { count: "exact", head: true })
    .eq("source_import_id", importId);

  // Posterior imports
  const { data: posterior } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("id")
    .eq("industry_id", imp.industry_id)
    .eq("operation_month", imp.operation_month)
    .eq("operation_year", imp.operation_year)
    .gt("started_at", imp.started_at)
    .eq("status", "done")
    .limit(1);

  // Manual dependencies in frequency
  const { data: manualDep } = await supabaseAdmin
    .from("mk9_industry_store_frequency_versions")
    .select("id")
    .eq("industry_id", imp.industry_id)
    .eq("source_type", "MANUAL")
    .is("archived_at", null)
    .limit(1);

  const manualDependenciesCount = manualDep?.length || 0;

  return {
    importId,
    filename: imp.filename,
    industryName: (imp as any).industry?.name ?? "—",
    operationMonth: imp.operation_month,
    operationYear: imp.operation_year,
    batchId: (imp as any).batch_id ?? null,
    visitsCount: visitsCount || 0,
    frequencyVersionsCount: freqCount || 0,
    storesCreatedCount: storeCount || 0,
    reconciliationsCount: reconCount || 0,
    qualityIssuesCount: 0,
    hasPosteriorImports: !!posterior?.length,
    manualDependenciesCount,
    // @ts-ignore - enum types not updated
    canRevert: imp.status === "done" || imp.status === "revert_failed",
    // @ts-ignore
    blockReason: imp.status === "reverted" ? "Esta importação já foi revertida." : null,
  };
}

export async function executeRevert(
  importId: string,
  options: { reason: string; actorId?: string },
) {
  const { data, error } = await (supabaseAdmin as any).rpc("mk9_revert_checklist_import", {
    _import_id: importId,
    _reason: options.reason,
    _actor: options.actorId || null,
  });

  if (error) {
    // If it fails, update status to revert_failed
    await supabaseAdmin
      .from("mk9_checklist_imports")
      .update({ status: "revert_failed", error_message: error.message } as any)
      .eq("id", importId);

    throw new Error(error.message);
  }

  return data;
}

export async function executeCorrection(
  importId: string,
  options: { targetMonth: number; targetYear: number; reason: string; actorId?: string },
) {
  // 1. Get snapshot from current import
  const { data: imp, error: impErr } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("*")
    .eq("id", importId)
    .single();

  if (impErr || !imp) throw new Error("Importação original não encontrada");
  if (!imp.preview) throw new Error("Dados da importação (snapshot) não encontrados");

  // 2. Execute revert of the current one
  await executeRevert(importId, {
    reason: `Correção de competência para ${options.targetMonth}/${options.targetYear}: ${options.reason}`,
    actorId: options.actorId,
  });

  // 3. Create new import in target competency
  const { createChecklistImport } = await import("./persistence.server");
  const newImp = await createChecklistImport({
    filename: imp.filename,
    industryId: imp.industry_id,
    operationMonth: options.targetMonth,
    operationYear: options.targetYear,
    userId: options.actorId || undefined,
  });

  // Link them
  await supabaseAdmin
    .from("mk9_checklist_imports")
    .update({
      corrected_from_import_id: importId,
      status: "previewing",
      preview: imp.preview,
      counters: imp.counters,
      batch_id: (imp as any).batch_id || null,
    } as any)
    .eq("id", newImp.id);

  await supabaseAdmin
    .from("mk9_checklist_imports")
    .update({ corrected_to_import_id: newImp.id } as any)
    .eq("id", importId);

  // 4. Commit the new one
  const { checklistCommit } = await import("../mk9-checklist.functions");

  // We need to transform items from preview snapshot to commit schema
  const preview = imp.preview as any;
  const items = preview.items.map((it: any) => ({
    storeId: it.storeId,
    storeName: it.storeName,
    storeNormalized: it.storeNormalized,
    uf: it.uf,
    scheduledDate: it.scheduledDate,
    isNew: it.status === "new_store",
  }));

  const commitRes = await (checklistCommit as any)({
    data: {
      importId: newImp.id,
      industryId: imp.industry_id,
      operationMonth: options.targetMonth,
      operationYear: options.targetYear,
      items,
      forceFrequencyConflicts: true, // We force because it's a correction
      forceReason: `Correção automática: ${options.reason}`,
    },
  });

  return {
    revertedImportId: importId,
    newImportId: newImp.id,
    commitResult: commitRes,
  };
}
