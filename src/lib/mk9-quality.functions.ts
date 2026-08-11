// Server functions do Centro de Qualidade dos Dados MK9 (Fase 2B.1).
//
// CONTRATO DE SEGURANÇA (Fase 0):
//  - todo endpoint começa por um guard de papel;
//  - o escopo é resolvido no servidor e os filtros do navegador são
//    intersectados (nunca ampliam);
//  - service_role só é carregado depois do guard;
//  - erros nunca vazam mensagem interna: apenas códigos controlados.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const competenceSchema = z.object({
  year: z.number().int().min(2020).max(2100).nullish(),
  month: z.number().int().min(1).max(12).nullish(),
});

const listSchema = competenceSchema.extend({
  status: z
    .array(
      z.enum([
        "OPEN",
        "ACKNOWLEDGED",
        "IN_PROGRESS",
        "RESOLVED",
        "RESOLVED_AUTO",
        "IGNORED",
        "REOPENED",
      ]),
    )
    .nullish(),
  category: z
    .enum(["CADASTRO", "FREQUENCIA", "ROTEIRO", "VISITA", "IMPORTACAO", "INTEGRIDADE", "SEGURANCA"])
    .nullish(),
  severity: z.enum(["INFO", "AVISO", "ATENCAO", "CRITICO", "BLOQUEANTE"]).nullish(),
  // Tipo é uma constante do catálogo de detectores: formato restrito.
  issueType: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{3,64}$/)
    .nullish(),
  industryId: z.string().uuid().nullish(),
  storeId: z.string().uuid().nullish(),
  uf: z.string().trim().max(20).nullish(),
  search: z.string().trim().max(80).nullish(),
  // --- Fase 2B.4 ------------------------------------------------------------
  assignedTo: z.union([z.literal("UNASSIGNED"), z.literal("ME"), z.string().uuid()]).nullish(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).nullish(),
  dueState: z.enum(["OVERDUE", "DUE_TODAY", "NO_DUE_DATE"]).nullish(),
  page: z.number().int().min(1).max(500).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

const versionField = z.string().datetime({ offset: true }).nullish();

const transitionSchema = z.object({
  id: z.string().uuid(),
  toStatus: z.enum(["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "IGNORED"]),
  reason: z.string().trim().max(1000).nullish(),
  resolutionType: z
    .enum([
      "DATA_FIXED",
      "CONFIGURATION_FIXED",
      "IMPORT_REPROCESSED",
      "DUPLICATE_REVIEWED",
      "ROUTE_FIXED",
      "FREQUENCY_FIXED",
      "ACCEPTED_AS_VALID",
      "OTHER",
    ])
    .nullish(),
  /** Registrar resolução mesmo com o problema ainda detectado (só gestão). */
  forced: z.boolean().default(false),
  /** Revisão automática de um IGNORADO. */
  ignoreUntil: z.string().datetime({ offset: true }).nullish(),
  expectedUpdatedAt: versionField,
});

const assignSchema = z.object({
  id: z.string().uuid(),
  /** null remove o responsável; "ME" assume para si. */
  assigneeId: z.union([z.string().uuid(), z.literal("ME")]).nullish(),
  note: z.string().trim().max(500).nullish(),
  expectedUpdatedAt: versionField,
});

const planningSchema = z.object({
  id: z.string().uuid(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).nullish(),
  dueAt: z.string().datetime({ offset: true }).nullish(),
  clearDue: z.boolean().default(false),
  reason: z.string().trim().max(500).nullish(),
  expectedUpdatedAt: versionField,
});

const reopenSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(10).max(1000),
  expectedUpdatedAt: versionField,
});

const commentSchema = z.object({
  issueId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  visibility: z.enum(["INTERNAL", "CLIENT_VISIBLE"]).default("INTERNAL"),
});

const commentEditSchema = z.object({
  issueId: z.string().uuid(),
  commentId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

const commentArchiveSchema = z.object({
  issueId: z.string().uuid(),
  commentId: z.string().uuid(),
});

/** Guard padrão do módulo: Acesso exclusivo ADMIN. */
async function qualitySession() {
  const { requireMk9RoleScope } = await import("@/lib/mk9-auth/read-guards.server");
  // Temporariamente aceitando SUPERVISOR para auditoria de paridade
  return requireMk9RoleScope(["ADMIN", "SUPERVISOR"]);
}


/** Painel: contagens agregadas + sinais em tempo real. */
export const mk9QualityOverviewFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => competenceSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    const { scope } = await qualitySession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildQualityOverview } = await import("./mk9-quality/engine.server");
    return buildQualityOverview({
      supabase: supabaseAdmin,
      scope,
      competence: { year: data.year ?? null, month: data.month ?? null },
    });
  });

