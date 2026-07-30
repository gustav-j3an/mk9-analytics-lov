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
  | "EVIDENCE_UPDATED";

export type Mk9DetectorMode = "REALTIME" | "PERSISTED";

export const MK9_QUALITY_CATEGORIES: Mk9QualityCategory[] = [
  "CADASTRO", "FREQUENCIA", "ROTEIRO", "VISITA", "IMPORTACAO", "INTEGRIDADE", "SEGURANCA",
];
export const MK9_QUALITY_SEVERITIES: Mk9QualitySeverity[] = [
  "INFO", "AVISO", "ATENCAO", "CRITICO", "BLOQUEANTE",
];
export const MK9_QUALITY_STATUSES: Mk9QualityStatus[] = [
  "OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "RESOLVED_AUTO", "IGNORED", "REOPENED",
];

/** Categorias consideradas TÉCNICAS — nunca expostas ao papel CLIENTE. */
export const MK9_TECHNICAL_CATEGORIES: Mk9QualityCategory[] = [
  "IMPORTACAO", "INTEGRIDADE", "SEGURANCA",
];

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
  evidence: Record<string, unknown>;
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
  evidence: Record<string, unknown>;
  suggestedAction: string | null;
  source: string | null;
  firstDetectedAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  ignoredAt: string | null;
  reopenedAt: string | null;
  /** Presente apenas para papéis administrativos. */
  fingerprint?: string;
}

export interface Mk9QualityOverview {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  /** Sinais REALTIME (não persistidos) desta execução. */
  realtime: Array<{
    issueType: string;
    category: Mk9QualityCategory;
    severity: Mk9QualitySeverity;
    count: number;
    title: string;
  }>;
  scopeHash: string;
  generatedAt: string;
}
