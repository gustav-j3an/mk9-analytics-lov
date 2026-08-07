import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeName } from "./mk9/normalization";
import { logAudit, requireMk9Role } from "@/lib/mk9-auth/require-role.server";

const promoterSchema = z.object({
  name: z.string().min(2).max(120),
  externalId: z.string().max(120).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  uf: z.string().length(2).nullable().optional(),
  contact: z.string().max(120).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
}).strict();

export const mk9CreatePromoter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => promoterSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("mk9_promoters")
      .insert({
        name: data.name,
        name_normalized: normalizeName(data.name),
        external_id: data.externalId || null,
        city: data.city || null,
        uf: data.uf || null,
        contact: data.contact || null,
        notes: data.notes || null,
        is_active: true,
      } as any)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const mk9UpdatePromoter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    id: z.string().uuid(),
    data: promoterSchema
  }).parse(data))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("mk9_promoters")
      .update({
        name: data.data.name,
        name_normalized: normalizeName(data.data.name),
        external_id: data.data.externalId || null,
        city: data.data.city || null,
        uf: data.data.uf || null,
        contact: data.data.contact || null,
        notes: data.data.notes || null,
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId,
      } as any)
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Nenhum registro foi atualizado (PROMOTER_NOT_FOUND).");

    await logAudit(ctx, "PROMOTER_UPDATED", "mk9_promoters", data.id, { data: data.data });

    return row;
  });

export const mk9ArchivePromoter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    id: z.string().uuid(),
    reason: z.string().max(500).nullable().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("mk9_promoters")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: ctx.userId,
        archive_reason: data.reason || null,
        is_active: false,
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId,
      } as any)
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Falha ao arquivar promotor.");

    await logAudit(ctx, "PROMOTER_ARCHIVED", "mk9_promoters", data.id, { reason: data.reason });

    return row;
  });

export const mk9ReactivatePromoter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    id: z.string().uuid(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("mk9_promoters")
      .update({
        archived_at: null,
        archived_by: null,
        archive_reason: null,
        is_active: true,
        updated_at: new Date().toISOString(),
        updated_by: (await requireMk9Role(["ADMIN"])).userId,
      } as any)
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Falha ao reativar promotor.");

    const ctx = await requireMk9Role(["ADMIN"]);
    await logAudit(ctx, "PROMOTER_REACTIVATED", "mk9_promoters", data.id, {});

    return row;
  });

export const mk9PromoterArchiveImpact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [routes, visits] = await Promise.all([
      supabaseAdmin
        .from("mk9_planned_routes")
        .select("id", { count: "exact", head: true })
        .eq("promoter_id", data.id)
        .eq("is_active", true)
        .is("archived_at", null),
      supabaseAdmin
        .from("mk9_planned_visits")
        .select("id", { count: "exact", head: true })
        .eq("promoter_id", data.id),
    ]);

    return {
      activeRoutes: routes.count ?? 0,
      visits: visits.count ?? 0,
    };
  });