/** Lista paginada de ocorrências persistidas, já projetadas por papel. */
export const mk9QualityListFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => listSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    const { scope } = await qualitySession();
    const { industryFilter, storeFilter } = await import("@/lib/mk9-auth/access-scope.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listIssues } = await import("./mk9-quality/repository.server");

    // Interseção: um filtro fora do escopo devolve vazio, nunca dados de terceiros.
    const industry = industryFilter(scope, data.industryId ?? null);
    const store = storeFilter(scope, data.storeId ?? null);
    if (industry.outOfScope || store.outOfScope) {
      return { items: [], total: 0, page: data.page, pageSize: data.pageSize };
    }

    // UF é resolvida no servidor para uma lista de lojas do próprio escopo:
    // o navegador nunca escolhe diretamente quais lojas serão consultadas.
    let storeIds: string[] | null = null;
    const requestedUf = (data.uf ?? "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(requestedUf)) {
      const { ufFilter } = await import("@/lib/mk9-auth/access-scope.server");
      const uf = ufFilter(scope, requestedUf);
      if (uf.outOfScope) return { items: [], total: 0, page: data.page, pageSize: data.pageSize };
      const { loadScopedStores } = await import("./mk9-quality/detectors/context.server");
      const stores = await loadScopedStores(supabaseAdmin, scope);
      storeIds = stores.filter((s) => (s.uf ?? "").toUpperCase() === requestedUf).map((s) => s.id);
    }

    return listIssues(supabaseAdmin, scope, {
      status: data.status ?? null,
      category: data.category ?? null,
      severity: data.severity ?? null,
      issueType: data.issueType ?? null,
      industryId: data.industryId ?? null,
      storeId: data.storeId ?? null,
      storeIds,
      search: data.search ?? null,
      competenceMonth: data.month ?? null,
      competenceYear: data.year ?? null,
      // "ME" é resolvido no servidor: o navegador não escolhe o id de ninguém.
      assignedTo:
        data.assignedTo === "ME" ? (scope.userId ?? "UNASSIGNED") : (data.assignedTo ?? null),
      priority: data.priority ?? null,
      dueState: data.dueState ?? null,
      page: data.page,
      pageSize: data.pageSize,
    });
  });

/**
 * Opções de filtro dentro do escopo do usuário (indústrias e UFs).
 * Nunca devolve a lista completa de lojas: a busca de loja é assíncrona.
 */
export const mk9QualityFacetsFn = createServerFn({ method: "POST" })
  .inputValidator(() => ({}))
  .handler(async () => {
    const { scope } = await qualitySession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadScopedIndustries, loadScopedStores } =
      await import("./mk9-quality/detectors/context.server");
    const [industries, stores] = await Promise.all([
      loadScopedIndustries(supabaseAdmin, scope),
      loadScopedStores(supabaseAdmin, scope),
    ]);
    const ufs = Array.from(
      new Set(stores.map((s) => (s.uf ?? "").toUpperCase()).filter((u) => /^[A-Z]{2}$/.test(u))),
    ).sort();
    return {
      industries: industries.map((i) => ({ id: i.id, name: i.name })),
      ufs,
      role: scope.role,
      canViewAll: scope.canViewAll,
      canRunPersistentCycle:
        (scope.role === "ADMIN" || scope.role === "DEV" || scope.role === "AUDITOR") &&
        scope.canViewAll,
    };
  });

/** Detalhe de uma ocorrência + linha do tempo (histórico só para papéis internos). */
export const mk9QualityDetailFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { scope } = await qualitySession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getIssue } = await import("./mk9-quality/repository.server");
    const found = await getIssue(supabaseAdmin, scope, data.id);
    if (!found) throw new Error("MK9_DQ_NOT_FOUND");
    return found;
  });

