/**
 * MK9 — Server functions da gestão manual de frequências contratadas (Etapas 3 a 5).
 *
 * Segurança (contrato permanente):
 *  - toda escrita exige requireMk9Role(["ADMIN"]);
 *  - leitura exige papel e é revalidada pelo escopo do servidor (UF/indústria/loja);
 *  - actor_id vem SEMPRE da sessão;
 *  - Zod .strict() em todos os payloads;
 *  - concorrência validada dentro da transação da RPC (não em JavaScript);
 *  - fonte única: mk9_industry_store_frequency_versions. A projeção
 *    mk9_industry_store_frequency é atualizada apenas pelo trigger oficial.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  closeFrequencySchema,
  frequencyHistorySchema,
  frequencyRpcMessage,
  listFrequenciesSchema,
  setFrequencySchema,
  checkFrequencyCombination,
  isRetroactiveChange,
} from "./mk9-frequency/admin";

const todayIso = () => new Date().toISOString().slice(0, 10);

type ScopeShape = {
  allowedIndustryIds?: string[] | null;
  allowedUfs?: string[] | null;
  allowedStoreIds?: string[] | null;
};

function assertIndustryInScope(scope: ScopeShape, industryId: string) {
  if (scope.allowedIndustryIds && !scope.allowedIndustryIds.includes(industryId)) {
    throw new Error("Indústria fora do seu escopo de acesso.");
  }
}

const mapRow = (r: any) => ({
  id: r.id as string,
  industryId: r.industry_id as string,
  storeId: r.store_id as string,
  storeName: (r.store?.name ?? null) as string | null,
  chain: (r.store?.chain ?? null) as string | null,
  uf: (r.store?.uf ?? null) as string | null,
  weeklyFrequency: r.weekly_frequency === null ? null : Number(r.weekly_frequency),
  monthlyFrequency: r.monthly_frequency === null ? null : Number(r.monthly_frequency),
  validFrom: r.valid_from as string,
  validUntil: (r.valid_until ?? null) as string | null,
  sourceType: (r.source_type ?? "IMPORT") as string,
  sourceImportId: (r.source_import_id ?? null) as string | null,
  notes: (r.notes ?? null) as string | null,
  updatedAt: r.updated_at as string,
  updatedBy: (r.updated_by ?? null) as string | null,
  createdAt: r.created_at as string,
});

const SELECT_COLS =
  "id, industry_id, store_id, weekly_frequency, monthly_frequency, valid_from, valid_until, source_type, source_import_id, notes, created_at, updated_at, updated_by, store:mk9_stores(id,name,chain,uf)";

// ---------------------------------------------------------------------------
// LISTAGEM PAGINADA — direto da tabela versionada
// ---------------------------------------------------------------------------
export const mk9ListIndustryFrequencies = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => listFrequenciesSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    assertIndustryInScope(scope as ScopeShape, data.industryId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const today = todayIso();
    let q = supabaseAdmin
      .from("mk9_industry_store_frequency_versions")
      .select(SELECT_COLS, { count: "exact" })
      .eq("industry_id", data.industryId)
      .is("archived_at", null);

    if (data.source !== "all") q = q.eq("source_type", data.source);
    if (data.status === "future") q = q.gt("valid_from", today);
    if (data.status === "ended") q = q.lt("valid_until", today);
    if (data.status === "current") {
      q = q.lte("valid_from", today).or(`valid_until.is.null,valid_until.gte.${today}`);
    }

    // Escopo do servidor: restringe as lojas visíveis (nunca amplia).
    const s = scope as ScopeShape;
    if (s.allowedStoreIds) {
      if (!s.allowedStoreIds.length) return { total: 0, page: data.page, items: [] };
      q = q.in("store_id", s.allowedStoreIds);
    }

    const from = (data.page - 1) * data.pageSize;
    const {
      data: rows,
      error,
      count,
    } = await q.order("valid_from", { ascending: false }).range(from, from + data.pageSize - 1);
    if (error) throw new Error("Não foi possível carregar as frequências.");

    let items = (rows ?? []).map(mapRow);
    if (s.allowedUfs) items = items.filter((i) => i.uf && s.allowedUfs!.includes(i.uf));
    if (data.uf) items = items.filter((i) => i.uf === data.uf!.toUpperCase());
    if (data.search) {
      const needle = data.search.toLowerCase();
      items = items.filter((i) =>
        `${i.storeName ?? ""} ${i.chain ?? ""}`.toLowerCase().includes(needle),
      );
    }

    return { total: count ?? items.length, page: data.page, items };
  });

// ---------------------------------------------------------------------------
// HISTÓRICO por indústria + loja (inclui versões arquivadas)
// ---------------------------------------------------------------------------
export const mk9IndustryFrequencyHistory = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => frequencyHistorySchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const s = scope as ScopeShape;
    assertIndustryInScope(s, data.industryId);
    if (s.allowedStoreIds && !s.allowedStoreIds.includes(data.storeId)) {
      throw new Error("Loja fora do seu escopo de acesso.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("mk9_industry_store_frequency_versions")
      .select(`${SELECT_COLS}, archived_at`)
      .eq("industry_id", data.industryId)
      .eq("store_id", data.storeId)
      .order("valid_from", { ascending: false })
      .limit(200);
    if (error) throw new Error("Não foi possível carregar o histórico.");
    return (rows ?? []).map((r: any) => ({
      ...mapRow(r),
      archivedAt: (r.archived_at ?? null) as string | null,
    }));
  });

// ---------------------------------------------------------------------------
// CRIAR / EDITAR A PARTIR DE UMA DATA
// ---------------------------------------------------------------------------
export const mk9SetIndustryFrequency = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => setFrequencySchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role, logAudit } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const today = todayIso();

    const combination = checkFrequencyCombination(data.weeklyFrequency, data.monthlyFrequency, {
      confirmed: data.confirmInconsistent,
      reason: data.reason ?? null,
    });
    if (!combination.ok) {
      return {
        status: "needs_confirmation" as const,
        warning: combination.warning,
        needsJustification: combination.needsJustification,
      };
    }

    const retroactive = isRetroactiveChange(data.effectiveDate, today);
    if (retroactive && (!data.confirmRetroactive || (data.reason ?? "").trim().length < 3)) {
      return {
        status: "needs_retroactive_confirmation" as const,
        warning:
          "A data informada pertence a uma competência encerrada. Confirme e justifique a alteração retroativa.",
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc(
      "mk9_admin_frequency_set" as any,
      {
        _industry_id: data.industryId,
        _store_id: data.storeId,
        _weekly: data.weeklyFrequency,
        _monthly: data.monthlyFrequency,
        _effective_date: data.effectiveDate,
        _reason: data.reason ?? null,
        _actor: ctx.userId,
        _expected_updated_at: data.expectedUpdatedAt,
        _allow_retroactive: data.confirmRetroactive,
      } as any,
    );
    if (error) {
      throw new Error(frequencyRpcMessage(error.message, "Não foi possível salvar a frequência."));
    }

    const payload = (result ?? {}) as any;
    await logAudit(
      ctx,
      retroactive ? "RETROACTIVE_CHANGE" : "FREQUENCY_SET",
      "mk9_industry_store_frequency_versions",
      (payload.version_id ?? null) as string | null,
      {
        industryId: data.industryId,
        storeId: data.storeId,
        weekly: data.weeklyFrequency,
        monthly: data.monthlyFrequency,
        effectiveDate: data.effectiveDate,
        closedVersionId: payload.closed_version_id ?? null,
        retroactive,
        reason: data.reason ?? null,
      },
    );

    return {
      status: "saved" as const,
      versionId: (payload.version_id ?? null) as string | null,
      closedVersionId: (payload.closed_version_id ?? null) as string | null,
      retroactive,
    };
  });

// ---------------------------------------------------------------------------
// ENCERRAR VIGÊNCIA
// ---------------------------------------------------------------------------
export const mk9CloseIndustryFrequency = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => closeFrequencySchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role, logAudit } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current, error: readErr } = await supabaseAdmin
      .from("mk9_industry_store_frequency_versions")
      .select("id, industry_id, store_id")
      .eq("id", data.versionId)
      .maybeSingle();
    if (readErr || !current) throw new Error("Frequência não encontrada.");

    const { error } = await supabaseAdmin.rpc(
      "mk9_admin_frequency_close" as any,
      {
        _version_id: data.versionId,
        _end_date: data.endDate,
        _reason: data.reason,
        _actor: ctx.userId,
        _expected_updated_at: data.expectedUpdatedAt,
      } as any,
    );
    if (error) {
      throw new Error(
        frequencyRpcMessage(error.message, "Não foi possível encerrar a frequência."),
      );
    }

    // Alerta (não bloqueia): rota vigente após o encerramento.
    const { count: activeRoutes } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select("id", { count: "exact", head: true })
      .eq("industry_id", (current as any).industry_id)
      .eq("store_id", (current as any).store_id)
      .eq("is_active", true)
      .is("archived_at", null);

    await logAudit(
      ctx,
      "FREQUENCY_CLOSE",
      "mk9_industry_store_frequency_versions",
      data.versionId,
      { endDate: data.endDate, reason: data.reason, activeRoutes: activeRoutes ?? 0 },
    );

    return { status: "closed" as const, activeRoutes: activeRoutes ?? 0 };
  });

// ---------------------------------------------------------------------------
// Vigência atual em uma data — usada pelo formulário para obter expectedUpdatedAt
// ---------------------------------------------------------------------------
export const mk9FrequencyCurrentVersion = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        industryId: z.string().uuid(),
        storeId: z.string().uuid(),
        onDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .strict()
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const s = scope as ScopeShape;
    assertIndustryInScope(s, data.industryId);
    if (s.allowedStoreIds && !s.allowedStoreIds.includes(data.storeId)) {
      throw new Error("Loja fora do seu escopo de acesso.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("mk9_industry_store_frequency_versions")
      .select("id, weekly_frequency, monthly_frequency, valid_from, valid_until, updated_at")
      .eq("industry_id", data.industryId)
      .eq("store_id", data.storeId)
      .is("archived_at", null)
      .lte("valid_from", data.onDate)
      .or(`valid_until.is.null,valid_until.gte.${data.onDate}`)
      .order("valid_from", { ascending: false })
      .limit(1);
    if (error) throw new Error("Não foi possível validar a vigência atual.");
    const row = (rows ?? [])[0] as any;
    if (!row) return null;
    return {
      id: row.id as string,
      weeklyFrequency: row.weekly_frequency === null ? null : Number(row.weekly_frequency),
      monthlyFrequency: row.monthly_frequency === null ? null : Number(row.monthly_frequency),
      validFrom: row.valid_from as string,
      validUntil: (row.valid_until ?? null) as string | null,
      updatedAt: row.updated_at as string,
    };
  });
