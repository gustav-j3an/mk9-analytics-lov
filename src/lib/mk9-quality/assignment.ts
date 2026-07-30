/**
 * MK9 — Fase 2B.4: responsabilidade, permissões e regras de resolução.
 *
 * Módulo PURO. O servidor é quem decide; este arquivo concentra a REGRA para
 * que servidor, interface e testes usem exatamente a mesma fonte.
 *
 * NOTA SOBRE PAPÉIS: o modelo real do MK9 tem ADMIN, AUDITOR, SUPERVISOR,
 * CLIENTE e PROMOTOR (mais o DEV local). Não existe papel GESTOR no banco:
 * o papel de gestão é exercido por ADMIN. Nada aqui inventa papel novo.
 */
import type { Mk9AccessScope } from "@/lib/mk9-auth/access-scope.server";

export type Mk9QualityActorRole = "ADMIN" | "DEV" | "AUDITOR" | "SUPERVISOR" | "CLIENTE" | "PROMOTOR";

const MANAGERS: string[] = ["ADMIN", "DEV"];

/** Somente leitura: nunca atribui, comenta como interno, resolve ou ignora. */
export function isReadOnlyRole(role: string): boolean {
  return role === "CLIENTE" || role === "PROMOTOR";
}

/** Atribuir a OUTRA pessoa. */
export function canAssignOthers(role: string): boolean {
  return MANAGERS.includes(role) || role === "SUPERVISOR";
}

/** Assumir a ocorrência para si. AUDITOR observa, não executa tratativa. */
export function canSelfAssign(role: string): boolean {
  return MANAGERS.includes(role) || role === "SUPERVISOR";
}

/** Remover o responsável. */
export function canUnassign(role: string): boolean {
  return MANAGERS.includes(role);
}

/** Definir prioridade e prazo. */
export function canPlan(role: string): boolean {
  return MANAGERS.includes(role) || role === "SUPERVISOR";
}

/** IGNORAR é decisão de risco: apenas gestão (ADMIN). */
export function canIgnore(role: string): boolean {
  return MANAGERS.includes(role);
}

/** Registrar resolução mesmo com o problema ainda detectado. */
export function canForceResolution(role: string): boolean {
  return MANAGERS.includes(role);
}

/** Reabrir manualmente uma ocorrência encerrada. */
export function canReopen(role: string): boolean {
  return MANAGERS.includes(role);
}

/** Comentar. CLIENTE/PROMOTOR são somente leitura nesta fase. */
export function canComment(role: string): boolean {
  return !isReadOnlyRole(role);
}

/** Só papéis internos escolhem visibilidade; o padrão é sempre INTERNO. */
export function canChooseCommentVisibility(role: string): boolean {
  return !isReadOnlyRole(role);
}

// ---------------------------------------------------------------------------
// Escopo: nunca atribuir uma ocorrência a quem não enxerga aquela ocorrência
// ---------------------------------------------------------------------------

export interface IssueScopeKey {
  industryId?: string | null;
  storeId?: string | null;
  uf?: string | null;
}

/**
 * O escopo (do usuário destino) cobre a ocorrência?
 * `null` numa lista de permitidos significa "sem restrição".
 */
