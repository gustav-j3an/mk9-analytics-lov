/**
 * MK9 — Server functions da gestão administrativa de indústrias (Etapas 1 e 2).
 *
 * Segurança:
 *  - toda escrita exige requireMk9Role(["ADMIN"]);
 *  - actor_id vem sempre da sessão (nunca do payload);
 *  - payload validado com Zod .strict() — metadados administrativos são recusados;
 *  - a concorrência (expected_updated_at) é validada dentro da própria transação da RPC;
 *  - as RPCs são SECURITY DEFINER com EXECUTE revogado de PUBLIC/anon/authenticated.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  archiveIndustrySchema,
  createIndustrySchema,
  industryRpcMessage,
  reactivateIndustrySchema,
  updateIndustrySchema,
  deleteIndustrySchema,
} from "./mk9-industries/admin";


/** Nomes semelhantes exibidos antes de criar — sem criar nada. */
export const mk9SearchSimilarIndustries = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    return z.object({ name: z.string().min(1).max(120) }).strict().parse(data);
  })
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);
    const { findSimilarIndustries } = await import("@/lib/mk9-checklist/industry-admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("mk9_industries")
      .select("id, name, name_normalized, requires_checklist");
    if (error) throw new Error("Não foi possível validar o nome da indústria.");
    return findSimilarIndustries(
      data.name,
      (rows ?? []).map((r: any) => ({
        id: r.id as string,
        name: r.name as string,
        nameNormalized: r.name_normalized as string,
        requiresChecklist: r.requires_checklist === true,
      })),
    );
  });

export const mk9CreateIndustry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createIndustrySchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { decideIndustryCreation } = await import("@/lib/mk9-checklist/industry-admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: listErr } = await supabaseAdmin
      .from("mk9_industries")
      .select("id, name, name_normalized, requires_checklist");
    if (listErr) throw new Error("Não foi possível validar o nome da indústria.");

    const decision = decideIndustryCreation(
      data.name,
      (existing ?? []).map((r: any) => ({
        id: r.id as string,
        name: r.name as string,
        nameNormalized: r.name_normalized as string,
        requiresChecklist: r.requires_checklist === true,
      })),
      { confirmed: data.confirmed },
    );
    if (decision.kind === "duplicate") return { status: "duplicate" as const, match: decision.match };
    if (decision.kind === "needs_confirmation")
      return { status: "candidates" as const, candidates: decision.candidates };

    const { data: rows, error } = await supabaseAdmin.rpc("mk9_admin_create_industry" as any, {
      p_name: decision.name,
      p_name_normalized: decision.nameNormalized,
      p_display_name: data.displayName ?? null,
      p_notes: data.notes ?? null,
      p_requires_checklist: data.requiresChecklist,
      p_period_type: data.periodType,
      p_start_day: data.periodType === "CUSTOM_CYCLE" ? (data.startDay ?? 1) : null,
      p_end_day: data.periodType === "CUSTOM_CYCLE" ? (data.endDay ?? 31) : null,
      p_uses_previous_month: data.usesPreviousMonth ?? false,
      p_actor: ctx.userId,
    } as any);
    if (error) throw new Error(industryRpcMessage(error.message, "Não foi possível cadastrar a indústria."));

    const row = Array.isArray(rows) ? (rows[0] as any) : (rows as any);
    return {
      status: "created" as const,
      industry: {
        id: row?.id as string,
        name: row?.name as string,
        requiresChecklist: row?.requires_checklist === true,
        updatedAt: (row?.updated_at ?? null) as string | null,
      },
    };
  });

export const mk9UpdateIndustry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateIndustrySchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { normalizeName } = await import("@/lib/mk9/normalization");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("mk9_admin_update_industry" as any, {
      p_industry_id: data.industryId,
      p_expected_updated_at: data.expectedUpdatedAt,
      p_name: data.name,
      p_name_normalized: normalizeName(data.name),
      p_display_name: data.displayName ?? null,
      p_notes: data.notes ?? null,
      p_requires_checklist: data.requiresChecklist ?? null,
      p_actor: ctx.userId,
    } as any);
    if (error) throw new Error(industryRpcMessage(error.message, "Não foi possível salvar o cadastro."));
    const row = Array.isArray(rows) ? (rows[0] as any) : (rows as any);
    return {
      ok: true as const,
      industryId: data.industryId,
      name: (row?.name ?? null) as string | null,
      updatedAt: (row?.updated_at ?? null) as string | null,
    };
  });

export const mk9ArchiveIndustry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => archiveIndustrySchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("mk9_admin_archive_industry" as any, {
      p_industry_id: data.industryId,
      p_expected_updated_at: data.expectedUpdatedAt,
      p_reason: data.reason ?? null,
      p_actor: ctx.userId,
    } as any);
    if (error) throw new Error(industryRpcMessage(error.message, "Não foi possível arquivar a indústria."));
    const row = Array.isArray(rows) ? (rows[0] as any) : (rows as any);
    return { ok: true as const, archivedAt: (row?.archived_at ?? null) as string | null };
  });

export const mk9ReactivateIndustry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reactivateIndustrySchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("mk9_admin_reactivate_industry" as any, {
      p_industry_id: data.industryId,
      p_expected_updated_at: data.expectedUpdatedAt,
      p_actor: ctx.userId,
    } as any);
    if (error) throw new Error(industryRpcMessage(error.message, "Não foi possível reativar a indústria."));
    const row = Array.isArray(rows) ? (rows[0] as any) : (rows as any);
    return { ok: true as const, updatedAt: (row?.updated_at ?? null) as string | null };
  });

/**
 * Impacto antes do arquivamento: quantas frequências vigentes, rotas ativas e
 * visitas a indústria possui. Somente leitura — nada é alterado.
 */
export const mk9IndustryArchiveImpact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    return z.object({ industryId: z.string().uuid() }).strict().parse(data);
  })
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [freq, routes, visits] = await Promise.all([
      supabaseAdmin
        .from("mk9_industry_store_frequency_versions")
        .select("id", { count: "exact", head: true })
        .eq("industry_id", data.industryId)
        .is("valid_until", null)
        .is("archived_at", null),
      supabaseAdmin
        .from("mk9_planned_routes")
        .select("id", { count: "exact", head: true })
        .eq("industry_id", data.industryId)
        .eq("is_active", true)
        .is("archived_at", null),
      supabaseAdmin
        .from("mk9_actual_visits")
        .select("id", { count: "exact", head: true })
        .eq("industry_id", data.industryId),
    ]);
    return {
      activeFrequencies: freq.count ?? 0,
      activeRoutes: routes.count ?? 0,
      visits: visits.count ?? 0,
    };
  });
