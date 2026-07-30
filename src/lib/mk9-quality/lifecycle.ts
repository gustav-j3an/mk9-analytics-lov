/**
 * MK9 — Fase 2B.1: ciclo de vida das ocorrências (regra pura).
 *
 * Espelha EXATAMENTE a lógica transacional da RPC
 * `public.mk9_quality_sync_detections`, para que possa ser testada sem banco.
 * Se uma das duas mudar, a outra precisa mudar junto.
 */
import type { Mk9QualityEventType, Mk9QualityStatus } from "./types";

export interface LifecycleDecision {
  status: Mk9QualityStatus;
  event: Mk9QualityEventType;
  clearsDecision: boolean;
}

/** Problema detectado agora. `current` = null quando é a primeira detecção. */
export function decideOnDetection(
  current: Mk9QualityStatus | null,
  contextChanged: boolean,
): LifecycleDecision {
  if (current === null) {
    return { status: "OPEN", event: "DETECTED", clearsDecision: false };
  }

  // Voltou após resolução (manual ou automática) ⇒ REOPENED sempre.
  if (current === "RESOLVED" || current === "RESOLVED_AUTO") {
    return { status: "REOPENED", event: "REOPENED", clearsDecision: true };
  }

  // IGNORED só reabre quando o CONTEXTO muda; mesmo contexto preserva a decisão.
  if (current === "IGNORED") {
    return contextChanged
      ? { status: "REOPENED", event: "REOPENED", clearsDecision: true }
      : { status: "IGNORED", event: "SEEN_AGAIN", clearsDecision: false };
  }

  return {
    status: current,
    event: contextChanged ? "EVIDENCE_UPDATED" : "SEEN_AGAIN",
    clearsDecision: false,
  };
}

/** Problema deixou de ser detectado. `null` = não muda de status. */
export function decideOnDisappearance(
  current: Mk9QualityStatus,
): LifecycleDecision | null {
  if (current === "OPEN" || current === "ACKNOWLEDGED" || current === "IN_PROGRESS" || current === "REOPENED") {
    return { status: "RESOLVED_AUTO", event: "RESOLVED_AUTO", clearsDecision: false };
  }
  // IGNORED / RESOLVED / RESOLVED_AUTO permanecem como estão (nunca apagados).
  return null;
}

const MANUAL_EVENT: Record<string, Mk9QualityEventType> = {
  ACKNOWLEDGED: "ACKNOWLEDGED",
  IN_PROGRESS: "STARTED",
  RESOLVED: "RESOLVED",
  IGNORED: "IGNORED",
};

export type Mk9ManualTransition = "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "IGNORED";

export function manualEventFor(target: Mk9ManualTransition): Mk9QualityEventType {
  return MANUAL_EVENT[target];
}

/** Validação de justificativa (espelha os CHECKs do banco). */
export function requiresReason(target: Mk9ManualTransition): number {
  if (target === "IGNORED") return 5;
  if (target === "RESOLVED") return 3;
  return 0;
}

export function validateReason(target: Mk9ManualTransition, reason?: string | null): boolean {
  const min = requiresReason(target);
  if (min === 0) return true;
  return typeof reason === "string" && reason.trim().length >= min;
}
