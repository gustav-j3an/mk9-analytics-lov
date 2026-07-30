/**
 * MK9 — Fase 2B.1: motor central do Centro de Qualidade dos Dados.
 *
 * Modelo híbrido:
 *   REALTIME  → executado sob demanda, devolvido em memória, sem histórico;
 *   PERSISTED → upsert por fingerprint via RPC transacional, com ciclo de
 *               vida completo (OPEN → ... → RESOLVED_AUTO / REOPENED).
 *
 * O motor devolve os dois em UMA resposta unificada para a futura interface.
 * Nenhum detector escreve direto no banco: tudo passa por `syncDetections`.
 */
import type { Mk9AccessScope } from "@/lib/mk9-auth/access-scope.server";
import { fingerprintIssue, type FingerprintedIssue } from "./fingerprint";
import { sanitizeEvidence } from "./evidence";
import { MK9_QUALITY_DETECTORS } from "./detectors";
import { diagnosticSummary, overviewCounts, syncDetections } from "./repository.server";
import type {
  DetectedIssue,
  Mk9Competence,
  Mk9DataQualityDetector,
  Mk9QualityOverview,
} from "./types";

export interface RunDetectorsParams {
  supabase: any;
  scope: Mk9AccessScope;
  competence: Mk9Competence;
  detectors?: Mk9DataQualityDetector[];
  /** false = apenas calcula, não persiste (útil em pré-visualizações). */
  persist?: boolean;
}

export interface RunDetectorsResult {
  realtime: FingerprintedIssue[];
  persistedSummary: Array<{
    detectorId: string;
    created: number;
    seen: number;
    reopened: number;
    autoResolved: number;
  }>;
  failedDetectors: string[];
}

/** Executa um detector isolando falhas: um detector quebrado não derruba o motor. */
async function safeExecute(
  detector: Mk9DataQualityDetector,
  ctx: { supabase: any; scope: Mk9AccessScope; competence: Mk9Competence },
): Promise<DetectedIssue[] | null> {
  try {
    const issues = await detector.execute(ctx);
    return issues.map((i) => ({ ...i, evidence: sanitizeEvidence(i.evidence) }));
  } catch (err) {
    console.error(`[MK9-QUALITY] detector ${detector.id} falhou`);
    return null;
  }
}

/**
 * Persistência só é permitida em execuções com visão COMPLETA do escopo.
 *
 * Motivo de segurança/integridade: a RPC de sincronização auto-resolve tudo
 * que o detector não devolveu. Se um usuário restrito executasse a persistência,
 * ocorrências de indústrias/UFs que ele não enxerga seriam marcadas como
 * resolvidas indevidamente. Execuções restritas continuam vendo o resultado em
 * memória — apenas não escrevem histórico.
 */
export function canPersistDetections(scope: Mk9AccessScope): boolean {
  const privileged = scope.role === "ADMIN" || scope.role === "DEV" || scope.role === "AUDITOR";
  return privileged && scope.canViewAll;
}

export async function runQualityDetectors(
  params: RunDetectorsParams,
): Promise<RunDetectorsResult> {
  const detectors = params.detectors ?? MK9_QUALITY_DETECTORS;
  const ctx = { supabase: params.supabase, scope: params.scope, competence: params.competence };
  const persist = params.persist !== false && canPersistDetections(params.scope);

  const realtime: FingerprintedIssue[] = [];
  const persistedSummary: RunDetectorsResult["persistedSummary"] = [];
  const failedDetectors: string[] = [];

  // Detectores são independentes: rodam em paralelo, cada um isolado de falhas.
  const executed = await Promise.all(
    detectors.map(async (detector) => ({ detector, issues: await safeExecute(detector, ctx) })),
  );

  for (const { detector, issues } of executed) {
    if (issues === null) {
      failedDetectors.push(detector.id);
      continue;
    }
    const fingerprinted = issues.map(fingerprintIssue);

    if (detector.mode === "REALTIME") {
      realtime.push(...fingerprinted);
      continue;
    }

    if (!persist) {
      // Sem escrita: o resultado ainda é útil em memória para a interface.
      realtime.push(...fingerprinted);
      continue;
    }

    try {
      const result = await syncDetections(params.supabase, {
        source: detector.id,
        issueTypes: detector.issueTypes,
        detections: fingerprinted,
        competence: params.competence,
      });
      persistedSummary.push({ detectorId: detector.id, ...result });
    } catch {
      failedDetectors.push(detector.id);
    }
  }

  return { realtime, persistedSummary, failedDetectors };
}


/**
 * Overview: contagens agregadas das ocorrências persistidas + sinais REALTIME
 * da execução atual. Nunca carrega evidências para montar os cards.
 */
export async function buildQualityOverview(params: {
  supabase: any;
  scope: Mk9AccessScope;
  competence: Mk9Competence;
  /** false = não escreve histórico (usuário de escopo restrito). */
  persist?: boolean;
}): Promise<Mk9QualityOverview> {
  const persist = params.persist !== false && canPersistDetections(params.scope);
  const [counts, diagnostic, run] = await Promise.all([
    overviewCounts(params.supabase, params.scope),
    diagnosticSummary(params.supabase, params.scope),
    runQualityDetectors({ ...params, persist }),
  ]);

  const grouped = new Map<string, Mk9QualityOverview["realtime"][number]>();
  for (const issue of run.realtime) {
    const current = grouped.get(issue.issueType);
    if (current) current.count += 1;
    else
      grouped.set(issue.issueType, {
        issueType: issue.issueType,
        category: issue.category,
        severity: issue.severity,
        count: 1,
        title: issue.title,
      });
  }

  return {
    ...counts,
    diagnostic,
    realtime: Array.from(grouped.values()),
    failedDetectors: run.failedDetectors,
    detectorsExecuted: (params as any).detectors?.length ?? MK9_QUALITY_DETECTORS.length,
    persisted: persist,
    scopeHash: params.scope.scopeHash,
    role: params.scope.role,
    generatedAt: new Date().toISOString(),
  };
}