export function scopeCoversIssue(
  scope: Pick<Mk9AccessScope, "allowedIndustryIds" | "allowedStoreIds" | "allowedUfs">,
  issue: IssueScopeKey,
): boolean {
  if (scope.allowedIndustryIds) {
    if (!issue.industryId) return false;
    if (!scope.allowedIndustryIds.includes(issue.industryId)) return false;
  }
  if (scope.allowedStoreIds) {
    if (!issue.storeId) return false;
    if (!scope.allowedStoreIds.includes(issue.storeId)) return false;
  }
  if (scope.allowedUfs) {
    const uf = (issue.uf ?? "").toUpperCase();
    if (!uf || !scope.allowedUfs.includes(uf)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Resolução
// ---------------------------------------------------------------------------

export const RESOLUTION_TYPES = [
  "DATA_FIXED",
  "CONFIGURATION_FIXED",
  "IMPORT_REPROCESSED",
  "DUPLICATE_REVIEWED",
  "ROUTE_FIXED",
  "FREQUENCY_FIXED",
  "ACCEPTED_AS_VALID",
  "OTHER",
] as const;

export type Mk9ResolutionType = (typeof RESOLUTION_TYPES)[number];

export const RESOLUTION_LABEL: Record<Mk9ResolutionType, string> = {
  DATA_FIXED: "Dado corrigido",
  CONFIGURATION_FIXED: "Configuração corrigida",
  IMPORT_REPROCESSED: "Importação reprocessada",
  DUPLICATE_REVIEWED: "Duplicidade revisada",
  ROUTE_FIXED: "Roteiro corrigido",
  FREQUENCY_FIXED: "Frequência corrigida",
  ACCEPTED_AS_VALID: "Aceito como válido",
  OTHER: "Outro",
};

/** OTHER exige motivo detalhado; os demais exigem nota curta. */
export const RESOLUTION_MIN_NOTE = 3;
export const RESOLUTION_OTHER_MIN_NOTE = 20;

export interface ResolutionInput {
  resolutionType?: string | null;
  note?: string | null;
  severity?: string | null;
  causeConfirmed?: boolean;
}

export type ResolutionProblem =
  | "TYPE_REQUIRED"
  | "TYPE_INVALID"
  | "NOTE_REQUIRED"
  | "DETAIL_REQUIRED"
  | "CAUSE_NOT_CONFIRMED";

/** Devolve a lista de problemas — vazia significa "pode resolver". */
export function validateResolution(input: ResolutionInput): ResolutionProblem[] {
  const problems: ResolutionProblem[] = [];
  const note = (input.note ?? "").trim();

  if (!input.resolutionType) problems.push("TYPE_REQUIRED");
  else if (!(RESOLUTION_TYPES as readonly string[]).includes(input.resolutionType)) {
    problems.push("TYPE_INVALID");
  }

  if (note.length < RESOLUTION_MIN_NOTE) problems.push("NOTE_REQUIRED");
  else if (input.resolutionType === "OTHER" && note.length < RESOLUTION_OTHER_MIN_NOTE) {
    problems.push("DETAIL_REQUIRED");
  }

  if (input.causeConfirmed === false) problems.push("CAUSE_NOT_CONFIRMED");

  return problems;
}

export const RESOLUTION_PROBLEM_MESSAGE: Record<ResolutionProblem, string> = {
  TYPE_REQUIRED: "Selecione o tipo de resolução.",
  TYPE_INVALID: "Tipo de resolução inválido.",
  NOTE_REQUIRED: "Descreva o que foi feito (mínimo de 3 caracteres).",
  DETAIL_REQUIRED: "Para “Outro”, descreva o motivo em detalhe (mínimo de 20 caracteres).",
  CAUSE_NOT_CONFIRMED: "Confirme que a causa do problema foi tratada.",
};

// ---------------------------------------------------------------------------
// Revalidação antes de resolver
// ---------------------------------------------------------------------------

export interface RevalidationVerdict {
  /** O detector ainda encontra o problema? */
  stillDetected: boolean;
  /** Só a gestão pode registrar a resolução com o problema ainda presente. */
  canForce: boolean;
  requiresForceJustification: boolean;
  message: string | null;
}

export function revalidationVerdict(params: {
  stillDetected: boolean;
  role: string;
}): RevalidationVerdict {
  if (!params.stillDetected) {
    return {
      stillDetected: false,
      canForce: true,
      requiresForceJustification: false,
      message: null,
    };
  }
  return {
    stillDetected: true,
    canForce: canForceResolution(params.role),
    requiresForceJustification: true,
    message: "O problema ainda foi detectado. Deseja registrar a resolução mesmo assim?",
  };
}

export const FORCE_MIN_JUSTIFICATION = 20;
