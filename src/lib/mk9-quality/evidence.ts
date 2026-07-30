/**
 * MK9 — Fase 2B.1: sanitização central de `evidence`.
 *
 * A evidência NUNCA pode carregar: token, segredo, conteúdo integral de
 * arquivo, telefone, e-mail, observação pessoal, stack trace, SQL ou payload
 * bruto. Para erros técnicos guardamos apenas um código controlado.
 *
 * Módulo puro — usado tanto na escrita (detectores) quanto na leitura
 * (projeção por papel).
 */
import type { Mk9Evidence, Mk9JsonValue } from "./types";

const FORBIDDEN_KEY = new RegExp(
  [
    "token", "secret", "senha", "password", "apikey", "api_key", "authorization", "bearer",
    "jwt", "cookie", "credential",
    "phone", "telefone", "celular", "whatsapp", "email", "e_mail", "mail",
    "contact", "contato", "cpf", "cnpj",
    "stack", "stacktrace", "traceback", "sql", "query", "statement",
    "payload", "raw", "body", "filecontent", "file_content", "conteudo",
    "notes", "note", "observacao", "observacoes", "obs",
  ].join("|"),
  "i",
);

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /(?:\+?\d{2}\s?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/g;
const MAX_STRING = 240;
const MAX_KEYS = 40;
const MAX_DEPTH = 4;

function scrubString(value: string): string {
  const cleaned = value.replace(EMAIL_RE, "[redigido]").replace(PHONE_RE, "[redigido]");
  return cleaned.length > MAX_STRING ? `${cleaned.slice(0, MAX_STRING)}…` : cleaned;
}

function sanitizeValue(value: unknown, depth: number): Mk9JsonValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (depth >= MAX_DEPTH) return "[omitido]";
  if (Array.isArray(value)) return value.slice(0, MAX_KEYS).map((v) => sanitizeValue(v, depth + 1));
  if (typeof value === "object") return sanitizeRecord(value as Record<string, unknown>, depth + 1);
  return null;
}

function sanitizeRecord(input: Record<string, unknown>, depth: number): Mk9Evidence {
  const out: Mk9Evidence = {};
  let count = 0;
  for (const [key, value] of Object.entries(input ?? {})) {
    if (count >= MAX_KEYS) break;
    if (FORBIDDEN_KEY.test(key)) continue;
    if (value instanceof Error) continue;
    out[key] = sanitizeValue(value, depth);
    count++;
  }
  return out;
}

/** Sanitização obrigatória antes de qualquer persistência de evidência. */
export function sanitizeEvidence(evidence: Record<string, unknown> | null | undefined): Mk9Evidence {
  return sanitizeRecord(evidence ?? {}, 0);
}

/** Erros técnicos viram código controlado + contexto mínimo (nunca a mensagem crua). */
export function technicalErrorEvidence(code: string, context: Record<string, unknown> = {}): Mk9Evidence {
  return sanitizeEvidence({ errorCode: String(code).slice(0, 60).toUpperCase(), ...context });
}

/**
 * Campos de evidência liberados ao papel CLIENTE. Tudo que não estiver nesta
 * lista é considerado interno/técnico e é removido na leitura.
 */
const CLIENT_SAFE_KEYS = new Set([
  "hasFrequency", "hasRoute", "visitsWithoutRoute", "routeCandidateCount", "symptoms",
  "contractedVisits", "executedVisits", "pendingVisits", "storeName", "storeUf",
  "industryName", "competence", "expected", "found", "count",
]);

export function evidenceForClient(evidence: Mk9Evidence): Mk9Evidence {
  const out: Mk9Evidence = {};
  for (const [k, v] of Object.entries(evidence ?? {})) {
    if (CLIENT_SAFE_KEYS.has(k)) out[k] = v;
  }
  return out;
}
