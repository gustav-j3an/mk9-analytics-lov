/**
 * MK9 — Fase 1B.3: carregador central de frequências VERSIONADAS por período.
 *
 * Fonte de verdade das leituras migradas:
 *   public.mk9_industry_store_frequency_versions
 *
 * A projeção `mk9_industry_store_frequency` continua existindo, mas NÃO é mais
 * usada pelos consumidores migrados (Dashboard, Auditoria, Relatório da
 * Indústria/PDF e métricas contratuais do painel legado).
 *
 * SEGURANÇA (contrato permanente)
 *   - o client recebido já é autenticado (`context.supabase`) ou administrativo
 *     depois de um guard de papel; nunca há leitura anônima aqui;
 *   - o escopo resolvido no servidor é intersectado — filtros do navegador
 *     jamais ampliam o alcance;
 *   - sem `SELECT *`: apenas as colunas necessárias;
 *   - consulta em lote única (sem N+1), com filtro de vigência no banco.
 */
import type { FrequencySegmentInput } from "./segments";

/** Subconjunto estrutural do escopo resolvido no servidor (nunca vem do cliente). */
export interface FrequencyAccessScope {
  allowedIndustryIds?: string[] | null;
  allowedUfs?: string[] | null;
  allowedStoreIds?: string[] | null;
}


export interface FrequencyVersionSegment extends FrequencySegmentInput {
  industryId: string;
  storeId: string;
  sourceType: string;
  store: { id: string; name: string | null; chain: string | null; uf: string | null } | null;
}

/** Chave estável dos mapas: `${industryId}|${storeId}`. */
export const freqKey = (industryId: string, storeId: string) => `${industryId}|${storeId}`;

export interface LoadFrequencyVersionsParams {
  industryIds: string[];
  storeIds?: string[] | null;
  /** yyyy-mm-dd inclusive */
  periodStart: string;
  /** yyyy-mm-dd inclusive */
  periodEnd: string;
  accessScope?: FrequencyAccessScope | null;
}

/**
 * Devolve, em UMA consulta, todas as vigências que interceptam o período:
 *
 *   valid_from  <= periodEnd
 *   AND (valid_until IS NULL OR valid_until >= periodStart)
 *   AND archived_at IS NULL
 */
export async function loadFrequencyVersionsForPeriod(
  supabase: any,
  params: LoadFrequencyVersionsParams,
): Promise<Map<string, FrequencyVersionSegment[]>> {
  const out = new Map<string, FrequencyVersionSegment[]>();
  const access = params.accessScope ?? null;

  let industryIds = Array.from(new Set(params.industryIds.filter(Boolean)));
  if (access?.allowedIndustryIds) {
    industryIds = industryIds.filter((id) => access.allowedIndustryIds!.includes(id));
  }
  if (!industryIds.length) return out;

  let storeIds = params.storeIds ? Array.from(new Set(params.storeIds.filter(Boolean))) : null;
  if (access?.allowedStoreIds) {
    storeIds = storeIds
      ? storeIds.filter((id) => access.allowedStoreIds!.includes(id))
      : access.allowedStoreIds;
  }
  if (storeIds && storeIds.length === 0) return out;

  let q = supabase
    .from("mk9_industry_store_frequency_versions")
    .select(
      "industry_id, store_id, weekly_frequency, monthly_frequency, valid_from, valid_until, source_type, store:mk9_stores(id,name,chain,uf)",
    )
    .in("industry_id", industryIds)
    .is("archived_at", null)
    .lte("valid_from", params.periodEnd)
    .or(`valid_until.is.null,valid_until.gte.${params.periodStart}`)
    .limit(100000);
  if (storeIds) q = q.in("store_id", storeIds);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const allowedUfs = access?.allowedUfs ?? null;
  for (const r of (data ?? []) as any[]) {
    if (!r.industry_id || !r.store_id) continue;
    const uf = (r.store?.uf as string | null) ?? null;
    if (allowedUfs && !(uf && allowedUfs.includes(uf))) continue;
    const key = freqKey(r.industry_id, r.store_id);
    const list = out.get(key) ?? [];
    list.push({
      industryId: r.industry_id,
      storeId: r.store_id,
      sourceType: (r.source_type as string) ?? "IMPORT",
      validFrom: r.valid_from as string,
      validUntil: (r.valid_until as string | null) ?? null,
      weeklyFrequency: r.weekly_frequency === null ? null : Number(r.weekly_frequency),
      monthlyFrequency: r.monthly_frequency === null ? null : Number(r.monthly_frequency),
      store: r.store
        ? { id: r.store.id, name: r.store.name ?? null, chain: r.store.chain ?? null, uf }
        : null,
    });
    out.set(key, list);
  }

  for (const list of out.values()) list.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  return out;
}

/** Filtra os segmentos de uma chave para uma janela específica da indústria. */
export function segmentsForWindow(
  segments: FrequencyVersionSegment[] | undefined,
  windowStart: string,
  windowEnd: string,
): FrequencyVersionSegment[] {
  if (!segments?.length) return [];
  return segments.filter(
    (s) => s.validFrom <= windowEnd && (s.validUntil ?? "9999-12-31") >= windowStart,
  );
}
