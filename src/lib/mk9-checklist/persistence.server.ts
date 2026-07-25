// Persistência do módulo Checklists. SERVER-ONLY.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ChecklistPreview } from "./types";

export async function loadStoresIndex() {
  const { data, error } = await supabaseAdmin
    .from("mk9_stores")
    .select("id, name, name_normalized, uf");
  if (error) throw new Error(error.message);
  const byKey = new Map<string, { id: string; name: string; uf: string | null }>();
  const byName = new Map<string, { id: string; name: string; uf: string | null }>();
  for (const row of data ?? []) {
    const uf = (row.uf as string | null) ?? null;
    const rec = { id: row.id as string, name: row.name as string, uf };
    byKey.set(`${row.name_normalized}|${uf ?? ""}`, rec);
    // Fallback por nome quando UF não bate
    if (!byName.has(row.name_normalized as string)) byName.set(row.name_normalized as string, rec);
  }
  return { byKey, byName };
}

export async function loadIndustry(industryId: string) {
  const { data, error } = await supabaseAdmin
    .from("mk9_industries")
    .select("id, name")
    .eq("id", industryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Indústria não encontrada");
  return { id: data.id as string, name: data.name as string };
}

export async function createChecklistImport(input: {
  filename: string;
  industryId: string;
  operationMonth: number;
  operationYear: number;
  userId?: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .insert({
      filename: input.filename,
      industry_id: input.industryId,
      operation_month: input.operationMonth,
      operation_year: input.operationYear,
      status: "previewing",
      user_id: input.userId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string };
}

export async function savePreviewSnapshot(importId: string, preview: ChecklistPreview) {
  const { error } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .update({ preview: preview as any, counters: preview.counters as any })
    .eq("id", importId);
  if (error) throw new Error(error.message);
}

export async function updateImportStatus(
  importId: string,
  patch: {
    status?: "pending" | "previewing" | "confirmed" | "committing" | "done" | "failed" | "cancelled";
    counters?: Record<string, unknown>;
    errorMessage?: string | null;
    finishedAt?: Date;
    durationMs?: number;
  },
) {
  const update: Record<string, unknown> = {};
  if (patch.status) update.status = patch.status;
  if (patch.counters) update.counters = patch.counters;
  if (patch.errorMessage !== undefined) update.error_message = patch.errorMessage;
  if (patch.finishedAt) update.finished_at = patch.finishedAt.toISOString();
  if (patch.durationMs !== undefined) update.duration_ms = patch.durationMs;
  const { error } = await supabaseAdmin.from("mk9_checklist_imports").update(update as any).eq("id", importId);
  if (error) throw new Error(error.message);
}

export async function persistActualVisits(
  importId: string,
  industryId: string,
  rows: Array<{ storeId: string; scheduledDate: string }>,
) {
  if (!rows.length) return { persisted: 0, skipped: 0 };

  // Deduplica no lote por (store, date)
  const dedup = new Map<string, { storeId: string; scheduledDate: string }>();
  for (const r of rows) dedup.set(`${r.storeId}|${r.scheduledDate}`, r);
  const list = Array.from(dedup.values());

  // Verifica quais já existem para reportar "skipped"
  const keys = list.map((r) => `${r.storeId}|${r.scheduledDate}`);
  const { data: existing, error: exErr } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("store_id, scheduled_date")
    .eq("industry_id", industryId)
    .eq("origin", "CHECKLIST")
    .in("store_id", Array.from(new Set(list.map((r) => r.storeId))));
  if (exErr) throw new Error(exErr.message);
  const existingSet = new Set(
    (existing ?? []).map((r: any) => `${r.store_id}|${r.scheduled_date}`),
  );
  const skipped = keys.filter((k) => existingSet.has(k)).length;

  const payload = list.map((r) => ({
    industry_id: industryId,
    store_id: r.storeId,
    scheduled_date: r.scheduledDate,
    origin: "CHECKLIST" as const,
    status: "completed",
    source_import_id: importId,
  }));

  const CHUNK = 500;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin
      .from("mk9_actual_visits")
      .upsert(slice as any, { onConflict: "industry_id,store_id,scheduled_date,origin" });
    if (error) throw new Error(error.message);
  }

  return { persisted: list.length - skipped, skipped };
}

export async function listChecklistImports(limit = 30) {
  const { data, error } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("*, industry:mk9_industries(id,name)")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    filename: r.filename as string,
    industryId: r.industry_id as string,
    industryName: r.industry?.name ?? "—",
    operationMonth: r.operation_month as number,
    operationYear: r.operation_year as number,
    status: r.status as string,
    counters: r.counters ?? {},
    errorMessage: (r.error_message as string | null) ?? null,
    startedAt: r.started_at as string,
    finishedAt: (r.finished_at as string | null) ?? null,
    durationMs: (r.duration_ms as number | null) ?? null,
  }));
}

export async function deleteChecklistImport(importId: string) {
  // ON DELETE SET NULL na FK -> visitas realizadas ficam preservadas por padrão.
  // Se quisermos removê-las também: descomentar bloco abaixo.
  // await supabaseAdmin.from("mk9_actual_visits").delete().eq("source_import_id", importId);
  const { error } = await supabaseAdmin.from("mk9_checklist_imports").delete().eq("id", importId);
  if (error) throw new Error(error.message);
}
