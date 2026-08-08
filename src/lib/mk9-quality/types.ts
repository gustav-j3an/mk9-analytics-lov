/**
 * MK9 — Fase 2B.1: contratos do Centro de Qualidade dos Dados.
 *
 * Modelo híbrido aprovado na Fase 2A:
 *   - REALTIME  → calculado sob demanda, sem histórico;
 *   - PERSISTED → upsert por fingerprint, com ciclo de vida e histórico.
 *
 * Nada aqui importa Supabase: é um módulo portátil (tipos + contratos).
 */
import type { Mk9AccessScope } from "@/lib/mk9-auth/access-scope.server";

export type Mk9QualityCategory =
  | "CADASTRO"
  | "FREQUENCIA"
  | "ROTEIRO"
  | "VISITA"
  | "IMPORTACAO"
  | "INTEGRIDADE"
  | "SEGURANCA";

export type Mk9QualitySeverity = "INFO" | "AVISO" | "ATENCAO" | "CRITICO" | "BLOQUEANTE";

export type Mk9QualityStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "RESOLVED_AUTO"
  | "IGNORED"
  | "REOPENED";

export type Mk9QualityEventType =
  | "DETECTED"
  | "SEEN_AGAIN"
  | "ACKNOWLEDGED"
  | "STARTED"
  | "RESOLVED"
  | "RESOLVED_AUTO"
  | "IGNORED"
  | "REOPENED"
  | "EVIDENCE_UPDATED"
  | "ASSIGNED"
  | "REASSIGNED"
  | "UNASSIGNED"
  | "DUE_DATE_SET"
  | "DUE_DATE_CHANGED"
  | "PRIORITY_CHANGED"
  | "COMMENT_ADDED"
  | "COMMENT_EDITED"
  | "COMMENT_ARCHIVED";

export type Mk9DetectorMode = "REALTIME" | "PERSISTED";

export const MK9_QUALITY_CATEGORIES: Mk9QualityCategory[] = [
  "CADASTRO",
  "FREQUENCIA",
  "ROTEIRO",
  "VISITA",
  "IMPORTACAO",
  "INTEGRIDADE",
  "SEGURANCA",
];
export const MK9_QUALITY_SEVERITIES: Mk9QualitySeverity[] = [
  "INFO",
  "AVISO",
  "ATENCAO",
  "CRITICO",
  "BLOQUEANTE",
];
export const MK9_QUALITY_STATUSES: Mk9QualityStatus[] = [
  "OPEN",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "RESOLVED",
  "RESOLVED_AUTO",
  "IGNORED",
  "REOPENED",
];

/** Categorias consideradas TÉCNICAS — nunca expostas ao papel CLIENTE. */
export const MK9_TECHNICAL_CATEGORIES: Mk9QualityCategory[] = [
  "IMPORTACAO",
  "INTEGRIDADE",
  "SEGURANCA",
];

/** Evidência é sempre JSON puro — garante serialização segura pela rede. */
export type Mk9JsonValue =
  | string
  | number
  | boolean
  | null
  | Mk9JsonValue[]
  | { [key: string]: Mk9JsonValue };

export type Mk9Evidence = Record<string, Mk9JsonValue>;

export interface Mk9Competence {
  month: number | null;
  year: number | null;
}

/**
 * Ocorrência detectada por um detector, antes de virar linha no banco.
 * `fingerprintParts` = identidade do problema (estável).
 * `contextParts`     = estado atual do problema (muda quando o cenário muda).
 */
export interface DetectedIssue {
  category: Mk9QualityCategory;
  issueType: string;
  severity: Mk9QualitySeverity;
  entityType: string;
  entityId?: string | null;
  peerEntityId?: string | null;
  industryId?: string | null;
  storeId?: string | null;
  promoterId?: string | null;
  supervisorId?: string | null;
  importId?: string | null;
  competence?: Mk9Competence | null;
  title: string;
  description: string;
  evidence: Mk9Evidence;
  suggestedAction?: string | null;
  source: string;
  fingerprintParts: Record<string, unknown>;
  contextParts: Record<string, unknown>;
}

export interface Mk9QualityDetectorContext {
  /** Cliente já autorizado (service_role atrás de um guard de papel). */
  supabase: any;
  /** Escopo resolvido no servidor — filtros do cliente nunca ampliam. */
  scope: Mk9AccessScope;
  competence: Mk9Competence;
}

