// Adapter Supabase do Mk9Repository. SERVER-ONLY (extensão .server.ts).
// Para portar para Prisma: reimplemente esta interface em `persistence.prisma.ts`
// com os mesmos métodos assinados. Nenhuma outra camada precisa mudar.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Mk9Repository } from "./repository";
import type {
  ImportItem,
  ImportPreview,
  IndustryRecord,
  PlannedRouteRecord,
  PlannedVisitRecord,
  PromoterRecord,
  StoreRecord,
  SyncMode,
} from "./types";

// mapeamento snake_case (DB) <-> camelCase (domínio)
const mapIndustry = (r: any): IndustryRecord => ({
  id: r.id, name: r.name, nameNormalized: r.name_normalized,
  monthlyContractedFrequency: r.monthly_contracted_frequency,
  monthlyEstimatedFrequency: r.monthly_estimated_frequency,
  frequencyDifference: r.frequency_difference,
  frequencyStatus: r.frequency_status,
  weeksCount: r.weeks_count,
});
const mapStore = (r: any): StoreRecord => ({
  id: r.id, chain: r.chain, name: r.name,
  nameNormalized: r.name_normalized, uf: r.uf,
});
const mapPromoter = (r: any): PromoterRecord => ({
  id: r.id, externalId: r.external_id, name: r.name,
  nameNormalized: r.name_normalized, city: r.city,
  contact: r.contact, contactNormalized: r.contact_normalized, notes: r.notes,
});
const mapRoute = (r: any): PlannedRouteRecord => ({
  id: r.id, promoterId: r.promoter_id, storeId: r.store_id, industryId: r.industry_id,
  weekday: r.weekday, operationMonth: r.operation_month, operationYear: r.operation_year,
  sourceSheet: r.source_sheet,
});
const mapVisit = (r: any): PlannedVisitRecord => ({
  id: r.id, promoterId: r.promoter_id, storeId: r.store_id, industryId: r.industry_id,
  routeId: r.route_id, scheduledDate: r.scheduled_date, status: r.status,
  sourceSheet: r.source_sheet,
});

// Strip `id` when null/undefined/empty so Postgres DEFAULT gen_random_uuid() fires.
// Sending `id: null` explicitly overrides the DEFAULT and causes 23502 NOT NULL violation.
function withOptionalId<T extends Record<string, any>>(row: T): T {
  const v = row.id;
  if (v === null || v === undefined || v === "") {
    const { id: _omit, ...rest } = row;
    return rest as T;
  }
  return row;
}

export function createSupabaseRepository(): Mk9Repository {
  return {
    async listIndustries() {
      const { data, error } = await supabaseAdmin.from("mk9_industries").select("*");
      if (error) throw error;
      return (data ?? []).map(mapIndustry);
    },
    async listStores() {
      const { data, error } = await supabaseAdmin.from("mk9_stores").select("*");
      if (error) throw error;
      return (data ?? []).map(mapStore);
    },
    async listPromoters() {
      const { data, error } = await supabaseAdmin.from("mk9_promoters").select("*");
      if (error) throw error;
      return (data ?? []).map(mapPromoter);
    },
    async listPlannedRoutes(month, year) {
      const { data, error } = await supabaseAdmin
        .from("mk9_planned_routes").select("*")
        .eq("operation_month", month).eq("operation_year", year);
      if (error) throw error;
      return (data ?? []).map(mapRoute);
    },
    async listPlannedVisits(month, year) {
      const first = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
      const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      const { data, error } = await supabaseAdmin
        .from("mk9_planned_visits").select("*")
        .gte("scheduled_date", first).lte("scheduled_date", last)
        .is("archived_at", null);
      if (error) throw error;
      return (data ?? []).map(mapVisit);
    },
    async upsertIndustries(records, importId) {
      if (!records.length) return [];
      const dedup = new Map<string, IndustryRecord>();
      for (const r of records) dedup.set(r.nameNormalized, { ...dedup.get(r.nameNormalized), ...r });
      const list = Array.from(dedup.values());

      // Pré-busca ids estáveis por name_normalized para NÃO trocar o id no UPDATE do ON CONFLICT.
      // Sem isso, o PostgREST envia id=DEFAULT no upsert, gera novo UUID e quebra as FKs (industry_store_frequency, routes, visits).
      const names = list.map((r) => r.nameNormalized);
      const { data: existingRows, error: exErr } = await supabaseAdmin
        .from("mk9_industries").select("id, name_normalized").in("name_normalized", names);
      if (exErr) throw exErr;
      const idByName = new Map<string, string>();
      for (const row of existingRows ?? []) idByName.set(row.name_normalized as string, row.id as string);

      const payload = list.map((r) => withOptionalId({
        id: r.id ?? idByName.get(r.nameNormalized), name: r.name, name_normalized: r.nameNormalized,
        monthly_contracted_frequency: r.monthlyContractedFrequency,
        monthly_estimated_frequency: r.monthlyEstimatedFrequency,
        frequency_difference: r.frequencyDifference,
        frequency_status: r.frequencyStatus,
        weeks_count: r.weeksCount,
        last_import_id: importId,
      }));
      const { data, error } = await supabaseAdmin
        .from("mk9_industries").upsert(payload, { onConflict: "name_normalized", defaultToNull: false }).select();
      if (error) throw error;
      return (data ?? []).map(mapIndustry);
    },
    async upsertStores(records, importId) {
      if (!records.length) return [];
      const dedup = new Map<string, StoreRecord>();
      for (const r of records) {
        const k = `${r.nameNormalized}::${r.uf ?? ""}`;
        dedup.set(k, { ...dedup.get(k), ...r });
      }
      const list = Array.from(dedup.values());

      // Pré-busca ids estáveis por (name_normalized, uf) para preservar o id existente no UPDATE do ON CONFLICT.
      // Se enviássemos id ausente com defaultToNull:false, o UPDATE aplicaria id=DEFAULT (novo UUID), quebrando FKs
      // em mk9_planned_routes, mk9_planned_visits, mk9_industry_store_frequency, mk9_actual_visits, reconciliations.
      const names = Array.from(new Set(list.map((r) => r.nameNormalized)));
      const { data: existingRows, error: exErr } = await supabaseAdmin
        .from("mk9_stores").select("id, name_normalized, uf").in("name_normalized", names);
      if (exErr) throw exErr;
      const idByKey = new Map<string, string>();
      for (const row of existingRows ?? []) {
        idByKey.set(`${row.name_normalized}::${(row.uf as string | null) ?? ""}`, row.id as string);
      }

      const payload = list.map((r) => {
        const key = `${r.nameNormalized}::${r.uf ?? ""}`;
        return withOptionalId({
          id: r.id ?? idByKey.get(key), chain: r.chain, name: r.name,
          name_normalized: r.nameNormalized, uf: r.uf, last_import_id: importId,
        });
      });
      // (name_normalized, uf) unique treats NULL uf as distinct; split NULL-uf rows into insert-if-missing
      const withUf = payload.filter((p) => p.uf !== null && p.uf !== undefined);
      const withoutUf = payload.filter((p) => p.uf === null || p.uf === undefined);
      const out: StoreRecord[] = [];
      if (withUf.length) {
        const { data, error } = await supabaseAdmin
          .from("mk9_stores").upsert(withUf, { onConflict: "name_normalized,uf", defaultToNull: false }).select();
        if (error) throw error;
        out.push(...(data ?? []).map(mapStore));
      }
      for (const p of withoutUf) {
        const { data: existing } = await supabaseAdmin.from("mk9_stores")
          .select("*").eq("name_normalized", p.name_normalized).is("uf", null).maybeSingle();
        if (existing) {
          const { data, error } = await supabaseAdmin.from("mk9_stores")
            .update({ chain: p.chain, name: p.name, last_import_id: importId })
            .eq("id", existing.id).select().single();
          if (error) throw error;
          out.push(mapStore(data));
        } else {
          const { data, error } = await supabaseAdmin.from("mk9_stores").insert(p).select().single();
          if (error) throw error;
          out.push(mapStore(data));
        }
      }
      return out;
    },
    async upsertPromoters(records, importId) {
      if (!records.length) return [];

      // 1) Deduplica o lote: primeiro por external_id, depois por name_normalized.
      const mergePromoter = (a: PromoterRecord | undefined, b: PromoterRecord): PromoterRecord => ({
        id: b.id ?? a?.id,
        externalId: b.externalId ?? a?.externalId ?? null,
        name: b.name || a?.name || "",
        nameNormalized: b.nameNormalized || a?.nameNormalized || "",
        city: b.city ?? a?.city ?? null,
        contact: b.contact ?? a?.contact ?? null,
        contactNormalized: b.contactNormalized ?? a?.contactNormalized ?? null,
        notes: b.notes ?? a?.notes ?? null,
      });
      const byExt = new Map<string, PromoterRecord>();
      const byName = new Map<string, PromoterRecord>();
      for (const r of records) {
        if (r.externalId) {
          byExt.set(r.externalId, mergePromoter(byExt.get(r.externalId), r));
        } else if (r.nameNormalized) {
          byName.set(r.nameNormalized, mergePromoter(byName.get(r.nameNormalized), r));
        }
      }
      // se o mesmo nome também aparece com external_id, não duplica no bucket "sem id"
      for (const rec of byExt.values()) {
        if (rec.nameNormalized) byName.delete(rec.nameNormalized);
      }
      const list = [...byExt.values(), ...byName.values()];

      // 2) Snapshot do banco para correspondência
      const { data: dbAll, error: dbErr } = await supabaseAdmin
        .from("mk9_promoters").select("id, external_id, name, name_normalized");
      if (dbErr) throw dbErr;
      const dbByExt = new Map<string, any>();
      const dbByName = new Map<string, any>();
      for (const row of dbAll ?? []) {
        if (row.external_id) dbByExt.set(String(row.external_id), row);
        if (row.name_normalized) dbByName.set(row.name_normalized, row);
      }

      const out: PromoterRecord[] = [];
      for (const r of list) {
        // 3) Correspondência: (a) external_id, (b) name_normalized
        let existing: any | undefined = r.externalId ? dbByExt.get(r.externalId) : undefined;
        let matchedBy: "ext" | "name" | null = existing ? "ext" : null;
        if (!existing && r.nameNormalized) {
          existing = dbByName.get(r.nameNormalized);
          if (existing) matchedBy = "name";
        }

        // 4) Conflito de identidade: external_id da planilha pertence a outro registro.
        //    Não sobrescreve; preserva o external_id atual do registro casado por nome.
        let nextExternalId: string | null = r.externalId ?? existing?.external_id ?? null;
        if (matchedBy === "name" && r.externalId) {
          const owner = dbByExt.get(r.externalId);
          if (owner && owner.id !== existing.id) {
            nextExternalId = existing.external_id ?? null;
            console.warn(
              `[mk9] Conflito de identidade em promotor: external_id=${r.externalId} pertence a "${owner.name}", ignorado ao atualizar "${existing.name}"`,
            );
          }
        }

        const payload = {
          external_id: nextExternalId,
          name: r.name,
          name_normalized: r.nameNormalized,
          city: r.city,
          contact: r.contact,
          contact_normalized: r.contactNormalized,
          notes: r.notes,
          last_import_id: importId,
        };

        if (existing) {
          const { data, error } = await supabaseAdmin.from("mk9_promoters")
            .update(payload).eq("id", existing.id).select().single();
          if (error) throw error;
          out.push(mapPromoter(data));
          if (data.external_id) dbByExt.set(String(data.external_id), data);
          if (data.name_normalized) dbByName.set(data.name_normalized, data);
        } else {
          const { data, error } = await supabaseAdmin.from("mk9_promoters")
            .insert(payload).select().single();
          if (error) throw error;
          out.push(mapPromoter(data));
          if (data.external_id) dbByExt.set(String(data.external_id), data);
          if (data.name_normalized) dbByName.set(data.name_normalized, data);
        }
      }
      return out;
    },
    async upsertPlannedRoutes(records, importId) {
      if (!records.length) return [];
      const dedup = new Map<string, PlannedRouteRecord>();
      for (const r of records) {
        const k = `${r.promoterId}|${r.storeId}|${r.industryId}|${r.weekday}|${r.operationMonth}|${r.operationYear}`;
        dedup.set(k, r);
      }
      const list = Array.from(dedup.values());
      const { data, error } = await supabaseAdmin.from("mk9_planned_routes").upsert(
        list.map((r) => withOptionalId({
          id: r.id, promoter_id: r.promoterId, store_id: r.storeId, industry_id: r.industryId,
          weekday: r.weekday, operation_month: r.operationMonth, operation_year: r.operationYear,
          source_sheet: r.sourceSheet, last_import_id: importId,
        })),
        { onConflict: "promoter_id,store_id,industry_id,weekday,operation_month,operation_year", defaultToNull: false },
      ).select();
      if (error) throw error;
      return (data ?? []).map(mapRoute);
    },
    async removePlannedRoutes(ids) {
      if (!ids.length) return;
      const { error } = await supabaseAdmin.from("mk9_planned_routes").delete().in("id", ids);
      if (error) throw error;
    },
    async upsertPlannedVisits(records, importId, archiveIds = []) {
      const dedup = new Map<string, PlannedVisitRecord>();
      for (const r of records) {
        const k = `${r.promoterId}|${r.storeId}|${r.industryId}|${r.scheduledDate}`;
        dedup.set(k, r);
      }
      const list = Array.from(dedup.values());
      const archiveSample = archiveIds.slice(0, 25);
      console.info("[ARCHIVE PLANNED VISITS]", {
        scope: "mk9 roteiro full sync",
        quantidade: archiveIds.length,
        ids: archiveSample,
        truncated: archiveIds.length > archiveSample.length,
      });

      // Transação no banco: atualiza existentes sem tocar no id, insere novos
      // sem enviar id (DEFAULT gen_random_uuid()) e arquiva ausentes.
      const payload = list.map((r) => ({
        promoter_id: r.promoterId,
        store_id: r.storeId,
        industry_id: r.industryId,
        route_id: r.routeId ?? null,
        scheduled_date: r.scheduledDate,
        status: r.status,
        source_sheet: r.sourceSheet ?? null,
      }));
      const { error } = await (supabaseAdmin as any).rpc("mk9_sync_planned_visits", {
        _rows: payload,
        _archive_ids: archiveIds,
        _import_id: importId,
      });
      if (error) throw error;

      if (!list.length) return [];
      const out: PlannedVisitRecord[] = [];
      const CHUNK = 500;
      for (let i = 0; i < list.length; i += CHUNK) {
        const slice = list.slice(i, i + CHUNK);
        let q = supabaseAdmin
          .from("mk9_planned_visits")
          .select("*")
          .is("archived_at", null);
        const or = slice
          .map((r) => `and(promoter_id.eq.${r.promoterId},store_id.eq.${r.storeId},industry_id.eq.${r.industryId},scheduled_date.eq.${r.scheduledDate})`)
          .join(",");
        const { data, error: readErr } = await q.or(or);
        if (readErr) throw readErr;
        out.push(...(data ?? []).map(mapVisit));
      }
      return out;
    },
    async removeFuturePlannedVisits(ids) {
      if (!ids.length) return;
      const archiveSample = ids.slice(0, 25);
      console.info("[ARCHIVE PLANNED VISITS]", {
        scope: "legacy removeFuturePlannedVisits",
        quantidade: ids.length,
        ids: archiveSample,
        truncated: ids.length > archiveSample.length,
      });
      // Arquivamento lógico: preserva o id e as reconciliações vinculadas.
      // Apenas visitas ainda planejadas são arquivadas; realizadas/canceladas ficam intactas.
      const { error } = await supabaseAdmin.from("mk9_planned_visits")
        .update({ archived_at: new Date().toISOString() })
        .in("id", ids).eq("status", "planned").is("archived_at", null);
      if (error) throw error;
    },
    async createImport(input) {
      const { data, error } = await supabaseAdmin.from("mk9_imports").insert({
        filename: input.filename, file_hash: input.fileHash,
        operation_month: input.operationMonth, operation_year: input.operationYear,
        sync_mode: input.syncMode, sheets_analyzed: input.sheetsAnalyzed,
        status: "previewing", user_id: input.userId ?? null,
      }).select("id").single();
      if (error) throw error;
      return { id: data.id as string };
    },
    async savePreview(importId, preview) {
      const { error } = await supabaseAdmin.from("mk9_imports")
        .update({ preview: preview as any, counters: preview.counters as any }).eq("id", importId);
      if (error) throw error;
    },
    async saveImportItems(importId, items) {
      if (!items.length) return;
      const CHUNK = 500;
      for (let i = 0; i < items.length; i += CHUNK) {
        const slice = items.slice(i, i + CHUNK);
        const { error } = await supabaseAdmin.from("mk9_import_items").insert(
          slice.map((it) => ({
            import_id: importId, sheet: it.sheet, excel_row: it.excelRow ?? null,
            entity_type: it.entityType, action: it.action,
            payload: it.payload as any, resolved_ids: (it.resolvedIds ?? {}) as any,
            warnings: (it.warnings ?? []) as any,
          })) as any,
        );
        if (error) throw error;
      }
    },
    async updateImportStatus(importId, patch) {
      const update: Record<string, unknown> = {};
      if (patch.status) update.status = patch.status;
      if (patch.counters) update.counters = patch.counters;
      if (patch.errorMessage !== undefined) update.error_message = patch.errorMessage;
      if (patch.finishedAt) update.finished_at = patch.finishedAt.toISOString();
      if (patch.durationMs !== undefined) update.duration_ms = patch.durationMs;
      const { error } = await supabaseAdmin.from("mk9_imports").update(update as any).eq("id", importId);
      if (error) throw error;
    },

    async listImports(limit = 30) {
      const { data, error } = await supabaseAdmin.from("mk9_imports")
        .select("*").order("started_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id, filename: r.filename, operationMonth: r.operation_month,
        operationYear: r.operation_year, syncMode: r.sync_mode as SyncMode,
        status: r.status, counters: r.counters ?? {},
        sheetsAnalyzed: r.sheets_analyzed ?? [], errorMessage: r.error_message,
        startedAt: r.started_at, finishedAt: r.finished_at, durationMs: r.duration_ms,
      }));
    },
    async getImport(id) {
      const { data, error } = await supabaseAdmin.from("mk9_imports")
        .select("preview").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: items, error: itErr } = await supabaseAdmin.from("mk9_import_items")
        .select("*").eq("import_id", id).limit(2000);
      if (itErr) throw itErr;
      const mappedItems: ImportItem[] = (items ?? []).map((r: any) => ({
        sheet: r.sheet, excelRow: r.excel_row, entityType: r.entity_type,
        action: r.action, payload: r.payload ?? {}, resolvedIds: r.resolved_ids ?? {},
        warnings: r.warnings ?? [],
      }));
      return { preview: (data.preview as unknown as ImportPreview) ?? null, items: mappedItems };

    },
  };
}
