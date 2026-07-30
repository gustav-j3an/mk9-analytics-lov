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
      z.enum(["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "RESOLVED_AUTO", "IGNORED", "REOPENED"]),
    )
    .nullish(),
  category: z
    .enum(["CADASTRO", "FREQUENCIA", "ROTEIRO", "VISITA", "IMPORTACAO", "INTEGRIDADE", "SEGURANCA"])
    .nullish(),
  severity: z.enum(["INFO", "AVISO", "ATENCAO", "CRITICO", "BLOQUEANTE"]).nullish(),
  // Tipo é uma constante do catálogo de detectores: formato restrito.
  issueType: z.string().trim().regex(/^[A-Z0-9_]{3,64}$/).nullish(),
  industryId: z.string().uuid().nullish(),
  storeId: z.string().uuid().nullish(),
  page: z.number().int().min(1).max(500).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});


const transitionSchema = z.object({
  id: z.string().uuid(),
  toStatus: z.enum(["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "IGNORED"]),
  reason: z.string().trim().max(1000).nullish(),
});

/** Guard padrão do módulo: leitura operacional + escopo resolvido. */
async function qualitySession() {
  const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
  return requireMk9ReadScope();
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

    return listIssues(supabaseAdmin, scope, {
      status: data.status ?? null,
      category: data.category ?? null,
      severity: data.severity ?? null,
      issueType: data.issueType ?? null,
      industryId: data.industryId ?? null,
      storeId: data.storeId ?? null,
      competenceMonth: data.month ?? null,
      competenceYear: data.year ?? null,
      page: data.page,
      pageSize: data.pageSize,
    });

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

/** Transição manual de status, com justificativa obrigatória quando aplicável. */
export const mk9QualityTransitionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => transitionSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9RoleScope } = await import("@/lib/mk9-auth/read-guards.server");
    // IGNORAR é uma decisão de risco: restrita a ADMIN/AUDITOR.
    const allowed = data.toStatus === "IGNORED" ? ["ADMIN", "AUDITOR"] : ["ADMIN", "AUDITOR", "SUPERVISOR"];
    const { scope } = await requireMk9RoleScope(allowed as any);

    const { validateReason } = await import("./mk9-quality/lifecycle");
    if (!validateReason(data.toStatus, data.reason ?? null)) {
      throw new Error("MK9_DQ_REASON_REQUIRED");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { transitionIssue } = await import("./mk9-quality/repository.server");
    return transitionIssue(supabaseAdmin, scope, {
      id: data.id,
      toStatus: data.toStatus,
      actorId: scope.userId,
      reason: data.reason ?? null,
    });
  });
