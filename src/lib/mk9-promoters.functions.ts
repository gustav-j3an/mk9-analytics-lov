import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMk9ReadScope } from "@/lib/mk9-auth/read-guards.server";

export const mk9GetPromoterAccessStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Verifica se tem user_id (acesso ao portal)
    const { data: promoter, error } = await supabaseAdmin
      .from("mk9_promoters")
      .select("user_id, name")
      .eq("id", data.id)
      .single();

    if (error || !promoter) return { hasUser: false, plannedVisits: 0, storesCount: 0 };

    // 2. Verifica se tem rota planejada (qualquer uma ativa)
    const { count, error: countErr } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select("*", { count: "exact", head: true })
      .eq("promoter_id", data.id)
      .is("deactivated_at", null);

    // 3. Conta lojas únicas na rota
    const { data: storesData } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select("store_id")
      .eq("promoter_id", data.id)
      .is("deactivated_at", null);

    const uniqueStores = new Set(storesData?.map(s => s.store_id) || []);

    return {
      hasUser: !!promoter.user_id,
      plannedVisits: count || 0,
      storesCount: uniqueStores.size
    };
  });

export const mk9ListPromotersWithStats = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      year: z.number().int(),
      month: z.number().int()
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Lista promotores básicos
    const { data: promoters, error } = await supabaseAdmin
      .from("mk9_promoters")
      .select("id, name, uf, user_id, isActive")
      .order("name");

    if (error) throw new Error(error.message);

    // TODO: Num cenário de alta escala, isso deveria ser uma View ou Cache
    // Para MK9 (centenas de promotores), o paralelismo do Bun/Cloudflare aguenta.
    const results = await Promise.all(
      promoters.map(async (p) => {
        // Obter stats de rota para a competência
        // Usamos mk9_planned_routes direto para velocidade na central
        const { count } = await supabaseAdmin
          .from("mk9_planned_routes")
          .select("*", { count: "exact", head: true })
          .eq("promoter_id", p.id)
          .is("deactivated_at", null);

        const { data: stores } = await supabaseAdmin
          .from("mk9_planned_routes")
          .select("store_id")
          .eq("promoter_id", p.id)
          .is("deactivated_at", null);

        return {
          ...p,
          plannedVisits: count || 0,
          uniqueStores: new Set(stores?.map(s => s.store_id) || []).size
        };
      })
    );

    return results;
  });
