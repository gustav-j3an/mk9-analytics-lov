// Regras de negócio para geração de datas do roteiro.
// Puro, sem dependências. Fuso: as datas são geradas como YYYY-MM-DD (data civil)
// e independem de timezone do runtime — usamos aritmética UTC apenas para varrer o mês.

import type { Weekday } from "../types";

/**
 * Gera todas as datas (YYYY-MM-DD) do mês/ano em que o weekday corresponde.
 * weekday: 0=domingo ... 6=sábado (compatível com Date.getUTCDay()).
 */
export function datesForWeekdayInMonth(
  year: number,
  month: number, // 1..12
  weekday: Weekday,
): string[] {
  const result: string[] = [];
  // primeiro dia do mês em UTC — evita drift por timezone local
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0)); // dia 0 do próximo mês = último dia
  for (let d = first.getUTCDate(); d <= last.getUTCDate(); d++) {
    const dt = new Date(Date.UTC(year, month - 1, d));
    if (dt.getUTCDay() === weekday) {
      result.push(formatISODate(dt));
    }
  }
  return result;
}

export function formatISODate(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function computeIndustryStatus(
  contracted: number | null | undefined,
  estimated: number | null | undefined,
): {
  status: "DENTRO DA META" | "ACIMA DA META" | "ABAIXO DA META" | "SEM META";
  diff: number | null;
} {
  if (contracted === null || contracted === undefined) {
    return { status: "SEM META", diff: null };
  }
  const est = estimated ?? 0;
  const diff = est - contracted;
  if (diff === 0) return { status: "DENTRO DA META", diff };
  if (diff > 0) return { status: "ACIMA DA META", diff };
  return { status: "ABAIXO DA META", diff };
}
