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
import { scopeCoversIssue } from "./assignment";
import {
  effectiveVisibility,
  sanitizeCommentBody,
  visibleComments,
  type Mk9QualityCommentView,
} from "./comments";
import { evidenceForClient, sanitizeEvidence } from "./evidence";
import type { FingerprintedIssue } from "./fingerprint";
import { compareQueue, isDueToday, isOverdue, slaAverages } from "./sla";
import type {
  Mk9Competence,
  Mk9QualityAssignableUser,
  Mk9QualityDiagnostic,
  Mk9QualityFollowUpSummary,
  Mk9QualityIssueView,
  Mk9QualityOverview,
  Mk9QualityStatus,
} from "./types";

import { MK9_TECHNICAL_CATEGORIES } from "./types";

/** Estados considerados "em aberto" para prazo e carga de trabalho. */
const OPEN_STATUSES = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "REOPENED"];

const LIST_COLUMNS =
  "id, category, issue_type, severity, status, entity_type, entity_id, peer_entity_id, " +
  "industry_id, store_id, promoter_id, import_id, competence_month, competence_year, " +
  "title, description, evidence, suggested_action, source, fingerprint, " +
  "first_detected_at, last_seen_at, resolved_at, ignored_at, reopened_at, " +
  "assigned_to_user_id, assigned_at, assignment_note, priority, due_at, " +
  "acknowledged_at, started_at, ignore_until, resolution_type, resolution_note, " +
  "resolution_forced, last_comment_at, updated_at";

/** Colunas leves do overview — evidência NUNCA é carregada para gerar cards. */
const OVERVIEW_COLUMNS = "category, severity, status, issue_type, industry_id, store_id";

/** Colunas leves do painel de acompanhamento (sem evidência, sem texto livre). */
const FOLLOWUP_COLUMNS =
  "status, severity, priority, due_at, assigned_to_user_id, first_detected_at, " +
  "acknowledged_at, resolved_at";

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
    assignedToUserId: row.assigned_to_user_id ?? null,
    assignedToName: row.assigned_to_name ?? null,
    assignedAt: row.assigned_at ?? null,
    assignmentNote: isClient ? null : (row.assignment_note ?? null),
    priority: row.priority ?? "NORMAL",
    dueAt: row.due_at ?? null,
    acknowledgedAt: row.acknowledged_at ?? null,
    startedAt: row.started_at ?? null,
    ignoreUntil: row.ignore_until ?? null,
    resolutionType: row.resolution_type ?? null,
    resolutionNote: isClient ? null : (row.resolution_note ?? null),
    resolutionForced: row.resolution_forced === true,
    lastCommentAt: row.last_comment_at ?? null,
    lastCommentPreview: row.last_comment_preview ?? null,
    updatedAt: row.updated_at ?? row.last_seen_at,
  };
  if (isAdminLike(scope)) view.fingerprint = row.fingerprint;
  return view;
}

/**
 * Nomes dos responsáveis. Consulta separada e mínima: só `user_id` e `name`,
 * nunca e-mail ou telefone (dado pessoal fora do necessário).
 */
