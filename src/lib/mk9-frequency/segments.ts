/**
 * MK9 — Fase 1B.3: motor ÚNICO de cálculo de visitas contratadas a partir de
 * segmentos de vigência de frequência.
 *
 * Puro (sem I/O). Todas as telas (Dashboard, Auditoria, Relatório da Indústria,
 * PDF e métricas legadas) devem usar exclusivamente este módulo para calcular
 * "contratadas" e "esperado até a data".
 *
 * FÓRMULA DEFINITIVA
 * ------------------
 * Para cada segmento de vigência intersectado com o período operacional:
 *
 *   monthly_frequency (contrato mensal do período completo):
 *     raw = monthly × (diasDoSegmento / diasDoPeríodo)
 *
 *   weekly_frequency (fallback quando não há mensal):
 *     raw = weekly × (diasDoSegmento / 7)
 *
 * Nunca `weekly × 4`. Frequência quinzenal (0,5) funciona naturalmente.
 *
 * ARREDONDAMENTO
 * --------------
 * Os segmentos são somados em ponto flutuante SEM arredondamento intermediário.
 * Existe UM ÚNICO arredondamento final por (indústria, loja), meio-para-cima
 * (`Math.round`, half-up). Nunca `Math.floor` após `Math.round`.
 * Totais por indústria/UF/promotor são a soma dos valores já arredondados por
 * loja — assim Dashboard, Auditoria e PDF chegam sempre ao mesmo número.
 */

export type ContractedSource = "WEEKLY_FREQUENCY" | "MONTHLY_FREQUENCY" | "NONE";

export interface FrequencySegmentInput {
  /** yyyy-mm-dd inclusive */
  validFrom: string;
  /** yyyy-mm-dd inclusive; null = vigente indefinidamente */
  validUntil: string | null;
  weeklyFrequency: number | null;
  monthlyFrequency: number | null;
}

export interface ResolvedSegment {
  startDate: string;
  endDate: string;
  days: number;
  weeklyFrequency: number | null;
  monthlyFrequency: number | null;
  source: ContractedSource;
  /** contribuição exata (não arredondada) do segmento */
  raw: number;
}

export interface ContractedResult {
  /** valor final por loja — único arredondamento aplicado */
  contratadas: number;
  /** soma exata dos segmentos, sem arredondamento */
  raw: number;
  segments: ResolvedSegment[];
  source: ContractedSource;
  /** true quando houve mudança de frequência dentro do período */
  hasMultipleSegments: boolean;
}

export const EMPTY_CONTRACTED: ContractedResult = {
  contratadas: 0,
  raw: 0,
  segments: [],
  source: "NONE",
  hasMultipleSegments: false,
};

