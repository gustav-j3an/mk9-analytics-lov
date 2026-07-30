/**
 * MK9 — Fase 2B.1: repositório do Centro de Qualidade.
 *
 * CONTRATO DE SEGURANÇA (Fase 0):
 *  - toda função aqui recebe um escopo JÁ resolvido no servidor;
 *  - filtros do navegador são intersectados, nunca somados;
 *  - service_role só é usado depois de um guard de papel, e sempre com
 *    filtros de escopo aplicados explicitamente na consulta;
 *  - nenhuma remoção física: histórico e ocorrências só mudam de estado.
 */
import type { Mk9AccessScope } from "@/lib/mk9-auth/access-scope.server";
import { evidenceForClient, sanitizeEvidence } from "./evidence";
import type { FingerprintedIssue } from "./fingerprint";
import type {
  Mk9Competence,
  Mk9QualityIssueView,
  Mk9QualityOverview,
  Mk9QualityStatus,
} from "./types";
import { MK9_TECHNICAL_CATEGORIES } from "./types";

const LIST_COLUMNS =
  "id, category, issue_type, severity, status, entity_type, entity_id, peer_entity_id, " +
  "industry_id, store_id, promoter_id, import_id, competence_month, competence_year, " +
  "title, description, evidence, suggested_action, source, fingerprint, " +
  "first_detected_at, last_seen_at, resolved_at, ignored_at, reopened_at";

/** Colunas leves do overview — evidência NUNCA é carregada para gerar cards. */
const OVERVIEW_COLUMNS = "category, severity, status, industry_id, store_id";

function isAdminLike(scope: Mk9AccessScope): boolean {
  return scope.role === "ADMIN" || scope.role === "DEV" || scope.role === "AUDITOR";
}

/**
 * Neutraliza os metacaracteres do `ilike` e a vírgula/parênteses do parser do
 * PostgREST, impedindo que um termo de busca altere a estrutura do filtro.
 */
