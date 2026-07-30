/**
 * MK9 — Server functions do cadastro em lote de frequências e da conferência
 * "total contratado × total distribuído".
 *
 * CONTRATO DE SEGURANÇA
 *  - toda escrita exige requireMk9Role(["ADMIN"]);
 *  - o actor_id vem SEMPRE da sessão;
 *  - a seleção de lojas enviada pelo navegador NUNCA é confiada: o servidor
 *    reconstrói a consulta a partir dos critérios e reclassifica cada loja;
 *  - a prévia é recalculada no servidor imediatamente antes de aplicar;
 *  - a aplicação roda em UMA RPC transacional (falha em qualquer loja = rollback);
 *  - o total distribuído usa só `contractedVisitsForFrequencySegments`;
 *  - a projeção nunca é escrita diretamente (trigger oficial cuida disso);
 *  - erros são sanitizados antes de chegarem ao navegador.
 */
import { createServerFn } from "@tanstack/react-start";

import {
  acceptDivergenceSchema,
  bulkApplySchema,
  bulkPreviewSchema,
  bulkRpcItems,
  classifyBulkStore,
  computeStoreDistribution,
  contractSummarySchema,
  contractTotalSchema,
  countBulkPreview,
  evaluateContract,
  groupDistribution,
  BULK_ERROR_MESSAGES,
  type BulkStoreState,
} from "./mk9-frequency/bulk";
import { frequencyRpcMessage } from "./mk9-frequency/admin";
import type { FrequencySegmentInput } from "./mk9-frequency/segments";

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

function rpcMessage(raw: string | null | undefined, fallback: string): string {
  const text = raw ?? "";
  for (const [code, message] of Object.entries(BULK_ERROR_MESSAGES)) {
    if (text.includes(code)) return message;
  }
  return frequencyRpcMessage(text, fallback);
}

// ---------------------------------------------------------------------------
// Carregadores internos (servidor)
// ---------------------------------------------------------------------------
interface StoreRow {
  id: string;
  name: string | null;
  chain: string | null;
  uf: string | null;
}

async function resolvePeriod(supabase: any, industryId: string, year: number, month: number) {
  const { loadPeriodConfig, resolveWindow } = await import("@/lib/mk9-reports/period.server");
  const config = await loadPeriodConfig(supabase, industryId);
  const win = resolveWindow(config, year, month);
  return { start: win.startDate, end: win.endDate };
}

/**
 * Lojas vinculadas à indústria = lojas com vigência de frequência (qualquer data)
 * OU com roteiro ativo para a indústria. Reconstruído sempre no servidor.
 */
async function loadLinkedStores(
  supabase: any,
  industryId: string,
  scope: ScopeShape,
): Promise<StoreRow[]> {
  const ids = new Set<string>();

  const { data: freqRows, error: freqErr } = await supabase
    .from("mk9_industry_store_frequency_versions")
    .select("store_id")
    .eq("industry_id", industryId)
    .is("archived_at", null)
    .limit(100000);
  if (freqErr) throw new Error("Não foi possível carregar as lojas da indústria.");
  for (const r of freqRows ?? []) if (r.store_id) ids.add(r.store_id as string);

  const { data: routeRows, error: routeErr } = await supabase
    .from("mk9_planned_routes")
    .select("store_id")
    .eq("industry_id", industryId)
    .eq("is_active", true)
    .is("archived_at", null)
    .limit(100000);
  if (routeErr) throw new Error("Não foi possível carregar as lojas da indústria.");
  for (const r of routeRows ?? []) if (r.store_id) ids.add(r.store_id as string);

  let list = Array.from(ids);
  if (scope.allowedStoreIds) list = list.filter((id) => scope.allowedStoreIds!.includes(id));
  if (!list.length) return [];

  const out: StoreRow[] = [];
  for (let i = 0; i < list.length; i += 500) {
    const { data, error } = await supabase
      .from("mk9_stores")
      .select("id, name, chain, uf")
      .in("id", list.slice(i, i + 500));
    if (error) throw new Error("Não foi possível carregar as lojas da indústria.");
    for (const r of data ?? []) {
      out.push({ id: r.id, name: r.name ?? null, chain: r.chain ?? null, uf: r.uf ?? null });
    }
  }
  const allowedUfs = scope.allowedUfs ?? null;
  return out
    .filter((s) => !allowedUfs || (s.uf && allowedUfs.includes(s.uf)))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}