export function daysInclusive(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

const maxDate = (a: string, b: string) => (a > b ? a : b);
const minDate = (a: string, b: string) => (a < b ? a : b);

function positive(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Contratadas de UMA loja/indústria no período, considerando todas as
 * vigências que interceptam a janela.
 *
 * @param untilDate  quando informado, limita o cálculo à data (meta esperada
 *                   proporcional). O denominador mensal continua sendo o
 *                   período completo — é isso que torna a meta proporcional.
 */
export function contractedVisitsForFrequencySegments(input: {
  segments: FrequencySegmentInput[];
  operationPeriodStart: string;
  operationPeriodEnd: string;
  untilDate?: string | null;
}): ContractedResult {
  const { operationPeriodStart: periodStart, operationPeriodEnd: periodEnd } = input;
  if (!periodStart || !periodEnd || periodEnd < periodStart) return EMPTY_CONTRACTED;

  const periodDays = Math.max(1, daysInclusive(periodStart, periodEnd));

  // Limite superior efetivo (meta até a data). Antes do período → nada.
  let effectiveEnd = periodEnd;
  if (input.untilDate) {
    if (input.untilDate < periodStart) {
      return { ...EMPTY_CONTRACTED, segments: [] };
    }
    effectiveEnd = minDate(periodEnd, input.untilDate);
  }

  const resolved: ResolvedSegment[] = [];
  let raw = 0;
  let sawMonthly = false;
  let sawWeekly = false;

  const ordered = [...input.segments].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  for (const seg of ordered) {
    const segEnd = seg.validUntil ?? "9999-12-31";
    const start = maxDate(seg.validFrom, periodStart);
    const end = minDate(segEnd, effectiveEnd);
    if (end < start) continue;

    const days = daysInclusive(start, end);
    if (days <= 0) continue;

    const monthly = positive(seg.monthlyFrequency);
    const weekly = positive(seg.weeklyFrequency);

    let source: ContractedSource = "NONE";
    let segRaw = 0;
    if (monthly != null) {
      source = "MONTHLY_FREQUENCY";
      // REGRA MK9 (HOTFIX KING): O valor contratado mensal é a meta do período.
      // Em competências mensais normais (mesmo as personalizadas como a KING 23 a 22),
      // o usuário espera que a meta seja o valor total do arquivo.
      // Só proporcionalizamos se o segmento for parcial em relação ao período operacional total.
      const segCobreInicio = seg.validFrom <= periodStart;
      const segCobreFim = seg.validUntil === null || seg.validUntil >= periodEnd;
      
      if (!input.untilDate && (segCobreInicio || segCobreFim)) {
        // Se cobre o início ou o fim (ou ambos), tratamos como a frequência principal do período
        segRaw = monthly;
      } else {
        segRaw = monthly * (days / periodDays);
      }
      sawMonthly = true;
    } else if (weekly != null) {
      source = "WEEKLY_FREQUENCY";
      segRaw = weekly * (days / 7);
      sawWeekly = true;
    }

    raw += segRaw;
    resolved.push({
      startDate: start,
      endDate: end,
      days,
      weeklyFrequency: seg.weeklyFrequency ?? null,
      monthlyFrequency: seg.monthlyFrequency ?? null,
      source,
      raw: segRaw,
    });
  }

  // Segmentos com vigência dentro do período completo (para saber se houve
  // troca real de frequência — independe do recorte "até a data").
  const withinPeriod = ordered.filter(
    (s) => s.validFrom <= periodEnd && (s.validUntil ?? "9999-12-31") >= periodStart,
  );

  return {
    contratadas: Math.max(0, Math.round(raw)),
    raw,
    segments: resolved,
    source: sawMonthly ? "MONTHLY_FREQUENCY" : sawWeekly ? "WEEKLY_FREQUENCY" : "NONE",
    hasMultipleSegments: withinPeriod.length > 1,
  };
}

/** Meta esperada até uma data, respeitando as trocas de frequência ocorridas. */
export function expectedVisitsUntil(input: {
  segments: FrequencySegmentInput[];
  operationPeriodStart: string;
  operationPeriodEnd: string;
  untilDate: string;
}): number {
  if (input.untilDate < input.operationPeriodStart) return 0;
  return contractedVisitsForFrequencySegments(input).contratadas;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function brDay(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function segLabel(seg: ResolvedSegment): string {
  if (seg.source === "MONTHLY_FREQUENCY") return `${seg.monthlyFrequency}x/mês`;
  if (seg.source === "WEEKLY_FREQUENCY") return `${seg.weeklyFrequency}x/sem`;
  return "sem frequência";
}

/**
 * Rótulo semanticamente correto quando há mais de uma vigência no período:
 *   "1x/sem até 15/07 · 2x/sem desde 16/07"
 * Com um único segmento devolve apenas "4x/mês".
 */
export function describeFrequencySegments(
  result: ContractedResult,
  period: { start: string; end: string },
): string | null {
  const segs = result.segments;
  if (segs.length === 0) return null;
  if (segs.length === 1) return segLabel(segs[0]);
  return segs
    .map((s, i) => {
      if (i === 0 && s.endDate < period.end) return `${segLabel(s)} até ${brDay(s.endDate)}`;
      if (i === segs.length - 1 && s.startDate > period.start) return `${segLabel(s)} desde ${brDay(s.startDate)}`;
      return `${segLabel(s)} ${brDay(s.startDate)}–${brDay(s.endDate)}`;
    })
    .join(" · ");
}

/** Formata yyyy-mm-dd a partir de componentes (utilitário compartilhado). */
export function isoDate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}