export function escapeLike(term: string): string {
  return term
    .trim()
    .slice(0, 80)
    .replace(/[\\%_(),*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


/** Aplica o escopo do servidor a uma query PostgREST. */
function applyScope(query: any, scope: Mk9AccessScope) {
  let q = query.is("archived_at", null);
  if (scope.allowedIndustryIds) {
    q = scope.allowedIndustryIds.length
      ? q.in("industry_id", scope.allowedIndustryIds)
      : q.eq("industry_id", "00000000-0000-0000-0000-000000000000");
  }
  if (scope.allowedStoreIds) {
    q = scope.allowedStoreIds.length
      ? q.in("store_id", scope.allowedStoreIds)
      : q.eq("store_id", "00000000-0000-0000-0000-000000000000");
  }
  if (scope.role === "CLIENTE") {
    q = q.not("category", "in", `(${MK9_TECHNICAL_CATEGORIES.join(",")})`);
  }
  return q;
}

/** Projeta a linha do banco para a UI, respeitando o papel. */
export function projectIssue(scope: Mk9AccessScope, row: any): Mk9QualityIssueView {
  const evidence = sanitizeEvidence((row.evidence ?? {}) as Record<string, unknown>);
  const isClient = scope.role === "CLIENTE" || scope.role === "PROMOTOR";
  const view: Mk9QualityIssueView = {
    id: row.id,
    category: row.category,
    issueType: row.issue_type,
    severity: row.severity,
    status: row.status,
    entityType: row.entity_type,
    entityId: row.entity_id ?? null,
    peerEntityId: row.peer_entity_id ?? null,
    industryId: row.industry_id ?? null,
    storeId: row.store_id ?? null,
    promoterId: row.promoter_id ?? null,
    importId: isClient ? null : (row.import_id ?? null),
    competenceMonth: row.competence_month ?? null,
    competenceYear: row.competence_year ?? null,
    title: row.title,
    description: row.description,
    evidence: isClient ? evidenceForClient(evidence) : evidence,
    suggestedAction: row.suggested_action ?? null,
    source: isClient ? null : (row.source ?? null),
    firstDetectedAt: row.first_detected_at,
    lastSeenAt: row.last_seen_at,
    resolvedAt: row.resolved_at ?? null,
    ignoredAt: row.ignored_at ?? null,
    reopenedAt: row.reopened_at ?? null,
  };
  if (isAdminLike(scope)) view.fingerprint = row.fingerprint;
  return view;
}

// ---------------------------------------------------------------------------
// Escrita (somente via RPC transacional)
// ---------------------------------------------------------------------------

export interface SyncResult {
  created: number;
  seen: number;
  reopened: number;
  autoResolved: number;
}

/**
 * Upsert por fingerprint + auto-resolução do escopo do detector, em UMA
 * transação no banco (RPC SECURITY DEFINER, service_role apenas).
 */
export async function syncDetections(
  supabase: any,
  params: {
    source: string;
    issueTypes: string[];
    detections: FingerprintedIssue[];
    competence?: Mk9Competence | null;
  },
): Promise<SyncResult> {
  const payload = params.detections.map((d) => ({
    category: d.category,
    issue_type: d.issueType,
    severity: d.severity,
    entity_type: d.entityType,
    entity_id: d.entityId ?? null,
    peer_entity_id: d.peerEntityId ?? null,
    industry_id: d.industryId ?? null,
    store_id: d.storeId ?? null,
    promoter_id: d.promoterId ?? null,
    supervisor_id: d.supervisorId ?? null,
    import_id: d.importId ?? null,
    competence_month: d.competence?.month ?? null,
    competence_year: d.competence?.year ?? null,
    title: d.title,
    description: d.description,
    evidence: sanitizeEvidence(d.evidence),
    suggested_action: d.suggestedAction ?? null,
    fingerprint: d.fingerprint,
    context_hash: d.contextHash,
  }));

  const { data, error } = await supabase.rpc("mk9_quality_sync_detections", {
    _source: params.source,
    _issue_types: params.issueTypes,
    _detections: payload,
    _competence_month: params.competence?.month ?? null,
    _competence_year: params.competence?.year ?? null,
  });
  if (error) throw new Error("MK9_DQ_SYNC_FAILED");

  const row = Array.isArray(data) ? data[0] : data;
  return {
    created: row?.created ?? 0,
    seen: row?.seen ?? 0,
    reopened: row?.reopened ?? 0,
    autoResolved: row?.auto_resolved ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export interface ListFilters {
  status?: Mk9QualityStatus[] | null;
  category?: string | null;
  severity?: string | null;
  /** Filtro por tipo de problema (ex.: OPERATION_PAIR_INTEGRITY). */
  issueType?: string | null;
  industryId?: string | null;
  storeId?: string | null;
  /** Restrição adicional de lojas (ex.: filtro por UF já resolvido no servidor). */
  storeIds?: string[] | null;
  /** Busca livre no título/descrição (nunca na evidência). */
  search?: string | null;
  competenceMonth?: number | null;
  competenceYear?: number | null;
  page: number;
  pageSize: number;
}


/** Peso de gravidade — usado para ordenar a página já carregada. */
const SEVERITY_WEIGHT: Record<string, number> = {
  BLOQUEANTE: 5,
  CRITICO: 4,
  ATENCAO: 3,
  AVISO: 2,
  INFO: 1,
};

export async function listIssues(
  supabase: any,
  scope: Mk9AccessScope,
  filters: ListFilters,
): Promise<{ items: Mk9QualityIssueView[]; total: number; page: number; pageSize: number }> {
  let q = applyScope(
    supabase.from("mk9_data_quality_issues").select(LIST_COLUMNS, { count: "exact" }),
    scope,
  );

  if (filters.status?.length) q = q.in("status", filters.status);
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.severity) q = q.eq("severity", filters.severity);
  if (filters.issueType) q = q.eq("issue_type", filters.issueType);
  // Filtros do cliente só ESTREITAM: já validados contra o escopo pelo chamador.
  if (filters.industryId) q = q.eq("industry_id", filters.industryId);
  if (filters.storeId) q = q.eq("store_id", filters.storeId);
  if (filters.storeIds) {
    q = filters.storeIds.length
      ? q.in("store_id", filters.storeIds)
      : q.eq("store_id", "00000000-0000-0000-0000-000000000000");
  }
  if (filters.search) {
    // Busca só em texto já projetado (título/descrição). Nunca na evidência,
    // que pode conter contexto técnico não destinado a todos os papéis.
    const term = escapeLike(filters.search);
    q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (filters.competenceMonth) q = q.eq("competence_month", filters.competenceMonth);
  if (filters.competenceYear) q = q.eq("competence_year", filters.competenceYear);


  const from = (filters.page - 1) * filters.pageSize;
  const { data, error, count } = await q
    .order("last_seen_at", { ascending: false })
    .range(from, from + filters.pageSize - 1);
  if (error) throw new Error("MK9_DQ_LIST_FAILED");

  // Paginação estável no banco (last_seen_at) + gravidade primeiro na página
  // entregue à interface. Sem coluna de rank, evita-se mudar o schema.
  const items = (data ?? [])
    .map((row: any) => projectIssue(scope, row))
    .sort(
      (a: Mk9QualityIssueView, b: Mk9QualityIssueView) =>
        (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0) ||
        b.lastSeenAt.localeCompare(a.lastSeenAt),
    );

  return {
    items,
    total: count ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}


export async function getIssue(
  supabase: any,
  scope: Mk9AccessScope,
  id: string,
): Promise<{ issue: Mk9QualityIssueView; events: any[] } | null> {
  const { data, error } = await applyScope(
    supabase.from("mk9_data_quality_issues").select(LIST_COLUMNS),
    scope,
  )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("MK9_DQ_GET_FAILED");
  if (!data) return null;

  const issue = projectIssue(scope, data);

  // Histórico é informação administrativa: CLIENTE/PROMOTOR não recebe.
  if (scope.role === "CLIENTE" || scope.role === "PROMOTOR") return { issue, events: [] };

  const { data: events } = await supabase
    .from("mk9_data_quality_issue_events")
    .select("id, event_type, from_status, to_status, reason, created_at")
    .eq("issue_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  return { issue, events: events ?? [] };
}

export async function overviewCounts(
  supabase: any,
  scope: Mk9AccessScope,
): Promise<
  Pick<Mk9QualityOverview, "total" | "byStatus" | "bySeverity" | "byCategory" | "byIssueType">
> {
  const { data, error } = await applyScope(
    supabase.from("mk9_data_quality_issues").select(OVERVIEW_COLUMNS),
    scope,
  ).in("status", ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "REOPENED", "IGNORED"]);
  if (error) throw new Error("MK9_DQ_OVERVIEW_FAILED");

  const byStatus: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byIssueType: Record<string, number> = {};
  for (const row of data ?? []) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + 1;
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
    byIssueType[row.issue_type] = (byIssueType[row.issue_type] ?? 0) + 1;
  }
  return { total: (data ?? []).length, byStatus, bySeverity, byCategory, byIssueType };
}

/**
 * Resumo do diagnóstico (item 18). Consulta LIMITADA a dois tipos de
 * ocorrência que precisam de leitura de evidência para separar as unidades
 * (ocorrência × loja × visita × sintoma). Nada disso vai para os cards de
 * contagem, que continuam usando apenas colunas leves.
 */
export async function diagnosticSummary(
  supabase: any,
  scope: Mk9AccessScope,
): Promise<Mk9QualityDiagnostic> {
  const empty: Mk9QualityDiagnostic = {
    pairIssues: 0,
    pairSymptoms: 0,
    noFrequency: 0,
    zeroFrequency: 0,
    noRoute: 0,
    routeWithoutFrequency: 0,
    visitsWithoutRoute: 0,
    incompleteStoreIssues: 0,
    incompleteStores: 0,
    incompleteStoreVisits: 0,
  };

  const { data, error } = await applyScope(
    supabase
      .from("mk9_data_quality_issues")
      .select("issue_type, store_id, evidence")
      .limit(2000),
    scope,
  )
    .in("status", ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "REOPENED"])
    .in("issue_type", ["OPERATION_PAIR_INTEGRITY", "INCOMPLETE_STORE_WITH_EXECUTION"]);
  if (error) return empty;

  const stores = new Set<string>();
  for (const row of (data ?? []) as any[]) {
    const evidence = (row.evidence ?? {}) as Record<string, any>;
    if (row.issue_type === "OPERATION_PAIR_INTEGRITY") {
      empty.pairIssues += 1;
      const symptoms: string[] = Array.isArray(evidence.symptoms) ? evidence.symptoms : [];
      empty.pairSymptoms += symptoms.length;
      if (symptoms.includes("NO_FREQUENCY")) empty.noFrequency += 1;
      if (symptoms.includes("ZERO_FREQUENCY")) empty.zeroFrequency += 1;
      if (symptoms.includes("NO_ROUTE")) empty.noRoute += 1;
      if (symptoms.includes("ROUTE_WITHOUT_FREQUENCY")) empty.routeWithoutFrequency += 1;
      if (symptoms.includes("VISITS_WITHOUT_ROUTE")) {
        empty.visitsWithoutRoute += Number(evidence.visitsWithoutRoute ?? 0) || 0;
      }
      continue;
    }
    empty.incompleteStoreIssues += 1;
    if (row.store_id) stores.add(row.store_id);
    empty.incompleteStoreVisits += Number(evidence.executedVisits ?? 0) || 0;
  }
  empty.incompleteStores = stores.size;
  return empty;
}


export async function transitionIssue(
  supabase: any,
  scope: Mk9AccessScope,
  params: { id: string; toStatus: string; actorId: string | null; reason?: string | null },
): Promise<Mk9QualityIssueView> {
  // Defesa em profundidade: a ocorrência precisa estar dentro do escopo.
  const found = await getIssue(supabase, scope, params.id);
  if (!found) throw new Error("MK9_DQ_NOT_FOUND");

  const { data, error } = await supabase.rpc("mk9_quality_transition_issue", {
    _issue_id: params.id,
    _to_status: params.toStatus,
    _actor_id: params.actorId,
    _reason: params.reason ?? null,
  });
  if (error) throw new Error("MK9_DQ_TRANSITION_FAILED");
  return projectIssue(scope, Array.isArray(data) ? data[0] : data);
}
