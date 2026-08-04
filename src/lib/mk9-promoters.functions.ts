import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const promoterSchema = z.object({
  name: z.string().min(2).max(120),
  externalId: z.string().max(120).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  uf: z.string().length(2).nullable().optional(),
  contact: z.string().max(120).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const mk9CreatePromoter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => promoterSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("mk9_promoters")
      .insert({
        name: data.name,
        external_id: data.externalId || null,
        city: data.city || null,
        uf: data.uf || null,
        contact: data.contact || null,
        notes: data.notes || null,
      })
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
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("mk9_promoters")
      .update({
        name: data.data.name,
        external_id: data.data.externalId || null,
        city: data.data.city || null,
        uf: data.data.uf || null,
        contact: data.data.contact || null,
        notes: data.data.notes || null,
      })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });
