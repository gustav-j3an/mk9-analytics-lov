// Persistência do módulo Checklists. SERVER-ONLY.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ChecklistPreview } from "./types";

export interface StoreIndexRecord {
  id: string;
  name: string;
  nameNormalized: string;
  uf: string | null;
}

export async function loadStoresIndex() {
  const { data, error } = await supabaseAdmin
    .from("mk9_stores")
    .select("id, name, name_normalized, uf");
  if (error) throw new Error(error.message);
  const byKey = new Map<string, StoreIndexRecord>();
  const byName = new Map<string, StoreIndexRecord>();
  const all: StoreIndexRecord[] = [];
  for (const row of data ?? []) {
    const uf = (row.uf as string | null) ?? null;
    const rec: StoreIndexRecord = {
      id: row.id as string,
      name: row.name as string,
      nameNormalized: row.name_normalized as string,
      uf,
    };
    all.push(rec);
    byKey.set(`${rec.nameNormalized}|${uf ?? ""}`, rec);
    if (!byName.has(rec.nameNormalized)) byName.set(rec.nameNormalized, rec);
  }
  return { byKey, byName, all };
}

// Cria (ou reaproveita) lojas para o checklist. Retorna mapa (normalized|uf) -> storeId.
// Idempotente: revalida por (name_normalized, uf) antes de inserir e ignora conflitos.
export async function ensureChecklistStores(
  importId: string,
  candidates: Array<{ storeName: string; storeNormalized: string; uf: string | null }>,
) {
  const result = new Map<string, { storeId: string; created: boolean }>();
  if (!candidates.length) return result;

  // Dedup interno por (normalized, uf); mantém a primeira grafia.
  const dedup = new Map<string, { storeName: string; storeNormalized: string; uf: string | null }>();
  for (const c of candidates) {
    const key = `${c.storeNormalized}|${c.uf ?? ""}`;
    if (!dedup.has(key)) dedup.set(key, c);
  }

  // Revalida: quem já existe agora não precisa ser criado.
  const normalized = Array.from(new Set(Array.from(dedup.values()).map((c) => c.storeNormalized)));
  const { data: existing, error: exErr } = await supabaseAdmin
    .from("mk9_stores")
    .select("id, name_normalized, uf")
    .in("name_normalized", normalized);
  if (exErr) throw new Error(exErr.message);
  const existingMap = new Map<string, string>();
  for (const row of existing ?? []) {
    existingMap.set(`${row.name_normalized}|${(row.uf as string | null) ?? ""}`, row.id as string);
  }

  for (const [key, c] of dedup) {
    const already = existingMap.get(key);
    if (already) {
      result.set(key, { storeId: already, created: false });
      continue;
    }
    // Insert individual para tolerar conflitos concorrentes por (name_normalized, uf) sem parar o lote.
    const insertPayload: Record<string, unknown> = {
      name: c.storeName,
      name_normalized: c.storeNormalized,
      uf: c.uf,
      origin: "CHECKLIST_IMPORT",
      is_incomplete: true,
      created_by_checklist_import_id: importId,
      notes: "Loja criada automaticamente pela importação do checklist",
      last_import_id: null,
    };
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("mk9_stores")
      .insert(insertPayload as any)
      .select("id")
      .single();
    if (insErr) {
      // Provável conflito por unique(name_normalized, uf): busca a linha existente.
      const query = supabaseAdmin
        .from("mk9_stores")
        .select("id")
        .eq("name_normalized", c.storeNormalized);
      const { data: after, error: afterErr } = c.uf === null
        ? await query.is("uf", null).maybeSingle()
        : await query.eq("uf", c.uf).maybeSingle();
      if (afterErr || !after) throw new Error(insErr.message);
      result.set(key, { storeId: after.id as string, created: false });
      continue;
    }
    result.set(key, { storeId: inserted.id as string, created: true });
  }

  return result;
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
