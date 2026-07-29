// Motor da Auditoria de Execução MK9.
//
// FONTE DA VERDADE (Fase 1B.3)
//   contratadas = frequência VERSIONADA vigente na janela da indústria
//                 (mk9_industry_store_frequency_versions), somada por segmento
//                 de vigência em contractedVisitsForFrequencySegments.
//   executadas  = total bruto de checklist no período da indústria.
//   pendentes   = max(0, contratadas - executadas).
//   cobertura   = executadas / contratadas (limite 100%).
// Promotor responsável vem do roteiro planejado (mk9_planned_routes).
//
// A projeção mk9_industry_store_frequency NÃO é mais lida aqui.

import { loadPeriodConfig, resolveWindow, type PeriodWindow } from "@/lib/mk9-reports/period.server";
import { computeVisitMetrics, aggregateVisitMetrics } from "@/lib/mk9-reports/metrics";
import {
  contractedVisitsForFrequencySegments,
  describeFrequencySegments,
  type FrequencySegmentInput,
} from "@/lib/mk9-frequency/segments";
import { freqKey, loadFrequencyVersionsForPeriod } from "@/lib/mk9-frequency/versions.server";


export type ExecStatus = "COMPLETO" | "PARCIAL" | "NAO_REALIZADO";
export const EXEC_STATUS_LABEL: Record<ExecStatus, string> = {
  COMPLETO: "Completo",
  PARCIAL: "Parcial",
  NAO_REALIZADO: "Não realizado",
};

export type PromoterResolution = "MATCHED_ROUTE" | "AMBIGUOUS_ROUTE" | "UNASSIGNED_ROUTE";

export interface AuditStoreLine {
  storeId: string;
  storeName: string;
  chain: string | null;
  uf: string | null;
  industryId: string;
  industryName: string;
  promoterId: string | null;
  promoterName: string | null;
  promoterResolution: PromoterResolution;
  contratadas: number;
  realizadas: number;
  pendentes: number;
  coberturaPct: number;
  status: ExecStatus;
  weeklyFrequency: number | null;
  monthlyFrequency: number | null;
}

export interface AuditPromoterLine {
  promoterId: string | null;
  promoterName: string;
  storesCount: number;
  contratadas: number;
  realizadas: number;
  pendentes: number;
  coberturaPct: number;
}

export interface AuditIndustryLine {
  industryId: string;
  industryName: string;
  window: { startDate: string; endDate: string; totalDays: number };
  storesCount: number;
  contratadas: number;
  realizadas: number;
  pendentes: number;
  coberturaPct: number;
}

export interface AuditScope {
  year: number;
  month: number;
  industryId?: string | null;
  uf?: string | null;
  promoterId?: string | null;
  /** Escopo de acesso resolvido no servidor (Fase 0.2). Nunca vem do navegador. */
  access?: import("@/lib/mk9-auth/access-scope.server").Mk9AccessScope | null;
}


function contractedFromFrequency(weekly: number | null, monthly: number | null, totalDays: number): number {
  if (monthly != null && Number.isFinite(monthly) && monthly > 0) return Math.max(0, Math.round(monthly));
  if (weekly != null && Number.isFinite(weekly) && weekly > 0) {
    const days = Math.max(1, totalDays);
    return Math.max(0, Math.round(weekly * (days / 7)));
  }
  return 0;
}

function pickStatus(contratadas: number, realizadas: number): ExecStatus {
  if (contratadas === 0 && realizadas === 0) return "NAO_REALIZADO";
  const valid = Math.min(contratadas, realizadas);
  if (valid >= contratadas && contratadas > 0) return "COMPLETO";
  if (realizadas === 0) return "NAO_REALIZADO";
  return "PARCIAL";
}

interface IndustryContext {
  industryId: string;
  industryName: string;
  window: PeriodWindow;
  stores: AuditStoreLine[];
}

