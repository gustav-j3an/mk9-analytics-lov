import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeName } from "./mk9/normalization";

const storeSchema = z.object({
  name: z.string().min(2).max(120),
  chain: z.string().max(120).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  uf: z.string().length(2).nullable().optional(),
  channel: z.string().max(120).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

export const mk9CreateStore = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => storeSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("mk9_stores")
      .insert({
        name: data.name,
        name_normalized: normalizeName(data.name),
        chain: data.chain || null,
        uf: data.uf || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        notes: data.city ? `Cidade: ${data.city}` : null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const mk9UpdateStore = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        data: storeSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("mk9_stores")
      .update({
        name: data.data.name,
        name_normalized: normalizeName(data.data.name),
        chain: data.data.chain || null,
        uf: data.data.uf || null,
        latitude: data.data.latitude || null,
        longitude: data.data.longitude || null,
        notes: data.data.city ? `Cidade: ${data.data.city}` : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const mk9ArchiveStore = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reason: z.string().max(500).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("mk9_stores")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: ctx.userId,
        archive_reason: data.reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const mk9ReactivateStore = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("mk9_stores")
      .update({
        archived_at: null,
        archived_by: null,
        archive_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const mk9StoreArchiveImpact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [freq, routes, visits] = await Promise.all([
      supabaseAdmin
        .from("mk9_industry_store_frequency_versions")
        .select("id", { count: "exact", head: true })
        .eq("store_id", data.id)
        .is("valid_until", null)
        .is("archived_at", null),
      supabaseAdmin
        .from("mk9_planned_routes")
        .select("id", { count: "exact", head: true })
        .eq("store_id", data.id)
        .eq("is_active", true)
        .is("archived_at", null),
      supabaseAdmin
        .from("mk9_actual_visits")
        .select("id", { count: "exact", head: true })
        .eq("store_id", data.id),
    ]);

    return {
      activeFrequencies: freq.count ?? 0,
      activeRoutes: routes.count ?? 0,
      visits: visits.count ?? 0,
    };
  });
