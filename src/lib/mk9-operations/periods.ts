/**
 * MK9 — Núcleo operacional compartilhado (Fase 3.1B): utilidades de período.
 *
 * Módulo PURO (sem Supabase, sem I/O). Dashboard e Cockpit usam exatamente
 * estas funções — nenhuma fórmula é duplicada em outro lugar.
 */
import type { PeriodConfig } from "@/lib/mk9-reports/period.server";
import type { OperationWindow } from "./types";

export const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function periodLabel(year: number, month: number): string {
  return `${MONTHS_PT[month - 1]}/${year}`;
}

export const DEFAULT_PERIOD_CONFIG = (industryId: string): PeriodConfig => ({
  industryId,
  periodType: "CALENDAR_MONTH",
  startDay: 1,
  endDay: 31,
  usesPreviousMonth: false,
  weekGrouping: "CALENDAR_WEEK",
  active: true,
});

/** Data operacional em São Paulo (fuso da operação). */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function dayDiff(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86400000);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Fração do período já transcorrida até hoje.
 *   período futuro    -> 0
 *   período encerrado -> 1
 *   período corrente  -> dias transcorridos / total de dias
 */
export function elapsedFraction(win: OperationWindow, today: string): number {
  if (today < win.startDate) return 0;
  if (today > win.endDate) return 1;
  const elapsed = dayDiff(win.startDate, today) + 1;
  return Math.min(1, Math.max(0, elapsed / Math.max(1, win.totalDays)));
}

export function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/** Dias corridos já decorridos dentro da janela (mínimo 0). */
export function elapsedDays(win: OperationWindow, today: string): number {
  if (today < win.startDate) return 0;
  const end = today > win.endDate ? win.endDate : today;
  return dayDiff(win.startDate, end) + 1;
}

/** Segunda-feira da semana ISO de uma data (usada nas séries semanais). */
export function weekStartIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const wd = d.getUTCDay(); // 0=domingo
  const delta = wd === 0 ? -6 : 1 - wd;
  return addDays(iso, delta);
}

/** Dias úteis (seg–sex) entre duas datas, inclusive. */
export function businessDaysBetween(startIso: string, endIso: string): number {
  if (endIso < startIso) return 0;
  let count = 0;
  const total = dayDiff(startIso, endIso);
  for (let i = 0; i <= total; i += 1) {
    const wd = new Date(`${addDays(startIso, i)}T00:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) count += 1;
  }
  return count;
}
