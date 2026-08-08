/**
 * MK9 — Fase 2B.2: resolução pura da competência analisada pelos detectores.
 *
 * Regra: quando a interface não informa competência, os detectores usam o mês
 * corrente. Nunca varrem "todo o histórico" — isso explodiria volume e geraria
 * ocorrências sem dono.
 */
import type { Mk9Competence } from "../types";

export interface ResolvedCompetence {
  month: number;
  year: number;
}

export function resolveCompetence(
  competence: Mk9Competence | null | undefined,
  now: Date = new Date(),
): ResolvedCompetence {
  const year = competence?.year ?? now.getUTCFullYear();
  const month = competence?.month ?? now.getUTCMonth() + 1;
  return { year, month };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Janela de mês-calendário (fallback quando a indústria não tem período próprio). */
export function calendarWindow(
  year: number,
  month: number,
): { startDate: string; endDate: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${year}-${pad(month)}-01`,
    endDate: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/** Data ISO (yyyy-mm-dd) somando dias — usada nos detectores de importação. */
export function addDays(iso: string, days: number): string {
  const base = new Date(`${iso}T00:00:00Z`).getTime() + days * 86400000;
  return new Date(base).toISOString().slice(0, 10);
}
