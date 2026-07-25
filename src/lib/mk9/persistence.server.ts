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
        .gte("scheduled_date", first).lte("scheduled_date", last);
      if (error) throw error;
      return (data ?? []).map(mapVisit);
    },
    async upsertIndustries(records, importId) {
      if (!records.length) return [];
      const payload = records.map((r) => ({
        id: r.id, name: r.name, name_normalized: r.nameNormalized,
        monthly_contracted_frequency: r.monthlyContractedFrequency,
        monthly_estimated_frequency: r.monthlyEstimatedFrequency,
        frequency_difference: r.frequencyDifference,
        frequency_status: r.frequencyStatus,
        weeks_count: r.weeksCount,
        last_import_id: importId,
      }));
      const { data, error } = await supabaseAdmin
        .from("mk9_industries").upsert(payload, { onConflict: "name_normalized" }).select();
      if (error) throw error;
      return (data ?? []).map(mapIndustry);
    },
    async upsertStores(records, importId) {
      if (!records.length) return [];
      const payload = records.map((r) => ({
        id: r.id, chain: r.chain, name: r.name,
        name_normalized: r.nameNormalized, uf: r.uf, last_import_id: importId,
      }));
      const { data, error } = await supabaseAdmin
        .from("mk9_stores").upsert(payload, { onConflict: "name_normalized,uf" }).select();
      if (error) throw error;
      return (data ?? []).map(mapStore);
    },
    async upsertPromoters(records, importId) {
      if (!records.length) return [];
      // upsert por id quando existir; senão insert simples com dedup por name_normalized manual
      const withId = records.filter((r) => r.id);
      const withoutId = records.filter((r) => !r.id);
      const out: PromoterRecord[] = [];
      if (withId.length) {
        const { data, error } = await supabaseAdmin.from("mk9_promoters").upsert(
          withId.map((r) => ({
            id: r.id, external_id: r.externalId, name: r.name,
            name_normalized: r.nameNormalized, city: r.city,
            contact: r.contact, contact_normalized: r.contactNormalized,
            notes: r.notes, last_import_id: importId,
          })), { onConflict: "id" },
        ).select();
        if (error) throw error;
        out.push(...(data ?? []).map(mapPromoter));
      }
      if (withoutId.length) {
        const { data, error } = await supabaseAdmin.from("mk9_promoters").insert(
          withoutId.map((r) => ({
            external_id: r.externalId, name: r.name,
            name_normalized: r.nameNormalized, city: r.city,
            contact: r.contact, contact_normalized: r.contactNormalized,
            notes: r.notes, last_import_id: importId,
          })),
        ).select();
        if (error) throw error;
        out.push(...(data ?? []).map(mapPromoter));
      }
      return out;
    },
    async upsertPlannedRoutes(records, importId) {
      if (!records.length) return [];
      const { data, error } = await supabaseAdmin.from("mk9_planned_routes").upsert(
        records.map((r) => ({
          id: r.id, promoter_id: r.promoterId, store_id: r.storeId, industry_id: r.industryId,
          weekday: r.weekday, operation_month: r.operationMonth, operation_year: r.operationYear,
          source_sheet: r.sourceSheet, last_import_id: importId,
        })),
        { onConflict: "promoter_id,store_id,industry_id,weekday,operation_month,operation_year" },
      ).select();
      if (error) throw error;
      return (data ?? []).map(mapRoute);
    },
    async removePlannedRoutes(ids) {
      if (!ids.length) return;
      const { error } = await supabaseAdmin.from("mk9_planned_routes").delete().in("id", ids);
      if (error) throw error;
    },
    async upsertPlannedVisits(records, importId) {
      if (!records.length) return [];
      const { data, error } = await supabaseAdmin.from("mk9_planned_visits").upsert(
        records.map((r) => ({
          id: r.id, promoter_id: r.promoterId, store_id: r.storeId, industry_id: r.industryId,
          route_id: r.routeId ?? null, scheduled_date: r.scheduledDate,
          status: r.status, source_sheet: r.sourceSheet, last_import_id: importId,
        })),
        { onConflict: "promoter_id,store_id,industry_id,scheduled_date" },
      ).select();
      if (error) throw error;
      return (data ?? []).map(mapVisit);
    },
    async removeFuturePlannedVisits(ids) {
      if (!ids.length) return;
      // preserva as realizadas garantindo status=planned no filtro
      const { error } = await supabaseAdmin.from("mk9_planned_visits")
        .delete().in("id", ids).eq("status", "planned");
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
