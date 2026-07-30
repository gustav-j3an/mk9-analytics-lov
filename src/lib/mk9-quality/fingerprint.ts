/**
 * MK9 — Fase 2B.1: identidade determinística das ocorrências de qualidade.
 *
 * fingerprint  = IDENTIDADE do problema. Nunca muda por horário, ordem de
 *                campos, texto descritivo ou posição na lista.
 * context_hash = ESTADO do problema. Muda quando o cenário muda (valores,
 *                contagens, ids envolvidos), disparando reabertura/atualização
 *                de evidência.
 *
 * Módulo puro (sem Supabase, sem I/O) — testável isoladamente.
 */
import { createHash } from "node:crypto";
import type { DetectedIssue } from "./types";

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    // Ordem de lista NÃO é identidade: normaliza e ordena.
    return `[${value.map(normalizeValue).sort().join(",")}]`;
  }
  if (typeof value === "object") return `{${canonicalize(value as Record<string, unknown>)}}`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return String(value).trim().toLowerCase();
}

/**
 * Serialização canônica: chaves normalizadas, ordenadas e sem valores vazios.
 * Duas chamadas com as mesmas informações em ordens diferentes produzem
 * exatamente a mesma string.
 */
export function canonicalize(parts: Record<string, unknown>): string {
  return Object.entries(parts ?? {})
    .map(([k, v]) => [String(k).trim().toLowerCase(), normalizeValue(v)] as const)
    .filter(([, v]) => v !== "" && v !== "[]" && v !== "{}")
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
}

type FingerprintInput = Pick<
  DetectedIssue,
  | "category"
  | "issueType"
  | "entityType"
  | "entityId"
  | "peerEntityId"
  | "industryId"
  | "storeId"
  | "competence"
  | "fingerprintParts"
>;

/**
 * sha256(category + issueType + entityType + entityId + peerEntityId
 *        + industryId + storeId + competência + contexto relevante)
 *
 * `entityId`/`peerEntityId` são ordenados entre si: uma duplicata A↔B é o
 * mesmo problema que B↔A.
 */
export function buildFingerprint(input: FingerprintInput): string {
  const pair = [input.entityId ?? "", input.peerEntityId ?? ""].filter(Boolean).sort();
  return sha256(
    canonicalize({
      category: input.category,
      issueType: input.issueType,
      entityType: input.entityType,
      entityPair: pair,
      industryId: input.industryId ?? null,
      storeId: input.storeId ?? null,
      competence:
        input.competence && (input.competence.year || input.competence.month)
          ? `${input.competence.year ?? ""}-${input.competence.month ?? ""}`
          : null,
      parts: input.fingerprintParts ?? {},
    }),
  );
}

/** Hash do ESTADO atual — separado da identidade. */
export function buildContextHash(input: {
  contextParts: Record<string, unknown>;
  severity?: string;
}): string {
  return sha256(canonicalize({ severity: input.severity ?? null, ...input.contextParts }));
}

export interface FingerprintedIssue extends DetectedIssue {
  fingerprint: string;
  contextHash: string;
}

export function fingerprintIssue(issue: DetectedIssue): FingerprintedIssue {
  return {
    ...issue,
    fingerprint: buildFingerprint(issue),
    contextHash: buildContextHash({ contextParts: issue.contextParts, severity: issue.severity }),
  };
}