export interface Mk9DataQualityDetector {
  id: string;
  category: Mk9QualityCategory;
  mode: Mk9DetectorMode;
  /** Tipos que este detector "possui" — usados na auto-resolução. */
  issueTypes: string[];
  execute(context: Mk9QualityDetectorContext): Promise<DetectedIssue[]>;
}

/** Ocorrência já projetada para a UI (evidence sanitizada e filtrada por papel). */
export interface Mk9QualityIssueView {
  id: string;
  category: Mk9QualityCategory;
  issueType: string;
  severity: Mk9QualitySeverity;
  status: Mk9QualityStatus;
  entityType: string;
  entityId: string | null;
  peerEntityId: string | null;
  industryId: string | null;
  storeId: string | null;
  promoterId: string | null;
  importId: string | null;
  competenceMonth: number | null;
  competenceYear: number | null;
  title: string;
  description: string;
  evidence: Mk9Evidence;
  suggestedAction: string | null;
  source: string | null;
  firstDetectedAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  ignoredAt: string | null;
  reopenedAt: string | null;
  // --- Fase 2B.4: acompanhamento operacional -------------------------------
  assignedToUserId: string | null;
  assignedToName: string | null;
  assignedAt: string | null;
  assignmentNote: string | null;
  priority: string;
  dueAt: string | null;
  acknowledgedAt: string | null;
  startedAt: string | null;
  ignoreUntil: string | null;
  resolutionType: string | null;
  resolutionNote: string | null;
  resolutionForced: boolean;
  lastCommentAt: string | null;
  lastCommentPreview: string | null;
  /** Versão otimista: enviada de volta nas ações de escrita. */
  updatedAt: string;
  /** Presente apenas para papéis administrativos. */
  fingerprint?: string;
}

/**
 * Resumo do diagnóstico (Fase 2B.3, item 18).
 *
 * Cada campo tem UMA unidade explícita — a interface nunca pode somar
 * ocorrências com lojas, visitas ou sintomas.
 */
export interface Mk9QualityDiagnostic {
  /** ocorrências consolidadas do par indústria × loja */
  pairIssues: number;
  /** sintomas somados dentro dessas ocorrências */
  pairSymptoms: number;
  noFrequency: number;
  zeroFrequency: number;
  noRoute: number;
  routeWithoutFrequency: number;
  /** visitas (não ocorrências) realizadas sem roteiro */
  visitsWithoutRoute: number;
  incompleteStoreIssues: number;
  /** lojas DISTINTAS por trás das ocorrências de cadastro incompleto */
  incompleteStores: number;
  incompleteStoreVisits: number;
}

export interface Mk9QualityOverview {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  byIssueType: Record<string, number>;
  diagnostic: Mk9QualityDiagnostic;
  /** Sinais REALTIME (não persistidos) desta execução. */
  realtime: Array<{
    issueType: string;
    category: Mk9QualityCategory;
    severity: Mk9QualitySeverity;
    count: number;
    title: string;
  }>;
  /** Detectores que falharam na última execução (interface avisa sem erro técnico). */
  failedDetectors: string[];
  detectorsExecuted: number;
  /** Ciclo com histórico foi persistido nesta execução? */
  persisted: boolean;
  scopeHash: string;
  role: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Fase 2B.4 — painel de acompanhamento
// ---------------------------------------------------------------------------

export interface Mk9QualityFollowUpSummary {
  /** ocorrências abertas sem responsável */
  unassigned: number;
  /** ocorrências abertas atribuídas ao usuário atual */
  mine: number;
  /** ocorrências abertas com prazo vencido */
  overdue: number;
  /** ocorrências abertas que vencem hoje */
  dueToday: number;
  /** ocorrências abertas sem prazo definido */
  withoutDueDate: number;
  byPriority: Record<string, number>;
  /** horas médias entre detecção e primeiro reconhecimento */
  avgHoursToAcknowledge: number | null;
  /** horas médias entre detecção e resolução */
  avgHoursToResolve: number | null;
  /** responsáveis com carga aberta, do maior para o menor */
  workload: Array<{ userId: string; name: string; open: number; overdue: number }>;
}

export interface Mk9QualityAssignableUser {
  userId: string;
  name: string;
  role: string;
}