/** Todas as vigências não arquivadas da indústria, agrupadas por loja. */
async function loadAllVersions(supabase: any, industryId: string) {
  const { data, error } = await supabase
    .from("mk9_industry_store_frequency_versions")
    .select(
      "id, store_id, weekly_frequency, monthly_frequency, valid_from, valid_until, source_type, updated_at",
    )
    .eq("industry_id", industryId)
    .is("archived_at", null)
    .limit(100000);
  if (error) throw new Error("Não foi possível carregar as frequências da indústria.");
  const map = new Map<string, any[]>();
  for (const r of data ?? []) {
    const list = map.get(r.store_id) ?? [];
    list.push({
      id: r.id as string,
      weeklyFrequency: r.weekly_frequency === null ? null : Number(r.weekly_frequency),
      monthlyFrequency: r.monthly_frequency === null ? null : Number(r.monthly_frequency),
      validFrom: r.valid_from as string,
      validUntil: (r.valid_until ?? null) as string | null,
      sourceType: (r.source_type ?? "IMPORT") as string,
      updatedAt: r.updated_at as string,
    });
    map.set(r.store_id, list);
  }
  for (const l of map.values()) l.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  return map;
}

async function loadContractTotal(supabase: any, industryId: string, year: number, month: number) {
  const { data, error } = await supabase
    .from("mk9_industry_contract_totals")
    .select("id, contracted_total, notes, updated_at, source_type, period_start, period_end")
    .eq("industry_id", industryId)
    .eq("competence_year", year)
    .eq("competence_month", month)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar o total contratado.");
  if (!data) return null;
  return {
    id: data.id as string,
    contractedTotal: Number(data.contracted_total),
    notes: (data.notes ?? null) as string | null,
    updatedAt: data.updated_at as string,
    sourceType: (data.source_type ?? "MANUAL") as string,
  };
}

// ---------------------------------------------------------------------------
// RESUMO CONTRATO × DISTRIBUIÇÃO
// ---------------------------------------------------------------------------
export const mk9IndustryContractSummary = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contractSummarySchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    assertIndustryInScope(scope as ScopeShape, data.industryId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const period = await resolvePeriod(
      supabaseAdmin,
      data.industryId,
      data.competenceYear,
      data.competenceMonth,
    );
    const stores = await loadLinkedStores(supabaseAdmin, data.industryId, scope as ScopeShape);
    const versions = await loadAllVersions(supabaseAdmin, data.industryId);

    const rows = computeStoreDistribution(
      stores.map((s) => ({
        storeId: s.id,
        storeName: s.name,
        chain: s.chain,
        uf: s.uf,
        segments: (versions.get(s.id) ?? []).filter(
          (v: any) => v.validFrom <= period.end && (v.validUntil ?? "9999-12-31") >= period.start,
        ) as FrequencySegmentInput[],
      })),
      period,
    );

    const contract = await loadContractTotal(
      supabaseAdmin,
      data.industryId,
      data.competenceYear,
      data.competenceMonth,
    );
    const check = evaluateContract({
      contractedTotal: contract?.contractedTotal ?? null,
      rows,
    });

    return {
      period,
      check,
      groups: groupDistribution(rows),
      contract: contract
        ? { id: contract.id, notes: contract.notes, updatedAt: contract.updatedAt, sourceType: contract.sourceType }
        : null,
      totalStores: rows.length,
    };
  });

