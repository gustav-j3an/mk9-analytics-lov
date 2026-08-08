/**
 * MK9 — Fase 2B.4: SLA, prazo e prioridade das ocorrências.
 *
 * Módulo PURO (sem React, sem Supabase). Espelha EXATAMENTE a função SQL
 * `public.mk9_quality_default_due_at`. Se uma mudar, a outra muda junto.
 *
 * Princípio: SEVERIDADE = impacto (definida pelo detector).
 *            PRIORIDADE = ordem operacional de tratamento (definida por gente).
 * Uma nunca substitui a outra.
 */
import type { Mk9QualitySeverity, Mk9QualityStatus } from "./types";

export type Mk9QualityPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export const MK9_PRIORITIES: Mk9QualityPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

export const PRIORITY_META: Record<
  Mk9QualityPriority,
  { label: string; weight: number; className: string }
> = {
  URGENT: {
    label: "Urgente",
    weight: 4,
    className: "border-destructive/45 bg-destructive/12 text-destructive",
  },
  HIGH: {
    label: "Alta",
    weight: 3,
    className:
      "border-[color:var(--color-kpi-amber)]/40 bg-[color-mix(in_oklab,var(--color-kpi-amber)_14%,transparent)] text-[color:var(--color-kpi-amber)]",
  },
  NORMAL: { label: "Normal", weight: 2, className: "border-border bg-muted text-foreground" },
  LOW: { label: "Baixa", weight: 1, className: "border-border bg-muted text-muted-foreground" },
};

export function priorityLabel(value: string | null | undefined): string {
  return PRIORITY_META[(value ?? "NORMAL") as Mk9QualityPriority]?.label ?? "Normal";
}

export function priorityWeight(value: string | null | undefined): number {
  return PRIORITY_META[(value ?? "NORMAL") as Mk9QualityPriority]?.weight ?? 0;
}

export function isValidPriority(value: unknown): value is Mk9QualityPriority {
  return typeof value === "string" && (MK9_PRIORITIES as string[]).includes(value);
}

// ---------------------------------------------------------------------------
// SLA padrão por severidade (dias ÚTEIS). INFO não tem prazo obrigatório.
// ---------------------------------------------------------------------------

export const SLA_BUSINESS_DAYS: Record<Mk9QualitySeverity, number | null> = {
  BLOQUEANTE: 0, // mesmo dia
  CRITICO: 1,
  ATENCAO: 3,
  AVISO: 5,
  INFO: null,
};

export const SLA_LABEL: Record<Mk9QualitySeverity, string> = {
  BLOQUEANTE: "Mesmo dia",
  CRITICO: "1 dia útil",
  ATENCAO: "3 dias úteis",
  AVISO: "5 dias úteis",
  INFO: "Sem prazo obrigatório",
};

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay(); // 0 = domingo, 6 = sábado
  return day === 0 || day === 6;
}

/**
 * Prazo padrão a partir da detecção. Devolve o FIM do dia útil alvo.
 * `null` quando a severidade não tem SLA obrigatório.
 */
export function defaultDueAt(
  severity: Mk9QualitySeverity | string,
  from: Date | string = new Date(),
): string | null {
  const days = SLA_BUSINESS_DAYS[severity as Mk9QualitySeverity];
  if (days === null || days === undefined) return null;

  const base = typeof from === "string" ? new Date(from) : from;
  if (Number.isNaN(base.getTime())) return null;

  const cursor = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  let added = 0;
  while (added < days) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!isWeekend(cursor)) added += 1;
  }
  cursor.setUTCHours(23, 59, 59, 0);
  return cursor.toISOString();
}

// ---------------------------------------------------------------------------
// Atraso
// ---------------------------------------------------------------------------

const CLOSED: Mk9QualityStatus[] = ["RESOLVED", "RESOLVED_AUTO", "IGNORED"];

export function isOpenStatus(status: string): boolean {
  return !(CLOSED as string[]).includes(status);
}

/** Ocorrência encerrada nunca fica "vencida". */
export function isOverdue(
  input: { dueAt?: string | null; status: string },
  now: Date = new Date(),
): boolean {
  if (!input.dueAt || !isOpenStatus(input.status)) return false;
  const due = new Date(input.dueAt);
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
}

