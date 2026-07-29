// Roteiro versionado MK9.
// Fonte da verdade para "quem visita o quê" — versionada por vigência
// (valid_from/valid_until). Alterações NUNCA reescrevem histórico:
// a versão anterior é fechada e uma nova é criada a partir da data escolhida.
//
// Regras de conflito são impostas pelo trigger mk9_check_route_overlap:
// mesma (store, industry, weekday) não pode ter promotores diferentes com
// intervalos que se sobreponham (mesma rota do mesmo promotor é idempotente).
//
// Frequência (semanal/mensal) é gerenciada em mk9_industry_store_frequency
// e permanece independente do roteiro.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logAudit, requireMk9Role } from "@/lib/mk9-auth/require-role.server";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato AAAA-MM-DD");

// ---------------------------------------------------------------------------
// LISTAGEM AGRUPADA — Promotor → Dia → Loja → Indústrias, filtrada por vigência
// ---------------------------------------------------------------------------
export const mk9RoutesListVersioned = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      referenceDate: isoDate.optional(),
      promoterId: z.string().uuid().optional(),
      industryId: z.string().uuid().optional(),
      storeId: z.string().uuid().optional(),
      uf: z.string().length(2).optional(),
      weekday: z.number().int().min(0).max(6).optional(),
      includeInactive: z.boolean().optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { industryFilter, ufFilter, storeFilter, promoterFilter } = await import(
      "@/lib/mk9-auth/access-scope.server"
    );
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ref = data.referenceDate ?? new Date().toISOString().slice(0, 10);

    const ind = industryFilter(scope, data.industryId ?? null);
    const store = storeFilter(scope, data.storeId ?? null);
    const promoter = promoterFilter(scope, data.promoterId ?? null);
    const ufs = ufFilter(scope, data.uf ?? null);
    if (ind.outOfScope || store.outOfScope || promoter.outOfScope || ufs.outOfScope) return [];
    if (ind.ids?.length === 0 || store.ids?.length === 0 || ufs.ids?.length === 0) return [];

    let q = supabaseAdmin
      .from("mk9_planned_routes")
      .select(
        "id, weekday, valid_from, valid_until, is_active, archived_at, source_sheet, promoter:mk9_promoters(id,name), store:mk9_stores(id,name,chain,uf), industry:mk9_industries(id,name)",
      )
      .is("archived_at", null)
      .lte("valid_from", ref)
      .or(`valid_until.is.null,valid_until.gte.${ref}`);

    if (!data.includeInactive) q = q.eq("is_active", true);
    if (promoter.ids) q = q.in("promoter_id", promoter.ids);
    if (ind.ids) q = q.in("industry_id", ind.ids);
    if (store.ids) q = q.in("store_id", store.ids);
    if (typeof data.weekday === "number") q = q.eq("weekday", data.weekday);

    const { data: rows, error } = await q.limit(20000);
    if (error) throw new Error(error.message);

    return (rows ?? [])
      .filter((r: any) => !ufs.ids || (r.store?.uf && ufs.ids.includes(r.store.uf)))

      .map((r: any) => ({
        id: r.id as string,
        weekday: r.weekday as number,
        validFrom: r.valid_from as string,
        validUntil: (r.valid_until as string | null) ?? null,
        isActive: r.is_active as boolean,
        sourceSheet: (r.source_sheet as string | null) ?? null,
        promoterId: r.promoter?.id ?? null,
        promoterName: r.promoter?.name ?? "—",
        storeId: r.store?.id ?? null,
        storeName: r.store?.name ?? "—",
        storeChain: r.store?.chain ?? null,
        storeUf: r.store?.uf ?? null,
        industryId: r.industry?.id ?? null,
        industryName: r.industry?.name ?? "—",
      }));
  });

// ---------------------------------------------------------------------------
// HISTÓRICO — todas as versões de uma obrigação (store+industry+weekday)
// ---------------------------------------------------------------------------
export const mk9RoutesListHistory = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      storeId: z.string().uuid(),
      industryId: z.string().uuid(),
      weekday: z.number().int().min(0).max(6),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { assertIndustryAllowed, storeFilter } = await import("@/lib/mk9-auth/access-scope.server");
    const { scope } = await requireMk9ReadScope();
    assertIndustryAllowed(scope, data.industryId);
    if (storeFilter(scope, data.storeId).outOfScope) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select(
        "id, weekday, valid_from, valid_until, is_active, archived_at, promoter:mk9_promoters(id,name)",
      )
      .eq("store_id", data.storeId)
      .eq("industry_id", data.industryId)
      .eq("weekday", data.weekday)
      .order("valid_from", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      validFrom: r.valid_from as string,
      validUntil: (r.valid_until as string | null) ?? null,
      isActive: r.is_active as boolean,
      archivedAt: (r.archived_at as string | null) ?? null,
      promoterId: r.promoter?.id ?? null,
      promoterName: r.promoter?.name ?? "—",
    }));
  });

