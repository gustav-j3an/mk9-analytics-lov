import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMk9ReadScope } from "@/lib/mk9-auth/read-guards.server";
import { requireMk9Role } from "@/lib/mk9-auth/require-role.server";

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

    const { data: promoter, error } = await supabaseAdmin
      .from("mk9_promoters")
      .select("user_id, name")
      .eq("id", data.id)
      .single();

    if (error || !promoter) return { hasUser: false, plannedVisits: 0, storesCount: 0, email: null, isActive: false, month: new Date().getMonth() + 1, year: new Date().getFullYear() };

    let email = null;
    let isActive = false;
    if (promoter.user_id) {
       const { data: profile } = await supabaseAdmin.from("mk9_profiles").select("email, active").eq("user_id", promoter.user_id).single();
       email = profile?.email;
       isActive = !!profile?.active;
    }

    const { count } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select("*", { count: "exact", head: true })
      .eq("promoter_id", data.id)
      .is("deactivated_at", null);

    const { data: storesData } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select("store_id")
      .eq("promoter_id", data.id)
      .is("deactivated_at", null);

    const uniqueStores = new Set(storesData?.map(s => s.store_id) || []);

    return {
      hasUser: !!promoter.user_id,
      plannedVisits: count || 0,
      storesCount: uniqueStores.size,
      email,
      isActive,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
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

    const { data: promoters, error } = await supabaseAdmin
      .from("mk9_promoters")
      .select("id, name, uf, user_id, is_active")
      .order("name");

    if (error) throw new Error(error.message);

    const results = await Promise.all(
      promoters.map(async (p) => {
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
          id: p.id,
          name: p.name,
          uf: p.uf,
          user_id: p.user_id,
          isActive: p.is_active,
          plannedVisits: count || 0,
          uniqueStores: new Set(stores?.map(s => s.store_id) || []).size
        };
      })
    );

    return results;
  });

export const mk9CreatePromoter = createServerFn({ method: "POST" })
  .inputValidator((data: any) => z.any().parse(data))
  .handler(async ({ data }) => {
    await requireMk9Role(["ADMIN", "SUPERVISOR"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("mk9_promoters")
      .insert({
        name: data.name,
        name_normalized: data.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        city: data.city,
        uf: data.uf,
        contact: data.contact,
        notes: data.notes,
        external_id: data.externalId,
        employee_number: data.employeeNumber,
        presence_team_id: data.presenceTeamId,
        supervisor_id: data.supervisorId,
        user_id: data.userId,
        is_active: true
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const mk9UpdatePromoter = createServerFn({ method: "POST" })
  .inputValidator((data: any) => z.any().parse(data))
  .handler(async ({ data }) => {
    await requireMk9Role(["ADMIN", "SUPERVISOR"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("mk9_promoters")
      .update({
        name: data.data.name,
        name_normalized: data.data.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        city: data.data.city,
        uf: data.data.uf,
        contact: data.data.contact,
        notes: data.data.notes,
        external_id: data.data.externalId,
        employee_number: data.data.employeeNumber,
        presence_team_id: data.data.presenceTeamId,
        supervisor_id: data.data.supervisorId,
        user_id: data.data.userId,
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const mk9DeletePromoter = createServerFn({ method: "POST" })
  .inputValidator((data: any) => z.any().parse(data))
  .handler(async ({ data }) => {
    await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("mk9_promoters")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { mode: "HARD" };
  });

export const mk9PromoterDeleteImpact = createServerFn({ method: "POST" })
  .inputValidator((data: any) => z.any().parse(data))
  .handler(async ({ data }) => {
    await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count: routes } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select("*", { count: "exact", head: true })
      .eq("promoter_id", data.id);
    
    // Simplificando visits para resolver erro TS (core.server demoraria muito aqui)
    const { count: visits } = await supabaseAdmin
      .from("mk9_actual_visits")
      .select("*", { count: "exact", head: true })
      .eq("promoter_id", data.id);

    return { routesCount: routes || 0, visitsCount: visits || 0 };
  });