async function buildIndustryContext(
  supabase: any,
  industry: { id: string; name: string },
  year: number,
  month: number,
  uf: string | null,
  access?: AuditScope["access"],
): Promise<IndustryContext> {
  const allowedUfs = access?.allowedUfs ?? null;
  const allowedStoreIds = access?.allowedStoreIds ?? null;
  const inScope = (store: any, storeId: string) => {
    if (allowedStoreIds && !allowedStoreIds.includes(storeId)) return false;
    if (allowedUfs && !(store?.uf && allowedUfs.includes(store.uf))) return false;
    return true;
  };
  const cfg = await loadPeriodConfig(supabase, industry.id);
  const win = resolveWindow(cfg, year, month);


  // Frequência por loja
  const { data: freqs, error: eF } = await supabase
    .from("mk9_industry_store_frequency")
    .select("store_id, weekly_frequency, monthly_frequency, store:mk9_stores(id,name,chain,uf)")
    .eq("industry_id", industry.id)
    .limit(20000);
  if (eF) throw new Error(eF.message);

  // Visitas realizadas na janela
  const { data: actuals, error: eA } = await supabase
    .from("mk9_actual_visits")
    .select("store_id, scheduled_date, store:mk9_stores(id,name,chain,uf)")
    .eq("industry_id", industry.id)
    .gte("scheduled_date", win.startDate)
    .lte("scheduled_date", win.endDate)
    .limit(50000);
  if (eA) throw new Error(eA.message);

  // Promotor responsável por (loja, indústria): rotas com vigência que
  // intercepta o período. Se houver 1 promotor distinto → MATCHED,
  // 0 → UNASSIGNED, >1 → AMBIGUOUS. Majority vote decide o "vencedor"
  // exibido nas linhas ambíguas.
  const { data: routes, error: eR } = await supabase
    .from("mk9_planned_routes")
    .select("store_id, promoter_id, valid_from, valid_until, promoter:mk9_promoters(id,name)")
    .eq("industry_id", industry.id)
    .eq("is_active", true)
    .is("archived_at", null)
    .lte("valid_from", win.endDate)
    .or(`valid_until.is.null,valid_until.gte.${win.startDate}`)
    .limit(50000);
  if (eR) throw new Error(eR.message);

  const promoterVotes = new Map<string, Map<string, { name: string; count: number }>>();
  for (const r of routes ?? []) {
    if (!r.store_id || !r.promoter_id) continue;
    const inner = promoterVotes.get(r.store_id) ?? new Map();
    const cur = inner.get(r.promoter_id) ?? { name: r.promoter?.name ?? "—", count: 0 };
    cur.count += 1;
    inner.set(r.promoter_id, cur);
    promoterVotes.set(r.store_id, inner);
  }
  const promoterByStore = new Map<string, { id: string; name: string; distinct: number }>();
  for (const [sid, inner] of promoterVotes) {
    let best: { id: string; name: string; count: number } | null = null;
    for (const [pid, v] of inner) {
      if (!best || v.count > best.count) best = { id: pid, name: v.name, count: v.count };
    }
    if (best) promoterByStore.set(sid, { id: best.id, name: best.name, distinct: inner.size });
  }

  type Bucket = {
    storeId: string; storeName: string; chain: string | null; uf: string | null;
    weekly: number | null; monthly: number | null; actual: number;
  };
  const map = new Map<string, Bucket>();
  const touch = (id: string, s: any) => {
    let b = map.get(id);
    if (!b) {
      b = { storeId: id, storeName: s?.name ?? "—", chain: s?.chain ?? null, uf: s?.uf ?? null, weekly: null, monthly: null, actual: 0 };
      map.set(id, b);
    }
    return b;
  };
  for (const f of freqs ?? []) {
    if (!f.store_id) continue;
    if (uf && f.store?.uf !== uf) continue;
    if (!inScope(f.store, f.store_id)) continue;

    const b = touch(f.store_id, f.store);
    b.weekly = (f.weekly_frequency as number | null) ?? b.weekly;
    b.monthly = (f.monthly_frequency as number | null) ?? b.monthly;
  }
  for (const a of actuals ?? []) {
    if (!a.store_id) continue;
    if (uf && a.store?.uf !== uf) continue;
    if (!inScope(a.store, a.store_id)) continue;

    const b = touch(a.store_id, a.store);
    b.actual += 1;
  }

  const stores: AuditStoreLine[] = Array.from(map.values()).map((b) => {
    const contratadas = contractedFromFrequency(b.weekly, b.monthly, win.totalDays);
    const m = computeVisitMetrics({ contratadas, executadas: b.actual });
    const realizadas = m.executadas;
    const pendentes = Math.max(0, contratadas - realizadas);
    const coberturaPct = contratadas > 0 ? Math.min(100, Math.round((realizadas / contratadas) * 100)) : 0;
    const promo = promoterByStore.get(b.storeId);
    const resolution: PromoterResolution = !promo
      ? "UNASSIGNED_ROUTE"
      : promo.distinct > 1
        ? "AMBIGUOUS_ROUTE"
        : "MATCHED_ROUTE";
    return {
      storeId: b.storeId,
      storeName: b.storeName,
      chain: b.chain,
      uf: b.uf,
      industryId: industry.id,
      industryName: industry.name,
      promoterId: promo?.id ?? null,
      promoterName: promo?.name ?? null,
      promoterResolution: resolution,
      contratadas,
      realizadas,
      pendentes,
      coberturaPct,
      status: pickStatus(contratadas, realizadas),
      weeklyFrequency: b.weekly,
      monthlyFrequency: b.monthly,
    };
  });
  stores.sort((a, z) => a.storeName.localeCompare(z.storeName, "pt-BR"));
  return { industryId: industry.id, industryName: industry.name, window: win, stores };
}