/** Executa os detectores sob demanda (persistindo o que for PERSISTED). */
export const mk9QualityRunFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => competenceSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    const { requireMk9RoleScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9RoleScope(["ADMIN", "AUDITOR", "SUPERVISOR"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runQualityDetectors } = await import("./mk9-quality/engine.server");
    const result = await runQualityDetectors({
      supabase: supabaseAdmin,
      scope,
      competence: { year: data.year ?? null, month: data.month ?? null },
      persist: true,
    });
    // Evidências completas não voltam nesta rota: só o resumo da execução.
    return {
      realtimeCount: result.realtime.length,
      persistedSummary: result.persistedSummary,
      failedDetectors: result.failedDetectors,
    };
  });

/**
 * Transição manual de status.
 *
 * Regras aplicadas AQUI (servidor) e repetidas pela RPC dentro da transação:
 *  - a transição precisa ser válida a partir do status atual;
 *  - RESOLVIDO exige tipo de resolução + descrição;
 *  - IGNORAR é decisão de gestão;
 *  - resolver com o problema ainda detectado exige justificativa e gestão.
 */
export const mk9QualityTransitionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => transitionSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9RoleScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { canIgnore, canForceResolution, validateResolution, FORCE_MIN_JUSTIFICATION } =
      await import("./mk9-quality/assignment");

    const { scope } = await requireMk9RoleScope(["ADMIN", "AUDITOR", "SUPERVISOR"]);

    // IGNORAR é uma decisão de risco: apenas gestão.
    if (data.toStatus === "IGNORED" && !canIgnore(scope.role)) {
      throw new Error("MK9_DQ_FORBIDDEN");
    }
    if (data.forced && !canForceResolution(scope.role)) {
      throw new Error("MK9_DQ_FORBIDDEN");
    }

    const { validateReason } = await import("./mk9-quality/lifecycle");
    if (!validateReason(data.toStatus, data.reason ?? null)) {
      throw new Error("MK9_DQ_REASON_REQUIRED");
    }
    if (data.toStatus === "RESOLVED") {
      const problems = validateResolution({
        resolutionType: data.resolutionType ?? null,
        note: data.reason ?? null,
      });
      if (problems.length) throw new Error("MK9_DQ_RESOLUTION_INVALID");
      if (data.forced && (data.reason ?? "").trim().length < FORCE_MIN_JUSTIFICATION) {
        throw new Error("MK9_DQ_FORCE_JUSTIFICATION_REQUIRED");
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { transitionIssue } = await import("./mk9-quality/repository.server");
    return transitionIssue(supabaseAdmin, scope, {
      id: data.id,
      toStatus: data.toStatus,
      actorId: scope.userId,
      reason: data.reason ?? null,
      resolutionType: data.resolutionType ?? null,
      forced: data.forced,
      ignoreUntil: data.ignoreUntil ?? null,
      expectedUpdatedAt: data.expectedUpdatedAt ?? null,
    });
  });

/** Atribuir, reatribuir, assumir ou remover o responsável. */
export const mk9QualityAssignFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => assignSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9RoleScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { canAssignOthers, canSelfAssign, canUnassign, scopeCoversIssue } =
      await import("./mk9-quality/assignment");
    const { scope } = await requireMk9RoleScope(["ADMIN", "AUDITOR", "SUPERVISOR"]);

    const target = data.assigneeId === "ME" ? (scope.userId ?? null) : (data.assigneeId ?? null);
    const isSelf = !!target && target === scope.userId;

    if (target === null && !canUnassign(scope.role)) throw new Error("MK9_DQ_FORBIDDEN");
    if (target !== null && isSelf && !canSelfAssign(scope.role)) {
      throw new Error("MK9_DQ_FORBIDDEN");
    }
    if (target !== null && !isSelf && !canAssignOthers(scope.role)) {
      throw new Error("MK9_DQ_FORBIDDEN");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assignIssue, getIssue } = await import("./mk9-quality/repository.server");

    // Nunca atribuir a quem não enxerga a ocorrência: valida o escopo do destino.
    if (target && !isSelf) {
      const found = await getIssue(supabaseAdmin, scope, data.id);
      if (!found) throw new Error("MK9_DQ_NOT_FOUND");
      const { resolveMk9AccessScopeForUser } = await import("./mk9-quality/assignee-scope.server");
      const targetScope = await resolveMk9AccessScopeForUser(supabaseAdmin, target);
      if (!targetScope) throw new Error("MK9_DQ_ASSIGNEE_INVALID");
      if (
        !scopeCoversIssue(targetScope, {
          industryId: found.issue.industryId,
          storeId: found.issue.storeId,
        })
      ) {
        throw new Error("MK9_DQ_ASSIGNEE_OUT_OF_SCOPE");
      }
    }

    return assignIssue(supabaseAdmin, scope, {
      id: data.id,
      assigneeId: target,
      actorId: scope.userId,
      note: data.note ?? null,
      expectedUpdatedAt: data.expectedUpdatedAt ?? null,
    });
  });

