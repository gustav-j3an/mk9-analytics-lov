import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeName } from "./mk9/normalization";

const storeSchema = z.object({
  name: z.string().min(2).max(120),
  chain: z.string().max(120).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  uf: z.string().length(2).nullable().optional(),
  channel: z.string().max(120).nullable().optional(),
});

export const mk9CreateStore = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => storeSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("mk9_stores")
      .insert({
        name: data.name,
        name_normalized: normalizeName(data.name),
        chain: data.chain || null,
        city: data.city || null,
        uf: data.uf || null,
        channel: data.channel || null,
        source_type: "MANUAL",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const mk9UpdateStore = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    id: z.string().uuid(),
    data: storeSchema
  }).parse(data))
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
        city: data.data.city || null,
        uf: data.data.uf || null,
        channel: data.data.channel || null,
      })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });
