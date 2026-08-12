/**
 * MK9 — Núcleo operacional compartilhado (Fase 3.1B): agregações PURAS.
 *
 * Fórmulas homologadas (Fase 1B.3) — NÃO alterar:
 *   contratadas    = frequência versionada por segmentos de vigência
 *   realizadas     = visitas reais dentro da janela da indústria
 *   pendentes      = max(0, contratadas - realizadas)
 *   extras         = max(0, realizadas - contratadas)
 *   cobertura      = min(100, realizadas / contratadas)
 *   esperado hoje  = contratadas recortadas na data de hoje
 */
import {
  contractedVisitsForFrequencySegments,
  type ContractedResult,
  type FrequencySegmentInput,
} from "@/lib/mk9-frequency/segments";

import { addDays, dayDiff, pct, weekStartIso } from "./periods";
import type {
  IndustryContext,
  IndustryStatusKey,
  OperationIndustryRow,
  OperationSeriesPoint,
  OperationStoreRow,
  OperationWindow,
  ResolvedPromoter,
  RouteInfo,
  StoreExecStatus,
} from "./types";

/** Contratadas de uma loja na janela, sempre via motor de segmentos. */
export function contractedForStore(
  segments: FrequencySegmentInput[],
  win: { startDate: string; endDate: string },
  untilDate?: string | null,
): ContractedResult {
  return contractedVisitsForFrequencySegments({
    segments,
    operationPeriodStart: win.startDate,
    operationPeriodEnd: win.endDate,
    untilDate: untilDate ?? null,
  });
}

/** Promotor vigente do par (indústria, loja) por votação do roteiro. */
export function resolvePromoter(
  routeByKey: Map<string, RouteInfo>,
  key: string,
): ResolvedPromoter & { employeeNumber?: string | null } {
  const info = routeByKey.get(key) as any;
  if (!info || !info.votes || info.votes.size === 0) {
    return { id: null, name: "Sem promotor", resolution: "UNASSIGNED_ROUTE", employeeNumber: null };
  }
  let best: { id: string; name: string; employeeNumber: string | null; count: number } | null =
    null;
  for (const [pid, v] of info.votes) {
    if (!best || v.count > (best as any).count) {
      best = {
        id: pid,
        name: v.name || "Promotor sem nome",
        employeeNumber: (v as any).employeeNumber,
        count: v.count,
      };
    }
  }
  return {
    id: best!.id,
    name: best!.name,
    employeeNumber: best!.employeeNumber,
    resolution: info.votes.size > 1 ? "AMBIGUOUS_ROUTE" : "MATCHED_ROUTE",
  };
}

export function buildStoreRows(input: {
  ctxs: IndustryContext[];
  routeByKey: Map<string, RouteInfo>;
  today: string;
  promoterFilter?: string | null;
  allowedPromoterIds?: string[] | null;
}): OperationStoreRow[] {
  const { ctxs, routeByKey, today } = input;
  const rows: OperationStoreRow[] = [];
  for (const ctx of ctxs) {
    for (const b of ctx.buckets.values()) {
      const key = `${ctx.id}|${b.storeId}`;
      const promo = resolvePromoter(routeByKey, key);
      if (input.promoterFilter && promo.id !== input.promoterFilter) continue;
      if (input.allowedPromoterIds && (!promo.id || !input.allowedPromoterIds.includes(promo.id)))
        continue;

      const contracted = contractedForStore(b.segments, ctx.win);
      const contratadas = contracted.contratadas;
      const realizadas = b.visits.length;
      const expectedToDate =
        today >= ctx.win.endDate
          ? contratadas
          : contractedForStore(b.segments, ctx.win, today).contratadas;

      const lastVisit = b.visits.length ? b.visits.slice().sort()[b.visits.length - 1] : null;
      const status: StoreExecStatus =
        realizadas === 0
          ? "NAO_ATENDIDA"
          : contratadas > 0 && realizadas >= contratadas
            ? "INTEGRAL"
            : "PARCIAL";

      rows.push({
        storeId: b.storeId,
        storeName: b.storeName,
        chain: b.chain,
        uf: b.uf,
        industryId: ctx.id,
        industryName: ctx.name,
        weeklyFrequency: b.weekly,
        monthlyFrequency: b.monthly,
        frequencyLabel: b.frequencyLabel ?? null,
        contratadas,

        expectedToDate,
        realizadas,
        pendentes: Math.max(0, contratadas - realizadas),
        lastVisit,
        daysWithoutVisit: lastVisit ? Math.max(0, dayDiff(lastVisit, today)) : null,
        promoterId: promo.id,
        promoterName: promo.name,
        promoterEmployeeNumber: (promo as any).employeeNumber || null,
        promoterResolution: promo.resolution,
        status,
      });
    }
  }
  return rows;
}

export function classifyIndustry(input: {
  contratadas: number;
  realizadas: number;
  expectedToDate: number;
  lojasContratadas: number;
  checklistImports: number;
  hasExecutionOrRoute: boolean;
}): IndustryStatusKey {
  const contratadas = input.contratadas ?? 0;
  const realizadas = input.realizadas ?? 0;
  const expectedToDate = input.expectedToDate ?? 0;
  const lojasContratadas = input.lojasContratadas ?? 0;
  const checklistImports = input.checklistImports ?? 0;

  if (contratadas <= 0 && lojasContratadas <= 0) return "SEM_FREQUENCIA";

  if (realizadas === 0 && checklistImports === 0) return "SEM_CHECKLIST";
  if (realizadas >= contratadas) return "CONCLUIDA";
  if (expectedToDate <= 0) return "EM_DIA";
  if (realizadas >= expectedToDate) return "EM_DIA";
  const ratio = realizadas / expectedToDate;
  if (ratio >= 0.9) return "ATENCAO";
  return "CRITICA";
}

export function buildIndustryRows(input: {
  ctxs: IndustryContext[];
  storeRows: OperationStoreRow[];
  industriesWithRoute: Set<string>;
  today: string;
}): OperationIndustryRow[] {
  const { ctxs, storeRows, industriesWithRoute, today } = input;
  const rowsByIndustry = new Map<string, OperationStoreRow[]>();
  for (const s of storeRows) {
    const list = rowsByIndustry.get(s.industryId);
    if (list) list.push(s);
    else rowsByIndustry.set(s.industryId, [s]);
  }

  return ctxs
    .filter((ctx) => {
      // REGRA DASHBOARD v3.7.0: Somente indústrias com checklist ativo participam do Dashboard.
      if (ctx.controlMode !== "VISIT_CONTROLLED") return false;
      if (!ctx.requiresChecklist) return false;

      const rows = rowsByIndustry.get(ctx.id) ?? [];
      return (
        rows.some((s) => s.contratadas > 0 || s.realizadas > 0) ||
        industriesWithRoute.has(ctx.id) ||
        ctx.checklistImports > 0
      );
    })
    .map((ctx) => {
      const rows = rowsByIndustry.get(ctx.id) ?? [];
      const contratadas = rows.reduce((a, s) => a + s.contratadas, 0);
      const realizadas = rows.reduce((a, s) => a + s.realizadas, 0);
      const expectedToDate = Math.round(contratadas * ctx.fraction);
      const lojasAtendidas = rows.filter((s) => s.realizadas > 0).length;
      const lojasContratadas = rows.filter((s) => s.contratadas > 0).length;

      // Pegamos a frequência mais comum entre as lojas para exibição agregada
      const frequencies = rows.map(r => r.frequencyLabel).filter(Boolean);
      const frequency = frequencies.length > 0 
        ? Array.from(new Set(frequencies)).join(", ")
        : null;

      const status = classifyIndustry({
        contratadas,
        realizadas,
        expectedToDate,
        lojasContratadas,
        checklistImports: ctx.checklistImports,
        hasExecutionOrRoute: realizadas > 0 || industriesWithRoute.has(ctx.id),
      });
      return {
        industryId: ctx.id,
        industryName: ctx.name,
        windowStart: ctx.win.startDate,
        windowEnd: ctx.win.endDate,
        totalDays: ctx.win.totalDays,
        elapsedDays: Math.round(ctx.win.totalDays * ctx.fraction),
        isHistorical: ctx.win.endDate < today,
        lojasContratadas,
        lojasAtendidas,
        zeradasCount: rows.filter((s) => s.realizadas === 0 && s.contratadas > 0).length,
        contratadas,
        expectedToDate,

        realizadas,
        pendentes: Math.max(0, contratadas - realizadas),
        coberturaPct: contratadas > 0 ? Math.min(100, pct(realizadas, contratadas)) : 0,
        deviation: realizadas - expectedToDate,
        pacePercentage:
          expectedToDate > 0 ? pct(realizadas, expectedToDate) : realizadas > 0 ? 100 : 0,
        status,
        frequency,
        checklistImports: ctx.checklistImports,
      };
    });
}

/** Visitas por dia (apenas lojas que sobreviveram aos filtros). */
export function visitsByDay(
  ctxs: IndustryContext[],
  storeRows: OperationStoreRow[],
): Map<string, number> {
  const ctxById = new Map(ctxs.map((c) => [c.id, c]));
  const byDay = new Map<string, number>();
  for (const s of storeRows) {
    const bucket = ctxById.get(s.industryId)?.buckets.get(s.storeId);
    for (const d of bucket?.visits ?? []) byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  return byDay;
}

/** Série acumulada diária: esperado proporcional × realizado. */
export function buildDailySeries(input: {
  ctxs: IndustryContext[];
  industryRows: OperationIndustryRow[];
  storeRows: OperationStoreRow[];
  globalStart: string;
  globalEnd: string;
}): OperationSeriesPoint[] {
  const { ctxs, industryRows, storeRows, globalStart, globalEnd } = input;
  const contractedByIndustry = new Map<string, number>();
  for (const i of industryRows) contractedByIndustry.set(i.industryId, i.contratadas);
  const ctxWindows = new Map<string, OperationWindow>(ctxs.map((c) => [c.id, c.win]));
  const realizedByDay = visitsByDay(ctxs, storeRows);

  const points: OperationSeriesPoint[] = [];
  const totalDaysSpan = dayDiff(globalStart, globalEnd);
  if (totalDaysSpan < 0 || totalDaysSpan > 400) return points;

  let realizedAcc = 0;
  for (let i = 0; i <= totalDaysSpan; i += 1) {
    const date = addDays(globalStart, i);
    realizedAcc += realizedByDay.get(date) ?? 0;
    let expectedAcc = 0;
    for (const [industryId, contracted] of contractedByIndustry) {
      const win = ctxWindows.get(industryId);
      if (!win) continue;
      if (date < win.startDate) continue;
      const frac =
        date >= win.endDate ? 1 : (dayDiff(win.startDate, date) + 1) / Math.max(1, win.totalDays);
      expectedAcc += contracted * frac;
    }
    const expected = Math.round(expectedAcc);
    points.push({ date, expected, realized: realizedAcc, diff: realizedAcc - expected });
  }
  return points;
}

/** Série semanal (payload compacto do Cockpit) derivada da série diária. */
export function toWeeklySeries(daily: OperationSeriesPoint[]): OperationSeriesPoint[] {
  const byWeek = new Map<string, OperationSeriesPoint>();
  for (const p of daily) {
    // acumulado: o último ponto da semana representa a semana inteira
    byWeek.set(weekStartIso(p.date), { ...p, date: weekStartIso(p.date) });
  }
  return Array.from(byWeek.values()).sort((a, b) => a.date.localeCompare(b.date));
}