// ---------------------------------------------------------------------------
// TOTAL CONTRATADO (registro versionado)
// ---------------------------------------------------------------------------
export const mk9SetIndustryContractTotal = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contractTotalSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role, logAudit } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const period = await resolvePeriod(
      supabaseAdmin,
      data.industryId,
      data.competenceYear,
      data.competenceMonth,
    );

    const { data: result, error } = await supabaseAdmin.rpc("mk9_admin_contract_total_set" as any, {
      _industry_id: data.industryId,
      _month: data.competenceMonth,
      _year: data.competenceYear,
      _total: data.contractedTotal,
      _period_start: period.start,
      _period_end: period.end,
      _notes: data.notes,
      _actor: ctx.userId,
      _expected_updated_at: data.expectedUpdatedAt,
    } as any);
    if (error) {
      throw new Error(rpcMessage(error.message, "Não foi possível salvar o total contratado."));
    }

    await logAudit(ctx, "CONTRACT_TOTAL_SET", "mk9_industry_contract_totals", (result as any)?.id ?? null, {
      industryId: data.industryId,
      competence: { month: data.competenceMonth, year: data.competenceYear },
      contractedTotal: data.contractedTotal,
      notes: data.notes,
    });

    return { status: "saved" as const, id: ((result as any)?.id ?? null) as string | null };
  });

// ---------------------------------------------------------------------------
// PRÉVIA DO LOTE — sempre calculada no servidor
// ---------------------------------------------------------------------------
async function buildPreview(input: any, scope: ScopeShape, supabaseAdmin: any) {
  const period = await resolvePeriod(
    supabaseAdmin,
    input.industryId,
    input.competenceYear,
    input.competenceMonth,
  );
  const allStores = await loadLinkedStores(supabaseAdmin, input.industryId, scope);
  const versions = await loadAllVersions(supabaseAdmin, input.industryId);

  const sel = input.selection;
  const needle = (sel.search ?? "").toLowerCase();
  const selected = new Set<string>(sel.storeIds ?? []);

  const filtered = allStores.filter((s) => {
    if (sel.uf && s.uf !== sel.uf.toUpperCase()) return false;
    if (sel.chain && (s.chain ?? "").toLowerCase() !== sel.chain.toLowerCase()) return false;
    if (needle && !`${s.name ?? ""} ${s.chain ?? ""}`.toLowerCase().includes(needle)) return false;
    if (sel.scope === "SELECTED" && !selected.has(s.id)) return false;
    if (sel.scope === "WITHOUT_FREQUENCY") {
      const cur = (versions.get(s.id) ?? []).find(
        (v: any) => v.validFrom <= input.effectiveDate && (v.validUntil ?? "9999-12-31") >= input.effectiveDate,
      );
      if (cur) return false;
    }
    return true;
  });

  const states: BulkStoreState[] = filtered.map((s) => {
    const list = versions.get(s.id) ?? [];
    const current =
      list.find(
        (v: any) => v.validFrom <= input.effectiveDate && (v.validUntil ?? "9999-12-31") >= input.effectiveDate,
      ) ?? null;
    return {
      storeId: s.id,
      storeName: s.name,
      chain: s.chain,
      uf: s.uf,
      current,
      hasFutureVersion: list.some((v: any) => v.validFrom > input.effectiveDate),
      explicitlySelected: sel.scope === "SELECTED" ? selected.has(s.id) : true,
    };
  });

  const items = states.map((st) =>
    classifyBulkStore(st, {
      weeklyFrequency: input.weeklyFrequency,
      monthlyFrequency: input.monthlyFrequency,
      mode: input.mode,
      forceManualConflicts: input.forceManualConflicts === true,
      forceFutureConflicts: input.forceFutureConflicts === true,
    }),
  );

  // Totais antes/depois — o "depois" simula as vigências que serão criadas.
  const distributionInput = allStores.map((s) => ({
    storeId: s.id,
    storeName: s.name,
    chain: s.chain,
    uf: s.uf,
    segments: (versions.get(s.id) ?? []).filter(
      (v: any) => v.validFrom <= period.end && (v.validUntil ?? "9999-12-31") >= period.start,
    ) as FrequencySegmentInput[],
  }));
  const before = computeStoreDistribution(distributionInput, period);

  const willWrite = new Map(
    items
      .filter((i) => i.kind === "NEW_FREQUENCY" || i.kind === "CHANGED_FREQUENCY")
      .map((i) => [i.storeId, i]),
  );
  const after = computeStoreDistribution(
    distributionInput.map((s) => {
      const w = willWrite.get(s.storeId);
      if (!w) return s;
      const kept = s.segments
        .filter((seg) => seg.validFrom < input.effectiveDate)
        .map((seg) => ({
          ...seg,
          validUntil:
            seg.validUntil && seg.validUntil < input.effectiveDate
              ? seg.validUntil
              : shiftDay(input.effectiveDate, -1),
        }));
      return {
        ...s,
        segments: [
          ...kept,
          {
            validFrom: input.effectiveDate,
            validUntil: null,
            weeklyFrequency: input.weeklyFrequency,
            monthlyFrequency: input.monthlyFrequency,
          },
        ],
      };
    }),
    period,
  );

  const contract = await loadContractTotal(
    supabaseAdmin,
    input.industryId,
    input.competenceYear,
    input.competenceMonth,
  );
  const contractedTotal = contract?.contractedTotal ?? null;

  return {
    period,
    counters: countBulkPreview(items),
    items: items.slice(0, 300),
    truncated: items.length > 300,
    distributedBefore: evaluateContract({ contractedTotal, rows: before }),
    distributedAfter: evaluateContract({ contractedTotal, rows: after }),
    rpcItems: bulkRpcItems(items, input.effectiveDate),
  };
}