// ---------------------------------------------------------------------------
// UPSERT VERSIONADO — cria nova versão a partir de uma data escolhida
//   - Se `id` foi enviado (edição): fecha a versão atual (valid_until = validFrom - 1 dia)
//     e cria uma nova linha começando em validFrom.
//   - Se `id` é nulo (criação): apenas insere.
// ---------------------------------------------------------------------------
export const mk9RoutesUpsertItem = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      promoterId: z.string().uuid(),
      storeId: z.string().uuid(),
      industryId: z.string().uuid(),
      weekday: z.number().int().min(0).max(6),
      validFrom: isoDate,
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN", "SUPERVISOR"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const validFrom = data.validFrom;
    const dayBefore = new Date(validFrom + "T00:00:00Z");
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
    const closeAt = dayBefore.toISOString().slice(0, 10);

    // 1) Se é edição, fecha a versão anterior.
    if (data.id) {
      const { data: prev, error: pErr } = await supabaseAdmin
        .from("mk9_planned_routes")
        .select("id, valid_from, valid_until, is_active")
        .eq("id", data.id)
        .maybeSingle();
      if (pErr) throw new Error(pErr.message);
      if (!prev) throw new Error("Rota original não encontrada.");
      if (prev.valid_from >= validFrom) {
        throw new Error(
          `A nova vigência (${validFrom}) precisa ser posterior à vigência atual (${prev.valid_from}).`,
        );
      }
      const { error: uErr } = await supabaseAdmin
        .from("mk9_planned_routes")
        .update({ valid_until: closeAt, updated_by: ctx.userId })
        .eq("id", data.id);
      if (uErr) throw new Error(uErr.message);
    }

    // 2) Descobre operation_month/year da nova vigência (compat com importador legado).
    const [y, m] = validFrom.split("-").map(Number);

    // 3) Insere a nova versão. Trigger anti-sobreposição bloqueia conflito de outro promotor.
    const { data: inserted, error: iErr } = await supabaseAdmin
      .from("mk9_planned_routes")
      .insert({
        promoter_id: data.promoterId,
        store_id: data.storeId,
        industry_id: data.industryId,
        weekday: data.weekday,
        operation_month: m,
        operation_year: y,
        source_sheet: "edicao_manual",
        valid_from: validFrom,
        valid_until: null,
        is_active: true,
        created_by: ctx.userId,
        updated_by: ctx.userId,
        source_type: "MANUAL",
        last_manual_edit_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (iErr) {
      // Traduz MK9_ROUTE_OVERLAP em payload rico para a UI destacar o conflito.
      const msg = iErr.message || "";
      const match = msg.match(
        /MK9_ROUTE_OVERLAP\s+conflict_id=([\w-]+)\s+conflict_promoter=([\w-]+)\s+conflict_from=(\S+)\s+conflict_until=(\S+)/,
      );
      if (match) {
        const [, cId, cPromoter, cFrom, cUntil] = match;
        const { data: prow } = await supabaseAdmin
          .from("mk9_promoters").select("name").eq("id", cPromoter).maybeSingle();
        throw new Error(
          `CONFLITO_VIGENCIA::${JSON.stringify({
            conflictRouteId: cId,
            conflictPromoterId: cPromoter,
            conflictPromoterName: prow?.name ?? "—",
            conflictFrom: cFrom,
            conflictUntil: cUntil,
          })}`,
        );
      }
      throw new Error(iErr.message);
    }

    await logAudit(ctx, "mk9_routes.upsert", "mk9_planned_routes", inserted?.id ?? null, {
      previousId: data.id ?? null,
      validFrom,
      promoterId: data.promoterId,
      storeId: data.storeId,
      industryId: data.industryId,
      weekday: data.weekday,
    });

    return { id: inserted?.id as string, validFrom };
  });