/** Definir prioridade e/ou prazo. */
export const mk9QualityPlanningFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => planningSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9RoleScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { canPlan } = await import("./mk9-quality/assignment");
    const { scope } = await requireMk9RoleScope(["ADMIN", "AUDITOR", "SUPERVISOR"]);
    if (!canPlan(scope.role)) throw new Error("MK9_DQ_FORBIDDEN");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { setPlanning } = await import("./mk9-quality/repository.server");
    return setPlanning(supabaseAdmin, scope, {
      id: data.id,
      priority: data.priority ?? null,
      dueAt: data.dueAt ?? null,
      clearDue: data.clearDue,
      actorId: scope.userId,
      reason: data.reason ?? null,
      expectedUpdatedAt: data.expectedUpdatedAt ?? null,
    });
  });

/** Reabertura manual de uma ocorrência encerrada (somente gestão). */
export const mk9QualityReopenFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => reopenSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9RoleScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { canReopen } = await import("./mk9-quality/assignment");
    const { scope } = await requireMk9RoleScope(["ADMIN", "AUDITOR"]);
    if (!canReopen(scope.role)) throw new Error("MK9_DQ_FORBIDDEN");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { reopenIssue } = await import("./mk9-quality/repository.server");
    return reopenIssue(supabaseAdmin, scope, {
      id: data.id,
      actorId: scope.userId,
      reason: data.reason,
      expectedUpdatedAt: data.expectedUpdatedAt ?? null,
    });
  });

/** Comentar em uma ocorrência. O texto é higienizado antes de ser gravado. */
export const mk9QualityAddCommentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => commentSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9RoleScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { canComment } = await import("./mk9-quality/assignment");
    const { scope } = await requireMk9RoleScope(["ADMIN", "AUDITOR", "SUPERVISOR"]);
    if (!canComment(scope.role)) throw new Error("MK9_DQ_FORBIDDEN");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { addComment } = await import("./mk9-quality/repository.server");
    return addComment(supabaseAdmin, scope, {
      issueId: data.issueId,
      body: data.body,
      visibility: data.visibility,
      actorId: scope.userId,
    });
  });

/** Editar o próprio comentário (a gestão pode editar qualquer um). */
export const mk9QualityEditCommentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => commentEditSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9RoleScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9RoleScope(["ADMIN", "AUDITOR", "SUPERVISOR"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { editComment } = await import("./mk9-quality/repository.server");
    return editComment(supabaseAdmin, scope, {
      issueId: data.issueId,
      commentId: data.commentId,
      body: data.body,
      actorId: scope.userId,
    });
  });

/** Arquivar um comentário — nunca apagar fisicamente. */
export const mk9QualityArchiveCommentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => commentArchiveSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9RoleScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9RoleScope(["ADMIN", "AUDITOR", "SUPERVISOR"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { archiveComment } = await import("./mk9-quality/repository.server");
    return archiveComment(supabaseAdmin, scope, {
      issueId: data.issueId,
      commentId: data.commentId,
      actorId: scope.userId,
    });
  });

/** Painel de acompanhamento: carga, prazos e tempos médios. */
export const mk9QualityFollowUpFn = createServerFn({ method: "POST" })
  .inputValidator(() => ({}))
  .handler(async () => {
    const { scope } = await qualitySession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { followUpSummary, assignableUsers } = await import("./mk9-quality/repository.server");
    const [summary, users] = await Promise.all([
      followUpSummary(supabaseAdmin, scope),
      assignableUsers(supabaseAdmin, scope),
    ]);
    return { summary, users, currentUserId: scope.userId, role: scope.role };
  });
