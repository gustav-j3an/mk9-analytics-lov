/**
 * MK9 — Fase 2B.2: carregadores compartilhados dos detectores do MVP.
 *
 * CONTRATO DE SEGURANÇA (Fase 0):
 *  - o escopo já vem resolvido no servidor e é aplicado NA CONSULTA;
 *  - nada de `SELECT *`: apenas as colunas necessárias;
 *  - consultas em lote (sem N+1) e com limite explícito;
 *  - nenhuma PII (contato, observação, telefone) é carregada aqui.
 */
import type { Mk9AccessScope } from "@/lib/mk9-auth/access-scope.server";
import { calendarWindow } from "../rules/competence";

export interface ScopedIndustry {
  id: string;
  name: string;
}

export interface ScopedStore {
  id: string;
  name: string;
  chain: string | null;
  uf: string | null;
  isIncomplete: boolean;
}

export interface PeriodWindowLite {
  startDate: string;
  endDate: string;
}

const MAX_ROWS = 20000;

export async function loadScopedIndustries(
  supabase: any,
  scope: Mk9AccessScope,
): Promise<ScopedIndustry[]> {
  let q = supabase.from("mk9_industries").select("id, name").order("name").limit(2000);
  if (scope.allowedIndustryIds) {
    if (!scope.allowedIndustryIds.length) return [];
    q = q.in("id", scope.allowedIndustryIds);
  }
  const { data, error } = await q;
  if (error) throw new Error("MK9_DQ_DETECTOR_FAILED");
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name ?? "" }));
}

export async function loadScopedStores(
  supabase: any,
  scope: Mk9AccessScope,
): Promise<ScopedStore[]> {
  let q = supabase
    .from("mk9_stores")
    .select("id, name, chain, uf, is_incomplete")
    .order("name")
    .limit(MAX_ROWS);
  if (scope.allowedStoreIds) {
    if (!scope.allowedStoreIds.length) return [];
    q = q.in("id", scope.allowedStoreIds);
  }
  if (scope.allowedUfs) {
    if (!scope.allowedUfs.length) return [];
    q = q.in("uf", scope.allowedUfs);
  }
  const { data, error } = await q;
  if (error) throw new Error("MK9_DQ_DETECTOR_FAILED");
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name ?? "",
    chain: r.chain ?? null,
    uf: r.uf ?? null,
    isIncomplete: r.is_incomplete === true,
  }));
}

/**
 * Janela operacional por indústria (CALENDAR_MONTH ou ciclo próprio), em UMA
 * consulta. Indústria sem configuração cai no mês-calendário.
 */
export async function loadPeriodWindows(
  supabase: any,
  industryIds: string[],
  year: number,
  month: number,
): Promise<Map<string, PeriodWindowLite>> {
  const fallback = calendarWindow(year, month);
  const out = new Map<string, PeriodWindowLite>();
  for (const id of industryIds) out.set(id, fallback);
  if (!industryIds.length) return out;

  const { data, error } = await supabase
    .from("mk9_industry_period_config")
    .select("industry_id, period_type, start_day, end_day, uses_previous_month, active")
    .in("industry_id", industryIds)
    .limit(2000);
  if (error) throw new Error("MK9_DQ_DETECTOR_FAILED");

  const { resolveWindow } = await import("@/lib/mk9-reports/period.server");
  for (const row of (data ?? []) as any[]) {
    if (row.active === false) continue;
    const win = resolveWindow(
      {
        industryId: row.industry_id,
        periodType: row.period_type,
        startDay: row.start_day,
        endDay: row.end_day,
        usesPreviousMonth: row.uses_previous_month,
        weekGrouping: "CALENDAR_WEEK",
        active: true,
      },
      year,
      month,
    );
    out.set(row.industry_id, { startDate: win.startDate, endDate: win.endDate });
  }
  return out;
}

/** Menor início e maior fim entre todas as janelas — usado nas consultas em lote. */
export function unionWindow(windows: Map<string, PeriodWindowLite>): PeriodWindowLite | null {
  let start: string | null = null;
  let end: string | null = null;
  for (const w of windows.values()) {
    if (!start || w.startDate < start) start = w.startDate;
    if (!end || w.endDate > end) end = w.endDate;
  }
  return start && end ? { startDate: start, endDate: end } : null;
}