// ---------------------------------------------------------------------------
// DESATIVAR — fecha vigência (valid_until = ontem) e is_active=false.
// ---------------------------------------------------------------------------
export const mk9RoutesDeactivate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      id: z.string().uuid(),
      validUntil: isoDate,
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN", "SUPERVISOR"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("mk9_planned_routes")
      .update({ valid_until: data.validUntil, is_active: false, updated_by: ctx.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(ctx, "mk9_routes.deactivate", "mk9_planned_routes", data.id, {
      validUntil: data.validUntil,
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// SET FREQUÊNCIA — atualiza mk9_industry_store_frequency
// ---------------------------------------------------------------------------
export const mk9RoutesSetFrequency = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      industryId: z.string().uuid(),
      storeId: z.string().uuid(),
      weeklyFrequency: z.number().nullable().optional(),
      monthlyFrequency: z.number().nullable().optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN", "SUPERVISOR"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("mk9_industry_store_frequency")
      .select("id")
      .eq("industry_id", data.industryId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    const payload = {
      industry_id: data.industryId,
      store_id: data.storeId,
      weekly_frequency: data.weeklyFrequency ?? null,
      monthly_frequency: data.monthlyFrequency ?? null,
    };
    if (existing) {
      const { error } = await supabaseAdmin
        .from("mk9_industry_store_frequency")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("mk9_industry_store_frequency").insert(payload);
      if (error) throw new Error(error.message);
    }
    await logAudit(ctx, "mk9_routes.set_frequency", "mk9_industry_store_frequency", null, payload);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// RESOLVER PROMOTOR NA EXECUÇÃO — para uma visita real (loja+indústria+data)
//   Retorna:
//     - status: MATCHED_ROUTE | AMBIGUOUS_ROUTE | UNASSIGNED_ROUTE
//     - promotor responsável (só quando MATCHED)
//     - dia previsto/realizado + aderência
// ---------------------------------------------------------------------------
export const mk9RoutesResolvePromoter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      storeId: z.string().uuid(),
      industryId: z.string().uuid(),
      visitDate: isoDate,
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireMk9Read } = await import("@/lib/mk9-auth/read-guards.server");
    await requireMk9Read();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any).rpc("mk9_resolve_route_promoter", {
      _store_id: data.storeId,
      _industry_id: data.industryId,
      _on_date: data.visitDate,
    });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{
      route_id: string; promoter_id: string; weekday: number;
      valid_from: string; valid_until: string | null; match_count: number;
    }>;

    const weekdayRealized = new Date(data.visitDate + "T00:00:00Z").getUTCDay();

    if (!list.length) {
      return { status: "UNASSIGNED_ROUTE" as const, weekdayRealized, candidates: [] };
    }

    // Prioriza candidatos que casam com o dia da semana da execução.
    const sameDay = list.filter((c) => c.weekday === weekdayRealized);
    const pool = sameDay.length > 0 ? sameDay : list;
    const distinctPromoters = new Set(pool.map((c) => c.promoter_id));

    if (distinctPromoters.size > 1) {
      return {
        status: "AMBIGUOUS_ROUTE" as const,
        weekdayRealized,
        candidates: pool.map((c) => ({
          routeId: c.route_id, promoterId: c.promoter_id, weekday: c.weekday,
          validFrom: c.valid_from, validUntil: c.valid_until,
        })),
      };
    }
    const winner = pool[0];
    return {
      status: "MATCHED_ROUTE" as const,
      routeId: winner.route_id,
      promoterId: winner.promoter_id,
      weekdayScheduled: winner.weekday,
      weekdayRealized,
      adherentToDay: winner.weekday === weekdayRealized,
      validFrom: winner.valid_from,
      validUntil: winner.valid_until,
    };
  });

// ---------------------------------------------------------------------------
// BUSCA ASSÍNCRONA DE LOJAS — autocomplete leve
// Não carrega tudo: só é chamada quando o usuário digita ≥ 2 caracteres.
// Retorna no máximo 20 resultados por consulta, ordenados por nome.
// ---------------------------------------------------------------------------
// ESTRATÉGIA (Fase 0.2): cliente administrativo controlado — autentica,
// resolve escopo e aplica restrição explícita de UF/loja em toda consulta.
export const mk9StoresSearch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ q: z.string().min(2).max(80) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Normaliza a consulta (minúsculas, sem acentos, sem pontuação) para
    // bater com mk9_stores.name_normalized (indexado com trigram).
    const normalized = data.q
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[-–—/,.()·|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (normalized.length < 2) return { total: 0, items: [] };
    if (scope.allowedUfs?.length === 0 || scope.allowedStoreIds?.length === 0) {
      return { total: 0, items: [] };
    }

    const like = `%${normalized}%`;
    const uf = normalized.length === 2 ? normalized.toUpperCase() : null;

    const orExpr = [
      `name_normalized.ilike.${like}`,
      `chain.ilike.${like}`,
      uf ? `uf.eq.${uf}` : null,
    ]
      .filter(Boolean)
      .join(",");

    let q = supabaseAdmin
      .from("mk9_stores")
      .select("id, name, chain, uf", { count: "exact" })
      .or(orExpr);
    // Escopo do servidor (nunca ampliado pelo cliente).
    if (scope.allowedUfs) q = q.in("uf", scope.allowedUfs);
    if (scope.allowedStoreIds) q = q.in("id", scope.allowedStoreIds);

    const { data: rows, error, count } = await q.order("name", { ascending: true }).limit(20);

    if (error) throw new Error(error.message);
    return {
      total: count ?? 0,
      items: (rows ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        chain: (r.chain as string | null) ?? null,
        uf: (r.uf as string | null) ?? null,
      })),
    };
  });

// Busca uma loja específica pelo id — usado quando o modal abre em modo
// edição e precisamos exibir a loja selecionada sem carregar a lista toda.
export const mk9StoreGet = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (scope.allowedStoreIds && !scope.allowedStoreIds.includes(data.id)) return null;
    const { data: row, error } = await supabaseAdmin
      .from("mk9_stores")
      .select("id, name, chain, uf")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const uf = (row.uf as string | null) ?? null;
    if (scope.allowedUfs && (!uf || !scope.allowedUfs.includes(uf))) return null;
    return {
      id: row.id as string,
      name: row.name as string,
      chain: (row.chain as string | null) ?? null,
      uf,
    };
  });


