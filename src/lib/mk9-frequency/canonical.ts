/**
 * MK9 — Regra canônica de frequência (semanal × mensal).
 *
 * REGRA COMERCIAL OFICIAL
 * -----------------------
 *   0,5x/semana  = 2x/mês   (quinzenal)
 *   1x/semana    = 4x/mês
 *   1,5x/semana  = 6x/mês
 *   2x/semana    = 8x/mês
 *   3x/semana    = 12x/mês
 *
 * Ou seja: `expectedMonthly = weekly × 4`.
 *
 * ATENÇÃO — LIMITE DE USO DESSA FÓRMULA
 * -------------------------------------
 * `weekly × 4` é PROIBIDA como cálculo operacional de visitas contratadas.
 * O cálculo de contratadas continua sendo exclusivamente
 * `contractedVisitsForFrequencySegments` (src/lib/mk9-frequency/segments.ts),
 * que é proporcional aos dias de vigência dentro do período operacional.
 *
 * Aqui a relação serve APENAS para validar a coerência comercial entre os dois
 * campos cadastrados (weekly_frequency e monthly_frequency).
 *
 * QUANDO OS DOIS CAMPOS VÊM DA PLANILHA
 * -------------------------------------
 *  - preservar ambos exatamente como vieram;
 *  - nunca recalcular o mensal automaticamente;
 *  - validar a consistência;
 *  - sinalizar divergência (Centro de Qualidade / preview de importação).
 */

/** Tolerância explícita: os campos são `numeric`, comparação exata é insegura. */
export const FREQUENCY_TOLERANCE = 0.0001;

/** Pares canônicos documentados (semanal → mensal). */
export const CANONICAL_FREQUENCY_PAIRS: ReadonlyArray<{ weekly: number; monthly: number }> = [
  { weekly: 0.5, monthly: 2 },
  { weekly: 1, monthly: 4 },
  { weekly: 1.5, monthly: 6 },
  { weekly: 2, monthly: 8 },
  { weekly: 3, monthly: 12 },
];

const num = (v: number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Mensal esperado pela regra comercial (NUNCA usar como contratadas). */
export function expectedMonthlyFromWeekly(weekly: number | null | undefined): number | null {
  const w = num(weekly);
  if (w === null || w <= 0) return null;
  return w * 4;
}

export interface FrequencyConsistency {
  /** false apenas quando os DOIS campos existem e divergem além da tolerância. */
  consistent: boolean;
  /** true quando não dá para avaliar (falta um dos campos ou valores <= 0). */
  evaluable: boolean;
  weekly: number | null;
  monthly: number | null;
  expectedMonthly: number | null;
  difference: number | null;
  /** 0,5x/semana com 2x/mês. */
  isBiweekly: boolean;
}

export function evaluateFrequencyConsistency(
  weeklyInput: number | null | undefined,
  monthlyInput: number | null | undefined,
): FrequencyConsistency {
  const weekly = num(weeklyInput);
  const monthly = num(monthlyInput);
  const expectedMonthly = expectedMonthlyFromWeekly(weekly);

  if (
    weekly === null ||
    monthly === null ||
    weekly <= 0 ||
    monthly <= 0 ||
    expectedMonthly === null
  ) {
    return {
      consistent: true,
      evaluable: false,
      weekly,
      monthly,
      expectedMonthly,
      difference: null,
      isBiweekly: false,
    };
  }

  const difference = monthly - expectedMonthly;
  const consistent = Math.abs(difference) <= FREQUENCY_TOLERANCE;
  return {
    consistent,
    evaluable: true,
    weekly,
    monthly,
    expectedMonthly,
    difference,
    isBiweekly:
      consistent &&
      Math.abs(weekly - 0.5) <= FREQUENCY_TOLERANCE &&
      Math.abs(monthly - 2) <= FREQUENCY_TOLERANCE,
  };
}

/** Conveniência booleana (mesma tolerância). */
export function isWeeklyMonthlyConsistent(
  weekly: number | null | undefined,
  monthly: number | null | undefined,
): boolean {
  return evaluateFrequencyConsistency(weekly, monthly).consistent;
}

/** "0,5" / "1,5" / "2" — números em pt-BR, sem zeros inúteis. */
export function formatFrequencyNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace(".", ",");
}

/**
 * Texto de apresentação no preview de importação e nas telas de frequência.
 *
 *   0,5 / 2 → "Frequência quinzenal: 0,5x/semana · 2x/mês"
 *   1   / 4 → "1x/semana · 4x/mês"
 */
export function describeFrequency(
  weeklyInput: number | null | undefined,
  monthlyInput: number | null | undefined,
): string {
  const state = evaluateFrequencyConsistency(weeklyInput, monthlyInput);
  const parts: string[] = [];
  if (state.weekly !== null && state.weekly > 0) {
    parts.push(`${formatFrequencyNumber(state.weekly)}x/semana`);
  }
  if (state.monthly !== null && state.monthly > 0) {
    parts.push(`${formatFrequencyNumber(state.monthly)}x/mês`);
  }
  if (!parts.length) return "Frequência não informada";
  const base = parts.join(" · ");
  if (state.isBiweekly) return `Frequência quinzenal: ${base}`;
  return base;
}

/** Aviso curto exibido no preview quando os dois campos divergem. */
export const FREQUENCY_INCONSISTENCY_WARNING = "Frequência semanal e mensal divergentes";