function shiftDay(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export const mk9BulkFrequencyPreview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bulkPreviewSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    assertIndustryInScope(scope as ScopeShape, data.industryId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const preview = await buildPreview(data, scope as ScopeShape, supabaseAdmin);
    const { rpcItems, ...rest } = preview;
    return rest;
  });

// ---------------------------------------------------------------------------
// APLICAÇÃO EM LOTE — transacional
// ---------------------------------------------------------------------------
export const mk9BulkFrequencyApply = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bulkApplySchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role, logAudit } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    assertIndustryInScope(scope as ScopeShape, data.industryId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const retroactive = data.effectiveDate < `${todayIso().slice(0, 7)}-01`;
    if (retroactive && !data.confirmRetroactive) {
      return {
        status: "needs_retroactive_confirmation" as const,
        warning:
          "A data informada pertence a uma competência encerrada. Confirme e justifique a alteração retroativa.",
      };
    }

    // Prévia RECALCULADA no servidor imediatamente antes de gravar.
    const preview = await buildPreview(data, scope as ScopeShape, supabaseAdmin);
    if (!preview.rpcItems.length) {
      return { status: "nothing_to_do" as const, counters: preview.counters };
    }

    const { data: result, error } = await supabaseAdmin.rpc("mk9_admin_frequency_bulk_apply" as any, {
      _industry_id: data.industryId,
      _items: preview.rpcItems,
      _actor: ctx.userId,
      _reason: data.reason,
      _allow_retroactive: data.confirmRetroactive,
    } as any);
    if (error) {
      throw new Error(rpcMessage(error.message, "Não foi possível aplicar as frequências em lote."));
    }

    await logAudit(ctx, "FREQUENCY_BULK_APPLY", "mk9_industry_store_frequency_versions", null, {
      industryId: data.industryId,
      mode: data.mode,
      effectiveDate: data.effectiveDate,
      weekly: data.weeklyFrequency,
      monthly: data.monthlyFrequency,
      counters: preview.counters,
      applied: (result as any)?.applied ?? 0,
      retroactive,
      reason: data.reason,
      selection: data.selection.scope,
    });

    return {
      status: "applied" as const,
      applied: ((result as any)?.applied ?? 0) as number,
      counters: preview.counters,
      distributedAfter: preview.distributedAfter,
    };
  });

// ---------------------------------------------------------------------------
// ACEITAR DIVERGÊNCIA (apenas registra decisão + audit log)
// ---------------------------------------------------------------------------
export const mk9AcceptContractDivergence = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => acceptDivergenceSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role, logAudit } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    await logAudit(ctx, "CONTRACT_DIVERGENCE_ACCEPTED", "mk9_industry_contract_totals", data.industryId, {
      competence: { month: data.competenceMonth, year: data.competenceYear },
      contractedTotal: data.contractedTotal,
      distributedTotal: data.distributedTotal,
      difference: data.distributedTotal - data.contractedTotal,
      reason: data.reason,
    });
    return { status: "accepted" as const };
  });