export function isDueToday(
  input: { dueAt?: string | null; status: string },
  now: Date = new Date(),
): boolean {
  if (!input.dueAt || !isOpenStatus(input.status)) return false;
  const due = new Date(input.dueAt);
  if (Number.isNaN(due.getTime())) return false;
  if (due.getTime() < now.getTime()) return false;
  return (
    due.getUTCFullYear() === now.getUTCFullYear() &&
    due.getUTCMonth() === now.getUTCMonth() &&
    due.getUTCDate() === now.getUTCDate()
  );
}

/** Dias de atraso (>=1) ou 0 quando ainda no prazo. */
export function overdueDays(
  input: { dueAt?: string | null; status: string },
  now: Date = new Date(),
): number {
  if (!isOverdue(input, now)) return 0;
  const due = new Date(input.dueAt as string).getTime();
  return Math.max(1, Math.ceil((now.getTime() - due) / 86_400_000));
}

export function dueLabel(
  input: { dueAt?: string | null; status: string },
  now: Date = new Date(),
): string {
  if (!input.dueAt) return "Sem prazo";
  const due = new Date(input.dueAt);
  if (Number.isNaN(due.getTime())) return "Sem prazo";
  if (!isOpenStatus(input.status)) return due.toLocaleDateString("pt-BR");
  if (isOverdue(input, now)) {
    const d = overdueDays(input, now);
    return `Vencido há ${d} ${d === 1 ? "dia" : "dias"}`;
  }
  if (isDueToday(input, now)) return "Vence hoje";
  return `Vence em ${due.toLocaleDateString("pt-BR")}`;
}

// ---------------------------------------------------------------------------
// Ignorar com prazo de revisão
// ---------------------------------------------------------------------------

/** Um IGNORADO com `ignore_until` vencido volta a ser cobrado na próxima execução. */
export function ignoreExpired(
  input: { status: string; ignoreUntil?: string | null },
  now: Date = new Date(),
): boolean {
  if (input.status !== "IGNORED" || !input.ignoreUntil) return false;
  const until = new Date(input.ignoreUntil);
  return !Number.isNaN(until.getTime()) && until.getTime() <= now.getTime();
}

// ---------------------------------------------------------------------------
// Ordenação da fila operacional: atraso → prioridade → severidade → recência
// ---------------------------------------------------------------------------

import { severityWeight } from "./labels";

export interface QueueSortable {
  dueAt?: string | null;
  status: string;
  priority?: string | null;
  severity: string;
  lastSeenAt: string;
}

export function compareQueue(a: QueueSortable, b: QueueSortable, now: Date = new Date()): number {
  return (
    overdueDays(b, now) - overdueDays(a, now) ||
    priorityWeight(b.priority) - priorityWeight(a.priority) ||
    severityWeight(b.severity) - severityWeight(a.severity) ||
    String(b.lastSeenAt).localeCompare(String(a.lastSeenAt))
  );
}

// ---------------------------------------------------------------------------
// Métricas de SLA (só ocorrências COM histórico entram aqui)
// ---------------------------------------------------------------------------

export interface SlaSample {
  firstDetectedAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
}

function averageHours(pairs: Array<[string, string]>): number | null {
  if (!pairs.length) return null;
  let sum = 0;
  let n = 0;
  for (const [from, to] of pairs) {
    const a = new Date(from).getTime();
    const b = new Date(to).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) continue;
    sum += b - a;
    n += 1;
  }
  if (!n) return null;
  return Math.round((sum / n / 3_600_000) * 10) / 10;
}

export function slaAverages(samples: SlaSample[]): {
  hoursToAcknowledge: number | null;
  hoursToResolve: number | null;
} {
  return {
    hoursToAcknowledge: averageHours(
      samples
        .filter((s) => s.acknowledgedAt)
        .map((s) => [s.firstDetectedAt, s.acknowledgedAt as string]),
    ),
    hoursToResolve: averageHours(
      samples.filter((s) => s.resolvedAt).map((s) => [s.firstDetectedAt, s.resolvedAt as string]),
    ),
  };
}

export function durationLabel(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours} h`;
  return `${Math.round((hours / 24) * 10) / 10} d`;
}
