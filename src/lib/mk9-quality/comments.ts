/**
 * MK9 — Fase 2B.4: comentários das ocorrências.
 *
 * Módulo PURO. Comentário é texto livre digitado por gente: é a superfície
 * mais provável de vazamento de dado sensível dentro do Centro de Qualidade.
 *
 * Regras:
 *  - linguagem operacional comum é permitida;
 *  - telefone, e-mail, token/segredo, SQL, stack e payload são REMOVIDOS;
 *  - link interno sensível é removido;
 *  - CLIENTE só enxerga comentários marcados como visíveis ao cliente.
 */

export type Mk9CommentVisibility = "INTERNAL" | "CLIENT_VISIBLE";

export const COMMENT_VISIBILITIES: Mk9CommentVisibility[] = ["INTERNAL", "CLIENT_VISIBLE"];

export const COMMENT_VISIBILITY_LABEL: Record<Mk9CommentVisibility, string> = {
  INTERNAL: "Interno",
  CLIENT_VISIBLE: "Visível ao cliente",
};

export const COMMENT_MIN = 2;
export const COMMENT_MAX = 2000;

const MASK = "[removido]";

/** Padrões bloqueados. A ordem importa: do mais específico ao mais genérico. */
const REDACTIONS: Array<[RegExp, string]> = [
  // e-mail
  [/[\w.+-]+@[\w-]+\.[\w.-]{2,}/gi, MASK],
  // telefone brasileiro (com ou sem DDD/máscara)
  [/(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4}\b/g, MASK],
  // token / chave / segredo declarados
  [
    /\b(?:bearer|token|api[_-]?key|secret|senha|password|passwd|authorization)\b\s*[:=]?\s*\S+/gi,
    MASK,
  ],
  // JWT e chaves longas
  [/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g, MASK],
  [/\b(?:sb_[a-z]+_|sk_|pk_|ghp_)[A-Za-z0-9_-]{12,}\b/g, MASK],
  // SQL
  [
    /\b(select\s+[^;]*\bfrom\b|insert\s+into\b|update\s+\w+\s+set\b|delete\s+from\b|drop\s+table\b|alter\s+table\b|truncate\b|union\s+select\b|create\s+policy\b)[^\n]*/gi,
    MASK,
  ],
  // stack trace
  [/\b(?:at\s+[\w$.<>]+\s*\([^)]*\)|[\w./-]+\.(?:tsx?|jsx?|sql):\d+(?::\d+)?)/g, MASK],
  [/\b(?:Error|TypeError|ReferenceError|PostgrestError|Exception)\b\s*:\s*[^\n]*/g, MASK],
  // payload bruto (JSON/objeto grande colado)
  [/\{[^{}]{80,}\}/g, MASK],
  // link interno sensível
  [
    /\bhttps?:\/\/\S*(?:supabase\.(?:co|com)|localhost|127\.0\.0\.1|\/api\/|service_role|dashboard)\S*/gi,
    MASK,
  ],
];

export interface SanitizedComment {
  body: string;
  /** true quando algo foi removido — a interface avisa o autor. */
  redacted: boolean;
  /** Vazio significa que o comentário pode ser gravado. */
  problems: Array<"EMPTY" | "TOO_SHORT" | "TOO_LONG">;
}

export function sanitizeCommentBody(input: string | null | undefined): SanitizedComment {
  const raw = typeof input === "string" ? input : "";
  let body = raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  let redacted = false;
  for (const [pattern, replacement] of REDACTIONS) {
    const next = body.replace(pattern, replacement);
    if (next !== body) redacted = true;
    body = next;
  }
  body = body.replace(/(\[removido\]\s*){2,}/g, `${MASK} `).trim();

  const problems: SanitizedComment["problems"] = [];
  if (!body || body === MASK) problems.push("EMPTY");
  else if (body.length < COMMENT_MIN) problems.push("TOO_SHORT");
  else if (body.length > COMMENT_MAX) problems.push("TOO_LONG");

  return { body: body.slice(0, COMMENT_MAX), redacted, problems };
}

export const COMMENT_PROBLEM_MESSAGE: Record<"EMPTY" | "TOO_SHORT" | "TOO_LONG", string> = {
  EMPTY: "O comentário ficou vazio depois da remoção de dados sensíveis.",
  TOO_SHORT: "Escreva um comentário com pelo menos 2 caracteres.",
  TOO_LONG: "O comentário passou de 2000 caracteres.",
};

// ---------------------------------------------------------------------------
// Visibilidade
// ---------------------------------------------------------------------------

export interface Mk9QualityCommentView {
  id: string;
  issueId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  visibility: Mk9CommentVisibility;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
}

export function isValidVisibility(value: unknown): value is Mk9CommentVisibility {
  return value === "INTERNAL" || value === "CLIENT_VISIBLE";
}

/**
 * Visibilidade EFETIVA. CLIENTE/PROMOTOR nunca conseguem promover um
 * comentário interno: qualquer pedido deles cai para INTERNAL.
 */
export function effectiveVisibility(role: string, requested: unknown): Mk9CommentVisibility {
  if (role === "CLIENTE" || role === "PROMOTOR") return "INTERNAL";
  return isValidVisibility(requested) ? requested : "INTERNAL";
}

export function canSeeComment(role: string, visibility: string): boolean {
  if (role === "CLIENTE" || role === "PROMOTOR") return visibility === "CLIENT_VISIBLE";
  return true;
}

export function visibleComments<T extends { visibility: string }>(role: string, rows: T[]): T[] {
  return rows.filter((c) => canSeeComment(role, c.visibility));
}

/** Só o autor (ou a gestão) edita/arquiva um comentário. */
export function canEditComment(
  role: string,
  actorId: string | null,
  comment: { authorId: string | null },
): boolean {
  if (role === "CLIENTE" || role === "PROMOTOR") return false;
  if (role === "ADMIN" || role === "DEV") return true;
  return !!actorId && actorId === comment.authorId;
}