export async function attachAssigneeNames(
  supabase: any,
  scope: Mk9AccessScope,
  rows: Mk9QualityIssueView[],
): Promise<Mk9QualityIssueView[]> {
  if (scope.role === "CLIENTE" || scope.role === "PROMOTOR") {
    return rows.map((r) => ({ ...r, assignedToName: null }));
  }
  const ids = Array.from(
    new Set(rows.map((r) => r.assignedToUserId).filter((v): v is string => !!v)),
  );
  if (!ids.length) return rows;

  const { data } = await supabase
    .from("mk9_profiles")
    .select("user_id, name")
    .in("user_id", ids);

  const names = new Map<string, string>();
  for (const p of (data ?? []) as any[]) names.set(p.user_id, p.name ?? "Sem nome");
  return rows.map((r) => ({
    ...r,
    assignedToName: r.assignedToUserId ? (names.get(r.assignedToUserId) ?? "Usuário") : null,
  }));
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
  // --- Fase 2B.4 ------------------------------------------------------------
  /** UUID do responsável, ou "UNASSIGNED" para sem responsável. */
  assignedTo?: string | null;
  priority?: string | null;
  /** OVERDUE | DUE_TODAY | NO_DUE_DATE */
  dueState?: string | null;
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

  // --- Fase 2B.4: acompanhamento -------------------------------------------
  if (filters.assignedTo === "UNASSIGNED") q = q.is("assigned_to_user_id", null);
  else if (filters.assignedTo) q = q.eq("assigned_to_user_id", filters.assignedTo);
  if (filters.priority) q = q.eq("priority", filters.priority);
  if (filters.dueState === "OVERDUE") {
    q = q.lt("due_at", new Date().toISOString()).in("status", OPEN_STATUSES);
  } else if (filters.dueState === "DUE_TODAY") {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    q = q
      .gte("due_at", now.toISOString())
      .lte("due_at", end.toISOString())
      .in("status", OPEN_STATUSES);
  } else if (filters.dueState === "NO_DUE_DATE") {
    q = q.is("due_at", null);
  }

  const from = (filters.page - 1) * filters.pageSize;
  const { data, error, count } = await q
    .order("last_seen_at", { ascending: false })
    .range(from, from + filters.pageSize - 1);
  if (error) throw new Error("MK9_DQ_LIST_FAILED");

  // Paginação estável no banco (last_seen_at) + fila operacional na página
  // entregue à interface: atraso → prioridade → gravidade → recência.
  const now = new Date();
  const items = (data ?? [])
    .map((row: any) => projectIssue(scope, row))
    .sort((a: Mk9QualityIssueView, b: Mk9QualityIssueView) => compareQueue(a, b, now));

  return {
    items: await attachAssigneeNames(supabase, scope, items),
    total: count ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}


export async function getIssue(
  supabase: any,
  scope: Mk9AccessScope,
  id: string,
): Promise<{
  issue: Mk9QualityIssueView;
  events: any[];
  comments: Mk9QualityCommentView[];
} | null> {
  const { data, error } = await applyScope(
    supabase.from("mk9_data_quality_issues").select(LIST_COLUMNS),
    scope,
  )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("MK9_DQ_GET_FAILED");
  if (!data) return null;

  const [issue] = await attachAssigneeNames(supabase, scope, [projectIssue(scope, data)]);
  const comments = await listComments(supabase, scope, id);

  // Histórico técnico é informação administrativa: CLIENTE/PROMOTOR não recebe.
  if (scope.role === "CLIENTE" || scope.role === "PROMOTOR") {
    return { issue, events: [], comments };
  }

  const { data: events } = await supabase
    .from("mk9_data_quality_issue_events")
    .select("id, event_type, from_status, to_status, reason, actor_id, created_at")
    .eq("issue_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  return { issue, events: events ?? [], comments };
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


/**
 * Transição manual (Fase 2B.4). A RPC v2 valida transição, justificativa,
 * revalidação e concorrência otimista dentro da transação.
 */
export async function transitionIssue(
  supabase: any,
  scope: Mk9AccessScope,
  params: {
    id: string;
    toStatus: string;
    actorId: string | null;
    reason?: string | null;
    resolutionType?: string | null;
    forced?: boolean;
    ignoreUntil?: string | null;
    expectedUpdatedAt?: string | null;
  },
): Promise<Mk9QualityIssueView> {
  // Defesa em profundidade: a ocorrência precisa estar dentro do escopo.
  const found = await getIssue(supabase, scope, params.id);
  if (!found) throw new Error("MK9_DQ_NOT_FOUND");

  const { data, error } = await supabase.rpc("mk9_quality_transition_issue_v2", {
    _issue_id: params.id,
    _to_status: params.toStatus,
    _actor_id: params.actorId,
    _reason: params.reason ?? null,
    _resolution_type: params.resolutionType ?? null,
    _forced: params.forced === true,
    _ignore_until: params.ignoreUntil ?? null,
    _expected_updated_at: params.expectedUpdatedAt ?? null,
  });
  if (error) throw new Error(mapRpcError(error, "MK9_DQ_TRANSITION_FAILED"));
  const [view] = await attachAssigneeNames(supabase, scope, [
    projectIssue(scope, Array.isArray(data) ? data[0] : data),
  ]);
  return view;
}

/** Traduz o código de erro da RPC sem devolver detalhe técnico do banco. */
function mapRpcError(error: any, fallback: string): string {
  const message = String(error?.message ?? "");
  const known = [
    "MK9_DQ_NOT_FOUND",
    "MK9_DQ_INVALID_TRANSITION",
    "MK9_DQ_REASON_REQUIRED",
    "MK9_DQ_RESOLUTION_TYPE_REQUIRED",
    "MK9_DQ_ALREADY_OPEN",
    "MK9_DQ_STALE",
    "MK9_DQ_COMMENT_NOT_FOUND",
  ];
  return known.find((code) => message.includes(code)) ?? fallback;
}

// ---------------------------------------------------------------------------
// Responsabilidade e planejamento
// ---------------------------------------------------------------------------

export async function assignIssue(
  supabase: any,
  scope: Mk9AccessScope,
  params: {
    id: string;
    assigneeId: string | null;
    actorId: string | null;
    note?: string | null;
    expectedUpdatedAt?: string | null;
  },
): Promise<Mk9QualityIssueView> {
  const found = await getIssue(supabase, scope, params.id);
  if (!found) throw new Error("MK9_DQ_NOT_FOUND");

  const { data, error } = await supabase.rpc("mk9_quality_assign_issue", {
    _issue_id: params.id,
    _assignee_id: params.assigneeId,
    _actor_id: params.actorId,
    _note: params.note ?? null,
    _expected_updated_at: params.expectedUpdatedAt ?? null,
  });
  if (error) throw new Error(mapRpcError(error, "MK9_DQ_ASSIGN_FAILED"));
  const [view] = await attachAssigneeNames(supabase, scope, [
    projectIssue(scope, Array.isArray(data) ? data[0] : data),
  ]);
  return view;
}

export async function setPlanning(
  supabase: any,
  scope: Mk9AccessScope,
  params: {
    id: string;
    priority?: string | null;
    dueAt?: string | null;
    clearDue?: boolean;
    actorId: string | null;
    reason?: string | null;
    expectedUpdatedAt?: string | null;
  },
): Promise<Mk9QualityIssueView> {
  const found = await getIssue(supabase, scope, params.id);
  if (!found) throw new Error("MK9_DQ_NOT_FOUND");

  const { data, error } = await supabase.rpc("mk9_quality_set_planning", {
    _issue_id: params.id,
    _priority: params.priority ?? null,
    _due_at: params.dueAt ?? null,
    _clear_due: params.clearDue === true,
    _actor_id: params.actorId,
    _reason: params.reason ?? null,
    _expected_updated_at: params.expectedUpdatedAt ?? null,
  });
  if (error) throw new Error(mapRpcError(error, "MK9_DQ_PLANNING_FAILED"));
  const [view] = await attachAssigneeNames(supabase, scope, [
    projectIssue(scope, Array.isArray(data) ? data[0] : data),
  ]);
  return view;
}

export async function reopenIssue(
  supabase: any,
  scope: Mk9AccessScope,
  params: {
    id: string;
    actorId: string | null;
    reason: string;
    expectedUpdatedAt?: string | null;
  },
): Promise<Mk9QualityIssueView> {
  const found = await getIssue(supabase, scope, params.id);
  if (!found) throw new Error("MK9_DQ_NOT_FOUND");

  const { data, error } = await supabase.rpc("mk9_quality_reopen_issue", {
    _issue_id: params.id,
    _actor_id: params.actorId,
    _reason: params.reason,
    _expected_updated_at: params.expectedUpdatedAt ?? null,
  });
  if (error) throw new Error(mapRpcError(error, "MK9_DQ_REOPEN_FAILED"));
  const [view] = await attachAssigneeNames(supabase, scope, [
    projectIssue(scope, Array.isArray(data) ? data[0] : data),
  ]);
  return view;
}

// ---------------------------------------------------------------------------
// Comentários
// ---------------------------------------------------------------------------

function projectComment(row: any, names: Map<string, string>): Mk9QualityCommentView {
  return {
    id: row.id,
    issueId: row.issue_id,
    authorId: row.author_id ?? null,
    authorName: row.author_id ? (names.get(row.author_id) ?? "Usuário") : "Sistema",
    body: row.body,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    edited: row.edited_at != null,
  };
}

export async function listComments(
  supabase: any,
  scope: Mk9AccessScope,
  issueId: string,
): Promise<Mk9QualityCommentView[]> {
  const { data, error } = await supabase
    .from("mk9_data_quality_issue_comments")
    .select("id, issue_id, author_id, body, visibility, created_at, updated_at, edited_at")
    .eq("issue_id", issueId)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return [];

  const rows = visibleComments(scope.role, (data ?? []) as any[]);
  const ids = Array.from(new Set(rows.map((r: any) => r.author_id).filter(Boolean))) as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("mk9_profiles")
      .select("user_id, name")
      .in("user_id", ids);
    for (const p of (profiles ?? []) as any[]) names.set(p.user_id, p.name ?? "Sem nome");
  }
  return rows.map((r: any) => projectComment(r, names));
}

export async function addComment(
  supabase: any,
  scope: Mk9AccessScope,
  params: { issueId: string; body: string; visibility?: string | null; actorId: string | null },
): Promise<Mk9QualityCommentView[]> {
  const found = await getIssue(supabase, scope, params.issueId);
  if (!found) throw new Error("MK9_DQ_NOT_FOUND");

  const sanitized = sanitizeCommentBody(params.body);
  if (sanitized.problems.length) throw new Error("MK9_DQ_COMMENT_INVALID");

  const { error } = await supabase.rpc("mk9_quality_add_comment", {
    _issue_id: params.issueId,
    _body: sanitized.body,
    _visibility: effectiveVisibility(scope.role, params.visibility),
    _actor_id: params.actorId,
  });
  if (error) throw new Error(mapRpcError(error, "MK9_DQ_COMMENT_FAILED"));
  return listComments(supabase, scope, params.issueId);
}

export async function editComment(
  supabase: any,
  scope: Mk9AccessScope,
  params: { issueId: string; commentId: string; body: string; actorId: string | null },
): Promise<Mk9QualityCommentView[]> {
  const found = await getIssue(supabase, scope, params.issueId);
  if (!found) throw new Error("MK9_DQ_NOT_FOUND");

  const sanitized = sanitizeCommentBody(params.body);
  if (sanitized.problems.length) throw new Error("MK9_DQ_COMMENT_INVALID");

  const { error } = await supabase.rpc("mk9_quality_edit_comment", {
    _comment_id: params.commentId,
    _body: sanitized.body,
    _actor_id: params.actorId,
  });
  if (error) throw new Error(mapRpcError(error, "MK9_DQ_COMMENT_FAILED"));
  return listComments(supabase, scope, params.issueId);
}

export async function archiveComment(
  supabase: any,
  scope: Mk9AccessScope,
  params: { issueId: string; commentId: string; actorId: string | null },
): Promise<Mk9QualityCommentView[]> {
  const found = await getIssue(supabase, scope, params.issueId);
  if (!found) throw new Error("MK9_DQ_NOT_FOUND");

  const { error } = await supabase.rpc("mk9_quality_archive_comment", {
    _comment_id: params.commentId,
    _actor_id: params.actorId,
  });
  if (error) throw new Error(mapRpcError(error, "MK9_DQ_COMMENT_FAILED"));
  return listComments(supabase, scope, params.issueId);
}

// ---------------------------------------------------------------------------
// Painel de acompanhamento
// ---------------------------------------------------------------------------

export async function followUpSummary(
  supabase: any,
  scope: Mk9AccessScope,
): Promise<Mk9QualityFollowUpSummary> {
  const summary: Mk9QualityFollowUpSummary = {
    unassigned: 0,
    mine: 0,
    overdue: 0,
    dueToday: 0,
    withoutDueDate: 0,
    byPriority: {},
    avgHoursToAcknowledge: null,
    avgHoursToResolve: null,
    workload: [],
  };

  const { data, error } = await applyScope(
    supabase.from("mk9_data_quality_issues").select(FOLLOWUP_COLUMNS).limit(5000),
    scope,
  );
  if (error) return summary;

  const now = new Date();
  const load = new Map<string, { open: number; overdue: number }>();

  for (const row of (data ?? []) as any[]) {
    const open = OPEN_STATUSES.includes(row.status);
    if (open) {
      const late = isOverdue({ dueAt: row.due_at, status: row.status }, now);
      if (!row.assigned_to_user_id) summary.unassigned += 1;
      if (scope.userId && row.assigned_to_user_id === scope.userId) summary.mine += 1;
      if (late) summary.overdue += 1;
      if (isDueToday({ dueAt: row.due_at, status: row.status }, now)) summary.dueToday += 1;
      if (!row.due_at) summary.withoutDueDate += 1;
      const p = row.priority ?? "NORMAL";
      summary.byPriority[p] = (summary.byPriority[p] ?? 0) + 1;
      if (row.assigned_to_user_id) {
        const entry = load.get(row.assigned_to_user_id) ?? { open: 0, overdue: 0 };
        entry.open += 1;
        if (late) entry.overdue += 1;
        load.set(row.assigned_to_user_id, entry);
      }
    }
  }

  const averages = slaAverages(
    (data ?? []).map((row: any) => ({
      firstDetectedAt: row.first_detected_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
    })),
  );
  summary.avgHoursToAcknowledge = averages.hoursToAcknowledge;
  summary.avgHoursToResolve = averages.hoursToResolve;

  // Carga por responsável — apenas papéis internos veem nomes de pessoas.
  if (load.size && scope.role !== "CLIENTE" && scope.role !== "PROMOTOR") {
    const ids = Array.from(load.keys());
    const { data: profiles } = await supabase
      .from("mk9_profiles")
      .select("user_id, name")
      .in("user_id", ids);
    const names = new Map<string, string>();
    for (const p of (profiles ?? []) as any[]) names.set(p.user_id, p.name ?? "Sem nome");
    summary.workload = ids
      .map((userId) => ({
        userId,
        name: names.get(userId) ?? "Usuário",
        open: load.get(userId)?.open ?? 0,
        overdue: load.get(userId)?.overdue ?? 0,
      }))
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open)
      .slice(0, 8);
  }

  return summary;
}

/**
 * Usuários que podem receber uma ocorrência. Devolve APENAS papéis internos
 * ativos e, para SUPERVISOR, apenas quem compartilha o mesmo escopo.
 * Nenhum e-mail ou telefone é exposto.
 */
export async function assignableUsers(
  supabase: any,
  scope: Mk9AccessScope,
): Promise<Mk9QualityAssignableUser[]> {
  if (scope.role === "CLIENTE" || scope.role === "PROMOTOR") return [];

  const { data: roleRows, error } = await supabase
    .from("mk9_user_roles")
    .select("user_id, role")
    .in("role", ["ADMIN", "AUDITOR", "SUPERVISOR"]);
  if (error) return [];

  const roleByUser = new Map<string, string>();
  for (const r of (roleRows ?? []) as any[]) {
    const current = roleByUser.get(r.user_id);
    // Mantém o papel de maior privilégio quando houver mais de um.
    const order = ["SUPERVISOR", "AUDITOR", "ADMIN"];
    if (!current || order.indexOf(r.role) > order.indexOf(current)) {
      roleByUser.set(r.user_id, r.role);
    }
  }
  const ids = Array.from(roleByUser.keys());
  if (!ids.length) return [];

  const { data: profiles } = await supabase
    .from("mk9_profiles")
    .select("user_id, name, active")
    .in("user_id", ids)
    .eq("active", true);

  return ((profiles ?? []) as any[])
    .map((p) => ({
      userId: p.user_id,
      name: p.name ?? "Sem nome",
      role: roleByUser.get(p.user_id) ?? "SUPERVISOR",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Reexportado para o servidor validar escopo antes de atribuir. */
export { scopeCoversIssue };

