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
      .is("archived_at", null);

    const { data: storesData } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select("store_id")
      .eq("promoter_id", data.id)
      .is("archived_at", null);

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
      month: z.number().int(),
      referenceDate: z.string().optional()
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Buscar todos os promotores básicos
    const { data: promoters, error } = await supabaseAdmin
      .from("mk9_promoters")
      .select("id, name, uf, user_id, is_active, supervisor:mk9_supervisors(name)")
      .order("name");

    if (error) throw new Error(error.message);

    // 2. Buscar visitas planejadas (contagem global para o dashboard)
    const { data: routes } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select("id, promoter_id, store_id, weekday")
      .is("archived_at", null);

    // 3. Buscar evidências pendentes (contagem global)
    const { data: evidences } = await supabaseAdmin
      .from("mk9_visit_evidence")
      .select("id, promoter_id, status")
      .eq("status", "PENDING");

    // 4. Buscar visitas realizadas (actual_visits) no período
    // Usamos o primeiro e último dia do mês de referência
    const startDate = `${data.year}-${String(data.month).padStart(2, '0')}-01`;
    const endDate = new Date(data.year, data.month, 0).toISOString().split('T')[0];

    const { data: actualVisits } = await supabaseAdmin
      .from("mk9_actual_visits")
      .select("id, promoter_id")
      .gte("scheduled_date", startDate)
      .lte("scheduled_date", endDate);

    // 5. Consolidar estatísticas
    const results = promoters.map((p) => {
      const pRoutes = routes?.filter(r => r.promoter_id === p.id) || [];
      const pEvidences = evidences?.filter(e => e.promoter_id === p.id) || [];
      const pActuals = actualVisits?.filter(v => v.promoter_id === p.id) || [];
      
      const uniqueStores = new Set(pRoutes.map(r => r.store_id)).size;
      const plannedVisits = pRoutes.length;
      const realizedVisits = pActuals.length;
      const pendingEvidences = pEvidences.length;

      return {
        id: p.id,
        name: p.name,
        uf: p.uf,
        user_id: p.user_id,
        isActive: p.is_active,
        supervisorName: (p.supervisor as any)?.name || "Sem Supervisor",
        plannedVisits,
        realizedVisits,
        pendingVisits: Math.max(0, plannedVisits - realizedVisits),
        pendingEvidences,
        uniqueStores
      };
    });

    return results;
  });

export const mk9GetPromoterOperationalRoute = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      promoterId: z.string().uuid(),
      referenceDate: z.string()
    }).parse(data)
  )
  .handler(async ({ data }) => {
    await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Determinar o período semanal baseado na referenceDate
    const ref = new Date(data.referenceDate + "T12:00:00Z");
    const dayOfWeek = ref.getDay();
    const diff = ref.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(ref.setDate(diff)).toISOString().split('T')[0];
    const sunday = new Date(ref.setDate(diff + 6)).toISOString().split('T')[0];

    // 1. Rota Planejada Vigente
    const { data: routes } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select("id, store_id, industry_id, weekday, store:mk9_stores(name, uf, chain), industry:mk9_industries(name)")
      .eq("promoter_id", data.promoterId)
      .is("archived_at", null)
      .lte("valid_from", data.referenceDate)
      .or(`valid_until.is.null,valid_until.gte.${data.referenceDate}`);

    // 2. Evidências no período da semana
    const { data: evidences } = await supabaseAdmin
      .from("mk9_visit_evidence")
      .select("id, store_id, industry_id, status, captured_at")
      .eq("promoter_id", data.promoterId)
      .gte("captured_at", monday)
      .lte("captured_at", sunday + "T23:59:59Z");

    // 3. Visitas Realizadas no período
    const { data: actuals } = await supabaseAdmin
      .from("mk9_actual_visits")
      .select("id, store_id, industry_id, scheduled_date")
      .eq("promoter_id", data.promoterId)
      .gte("scheduled_date", monday)
      .lte("scheduled_date", sunday);

    // Mapear matriz (industry|store)
    const matrix = new Map();

    routes?.forEach(r => {
      const key = `${r.industry_id}|${r.store_id}`;
      if (!matrix.has(key)) {
        matrix.set(key, {
          industryName: (r.industry as any).name,
          storeName: (r.store as any).name,
          storeChain: (r.store as any).chain,
          uf: (r.store as any).uf,
          days: {}
        });
      }
      
      // Status do dia r.weekday
      // Lógica de derivação de status conforme regra 9 do plano
      let status = "PROGRAMADA";
      
      // Encontrar evidência para este dia/combinação
      // Nota: A captura_at pode ser usada para bater o dia da semana
      const evidence = evidences?.find(e => {
        const eDate = new Date(e.captured_at);
        const eWeekday = eDate.getDay();
        return e.store_id === r.store_id && e.industry_id === r.industry_id && eWeekday === r.weekday;
      });

      const actual = actuals?.find(a => {
        const aDate = new Date(a.scheduled_date + "T12:00:00Z");
        const aWeekday = aDate.getDay();
        return a.store_id === r.store_id && a.industry_id === r.industry_id && aWeekday === r.weekday;
      });

      if (actual) status = "APROVADA";
      else if (evidence) {
        if (evidence.status === "PENDING") status = "EVIDÊNCIA ENVIADA";
        else if (evidence.status === "REJECTED") status = "REJEITADA";
      }

      matrix.get(key).days[r.weekday] = status;
    });

    return Array.from(matrix.values());
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
