import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeName } from "./mk9/normalization";
import { logAudit, requireMk9Role } from "@/lib/mk9-auth/require-role.server";

const promoterSchema = z
  .object({
    name: z.string().min(2).max(120),
    employeeNumber: z
      .string()
      .max(20)
      .transform((v) => v?.trim() || null)
      .nullable()
      .optional(),
    externalId: z.string().max(120).nullable().optional(),
    city: z.string().max(120).nullable().optional(),
    uf: z.string().length(2).nullable().optional(),
    contact: z.string().max(120).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    presenceTeamId: z.string().uuid().nullable().optional(),
    supervisorId: z.string().uuid().nullable().optional(),
    userId: z.string().uuid().nullable().optional(),

  })
  .strict();

export const mk9CreatePromoter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => promoterSchema.parse(data))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.employeeNumber) {
      const { data: existing } = await supabaseAdmin
        .from("mk9_promoters")
        .select("id")
        .eq("employee_number", data.employeeNumber)
        .maybeSingle();

      if (existing) {
        throw new Error("Já existe um promotor cadastrado com esta matrícula.");
      }
    }

    const { data: row, error } = await supabaseAdmin
      .from("mk9_promoters")
      .insert({
        name: data.name,
        name_normalized: normalizeName(data.name),
        employee_number: data.employeeNumber || null,
        external_id: data.externalId || null,
        city: data.city || null,
        uf: data.uf || null,
        contact: data.contact || null,
        notes: data.notes || null,
        presence_team_id: data.presenceTeamId || null,
        mk9_supervisor_id: data.supervisorId || null,
        user_id: data.userId || null,

        is_active: true,
      } as any)
      .select()
      .single();

    if (error) throw new Error(error.message);
    await logAudit(ctx, "PROMOTER_CREATED", "mk9_promoters", row?.id ?? null, { data });
    return row;
  });

export const mk9UpdatePromoter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      id: z.string().uuid(),
      data: promoterSchema,
      expectedUpdatedAt: z.string().optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.data.employeeNumber) {
      const { data: existing } = await supabaseAdmin
        .from("mk9_promoters")
        .select("id")
        .eq("employee_number", data.data.employeeNumber)
        .neq("id", data.id)
        .maybeSingle();

      if (existing) {
        throw new Error("Já existe um promotor cadastrado com esta matrícula.");
      }
    }

    const { data: old } = await supabaseAdmin
      .from("mk9_promoters")
      .select("employee_number")
      .eq("id", data.id)
      .single();

    let q = supabaseAdmin
      .from("mk9_promoters")
      .update({
        name: data.data.name,
        name_normalized: normalizeName(data.data.name),
        employee_number: data.data.employeeNumber || null,
        external_id: data.data.externalId || null,
        city: data.data.city || null,
        uf: data.data.uf || null,
        contact: data.data.contact || null,
        notes: data.data.notes || null,
        presence_team_id: data.data.presenceTeamId || null,
        mk9_supervisor_id: data.data.supervisorId || null,
        user_id: data.data.userId || null,

        updated_at: new Date().toISOString(),
        updated_by: ctx.userId,
      } as any)
      .eq("id", data.id);

    if (data.expectedUpdatedAt) {
      q = q.eq("updated_at", data.expectedUpdatedAt);
    }

    const { data: row, error } = await q.select().maybeSingle();
    if (error) throw new Error(error.message);
    
    await logAudit(ctx, "PROMOTER_UPDATED", "mk9_promoters", data.id, {
      data: data.data,
      previous_employee_number: old?.employee_number,
      new_employee_number: data.data.employeeNumber,
    });

    return row;
  });

export const mk9DeletePromoter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [visits, routes] = await Promise.all([
      supabaseAdmin.from("mk9_planned_visits").select("id", { count: "exact", head: true }).eq("promoter_id" as any, data.id),
      supabaseAdmin.from("mk9_planned_routes").select("id", { count: "exact", head: true }).eq("promoter_id" as any, data.id),
    ]);

    const totalVinculos = (visits.count ?? 0) + (routes.count ?? 0);
    const { data: promoter } = await supabaseAdmin.from("mk9_promoters").select("name, employee_number").eq("id", data.id).single();

    if (totalVinculos > 0) {
      const { error } = await supabaseAdmin
        .from("mk9_promoters")
        .update({
          is_active: false,
          archived_at: new Date().toISOString(),
          archived_by: ctx.userId,
          archive_reason: "DELETED_WITH_HISTORY",
          updated_at: new Date().toISOString(),
          updated_by: ctx.userId,
        } as any)
        .eq("id", data.id);

      if (error) throw new Error(error.message);
      await logAudit(ctx, "PROMOTER_DELETED_SOFT", "mk9_promoters", data.id, { name: promoter?.name, hasHistory: true });
      return { success: true, mode: "SOFT" };
    } else {
      const { error } = await supabaseAdmin.from("mk9_promoters").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit(ctx, "PROMOTER_DELETED_HARD", "mk9_promoters", data.id, { name: promoter?.name, hasHistory: false });
      return { success: true, mode: "HARD" };
    }
  });

export const mk9PromoterDeleteImpact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [routes, visits] = await Promise.all([
      supabaseAdmin.from("mk9_planned_routes").select("id", { count: "exact", head: true }).eq("promoter_id" as any, data.id),
      supabaseAdmin.from("mk9_planned_visits").select("id", { count: "exact", head: true }).eq("promoter_id" as any, data.id),
    ]);
    return { routes: routes.count ?? 0, visits: visits.count ?? 0 };
  });