async function loadIndustries(
  supabase: any,
  industryId: string | null | undefined,
  allowedIndustryIds?: string[] | null,
) {
  if (allowedIndustryIds?.length === 0) return [];
  if (industryId && allowedIndustryIds && !allowedIndustryIds.includes(industryId)) return [];
  let q = supabase.from("mk9_industries").select("id,name").order("name", { ascending: true });
  if (industryId) q = q.eq("id", industryId);
  else if (allowedIndustryIds) q = q.in("id", allowedIndustryIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ id: string; name: string }>;
}

export async function auditByStore(supabase: any, scope: AuditScope): Promise<{ stores: AuditStoreLine[]; totals: AuditIndustryLine[] }> {
  const access = scope.access ?? null;
  // Filtro do navegador nunca amplia escopo: UF pedida fora do escopo → vazio.
  if (scope.uf && access?.allowedUfs && !access.allowedUfs.includes(scope.uf.toUpperCase())) {
    return { stores: [], totals: [] };
  }
  if (scope.promoterId && access?.allowedPromoterIds && !access.allowedPromoterIds.includes(scope.promoterId)) {
    return { stores: [], totals: [] };
  }
  const industries = await loadIndustries(supabase, scope.industryId ?? null, access?.allowedIndustryIds ?? null);
  const contexts = await Promise.all(
    industries.map((ind) => buildIndustryContext(supabase, ind, scope.year, scope.month, scope.uf ?? null, access)),
  );
  const all: AuditStoreLine[] = [];
  const totals: AuditIndustryLine[] = [];
  for (const c of contexts) {
    let stores = c.stores;
    if (access?.allowedPromoterIds) {
      stores = stores.filter((s) => s.promoterId && access.allowedPromoterIds!.includes(s.promoterId));
    }

    if (scope.promoterId) stores = stores.filter((s) => s.promoterId === scope.promoterId);
    for (const s of stores) all.push(s);
    const agg = aggregateVisitMetrics(stores.map((s) => ({ contratadas: s.contratadas, executadas: s.realizadas })));
    const realizadas = agg.executadas;
    const contratadas = agg.contratadas;
    const pendentes = Math.max(0, contratadas - realizadas);
    const coberturaPct = contratadas > 0 ? Math.min(100, Math.round((realizadas / contratadas) * 100)) : 0;
    totals.push({
      industryId: c.industryId,
      industryName: c.industryName,
      window: { startDate: c.window.startDate, endDate: c.window.endDate, totalDays: c.window.totalDays },
      storesCount: stores.length,
      contratadas, realizadas, pendentes, coberturaPct,
    });
  }
  return { stores: all, totals };
}

export async function auditByPromoter(supabase: any, scope: AuditScope): Promise<AuditPromoterLine[]> {
  const { stores } = await auditByStore(supabase, scope);
  const map = new Map<string, { name: string; storesCount: number; contratadas: number; realizadas: number }>();
  for (const s of stores) {
    const key = s.promoterId ?? "__NONE__";
    const cur = map.get(key) ?? { name: s.promoterName ?? "Não atribuído", storesCount: 0, contratadas: 0, realizadas: 0 };
    cur.storesCount += 1;
    cur.contratadas += s.contratadas;
    cur.realizadas += s.realizadas;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([pid, v]) => {
      const pendentes = Math.max(0, v.contratadas - v.realizadas);
      const coberturaPct = v.contratadas > 0 ? Math.min(100, Math.round((v.realizadas / v.contratadas) * 100)) : 0;
      return {
        promoterId: pid === "__NONE__" ? null : pid,
        promoterName: v.name,
        storesCount: v.storesCount,
        contratadas: v.contratadas,
        realizadas: v.realizadas,
        pendentes,
        coberturaPct,
      };
    })
    .sort((a, b) => a.promoterName.localeCompare(b.promoterName, "pt-BR"));
}

export async function auditByIndustry(supabase: any, scope: AuditScope): Promise<AuditIndustryLine[]> {
  const { totals } = await auditByStore(supabase, scope);
  return totals.sort((a, b) => a.industryName.localeCompare(b.industryName, "pt-BR"));
}
