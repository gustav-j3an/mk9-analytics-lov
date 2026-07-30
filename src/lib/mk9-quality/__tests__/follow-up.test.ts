/**
 * MK9 — Fase 2B.4: testes de acompanhamento das ocorrências.
 *
 * Cobre prazo/SLA, prioridade, permissões, resolução, reabertura e
 * higienização de comentários. Nenhum teste toca banco.
 */
import { describe, expect, it } from "vitest";

import {
  canAssignOthers,
  canForceResolution,
  canIgnore,
  canPlan,
  canReopen,
  canSelfAssign,
  canUnassign,
  isReadOnlyRole,
  revalidationVerdict,
  scopeCoversIssue,
  validateResolution,
} from "@/lib/mk9-quality/assignment";
import {
  canEditComment,
  canSeeComment,
  effectiveVisibility,
  sanitizeCommentBody,
  visibleComments,
} from "@/lib/mk9-quality/comments";
import {
  allowedTransitions,
  canReopenStatus,
  canTransition,
  validateReopenReason,
} from "@/lib/mk9-quality/lifecycle";
import {
  compareQueue,
  defaultDueAt,
  dueLabel,
  ignoreExpired,
  isDueToday,
  isOverdue,
  overdueDays,
  priorityWeight,
  slaAverages,
} from "@/lib/mk9-quality/sla";

// ---------------------------------------------------------------------------
// A) SLA e prazo
// ---------------------------------------------------------------------------

describe("A) prazo padrão por severidade", () => {
  // quarta-feira, 2026-07-15
  const wed = "2026-07-15T10:00:00.000Z";

  it("BLOQUEANTE vence no mesmo dia", () => {
    expect(defaultDueAt("BLOQUEANTE", wed)).toBe("2026-07-15T23:59:59.000Z");
  });

  it("CRITICO vence no próximo dia útil", () => {
    expect(defaultDueAt("CRITICO", wed)).toBe("2026-07-16T23:59:59.000Z");
  });

  it("ATENCAO pula o fim de semana", () => {
    // quinta + 3 dias úteis = terça-feira
    expect(defaultDueAt("ATENCAO", "2026-07-16T10:00:00.000Z")).toBe("2026-07-21T23:59:59.000Z");
  });

  it("AVISO conta 5 dias úteis", () => {
    expect(defaultDueAt("AVISO", wed)).toBe("2026-07-22T23:59:59.000Z");
  });

  it("INFO não recebe prazo obrigatório", () => {
    expect(defaultDueAt("INFO", wed)).toBeNull();
  });

  it("sexta-feira com 1 dia útil cai na segunda", () => {
    expect(defaultDueAt("CRITICO", "2026-07-17T08:00:00.000Z")).toBe("2026-07-20T23:59:59.000Z");
  });
});

describe("B) atraso", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");

  it("ocorrência aberta com prazo passado está vencida", () => {
    expect(isOverdue({ dueAt: "2026-07-18T23:59:59.000Z", status: "OPEN" }, now)).toBe(true);
    expect(overdueDays({ dueAt: "2026-07-18T23:59:59.000Z", status: "OPEN" }, now)).toBe(2);
  });

  it("ocorrência encerrada nunca aparece como vencida", () => {
    for (const status of ["RESOLVED", "RESOLVED_AUTO", "IGNORED"]) {
      expect(isOverdue({ dueAt: "2026-07-01T00:00:00.000Z", status }, now)).toBe(false);
      expect(overdueDays({ dueAt: "2026-07-01T00:00:00.000Z", status }, now)).toBe(0);
    }
  });

  it("sem prazo não há atraso", () => {
    expect(isOverdue({ dueAt: null, status: "OPEN" }, now)).toBe(false);
    expect(dueLabel({ dueAt: null, status: "OPEN" }, now)).toBe("Sem prazo");
  });

  it("vence hoje não é atraso", () => {
    const today = { dueAt: "2026-07-20T23:59:59.000Z", status: "IN_PROGRESS" };
    expect(isDueToday(today, now)).toBe(true);
    expect(isOverdue(today, now)).toBe(false);
    expect(dueLabel(today, now)).toBe("Vence hoje");
  });
});

describe("C) ignorar com prazo de revisão", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");

  it("ignorado com revisão vencida volta a ser cobrado", () => {
    expect(ignoreExpired({ status: "IGNORED", ignoreUntil: "2026-07-19T00:00:00.000Z" }, now)).toBe(
      true,
    );
  });

  it("ignorado com revisão futura permanece ignorado", () => {
    expect(ignoreExpired({ status: "IGNORED", ignoreUntil: "2026-08-19T00:00:00.000Z" }, now)).toBe(
      false,
    );
  });

  it("ignorado sem data de revisão permanece ignorado", () => {
    expect(ignoreExpired({ status: "IGNORED", ignoreUntil: null }, now)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D) Prioridade × severidade
// ---------------------------------------------------------------------------

describe("D) prioridade é independente da severidade", () => {
  it("prioridade tem escala própria", () => {
    expect(priorityWeight("URGENT")).toBeGreaterThan(priorityWeight("HIGH"));
    expect(priorityWeight("HIGH")).toBeGreaterThan(priorityWeight("NORMAL"));
    expect(priorityWeight("NORMAL")).toBeGreaterThan(priorityWeight("LOW"));
  });

  it("valor ausente cai em Normal, nunca em zero silencioso", () => {
    expect(priorityWeight(null)).toBe(priorityWeight("NORMAL"));
  });

  it("um AVISO urgente ordena à frente de um CRITICO normal", () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    const urgentNotice = {
      severity: "AVISO",
      priority: "URGENT",
      status: "OPEN",
      dueAt: null,
      lastSeenAt: "2026-07-19T00:00:00.000Z",
    };
    const normalCritical = {
      severity: "CRITICO",
      priority: "NORMAL",
      status: "OPEN",
      dueAt: null,
      lastSeenAt: "2026-07-19T00:00:00.000Z",
    };
    expect(compareQueue(urgentNotice, normalCritical, now)).toBeLessThan(0);
  });

  it("atraso vem antes de tudo na fila", () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    const lateLow = {
      severity: "INFO",
      priority: "LOW",
      status: "OPEN",
      dueAt: "2026-07-10T00:00:00.000Z",
      lastSeenAt: "2026-07-19T00:00:00.000Z",
    };
    const urgentOnTime = {
      severity: "BLOQUEANTE",
      priority: "URGENT",
      status: "OPEN",
      dueAt: "2026-07-30T00:00:00.000Z",
      lastSeenAt: "2026-07-19T00:00:00.000Z",
    };
    expect(compareQueue(lateLow, urgentOnTime, now)).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// E) Permissões
// ---------------------------------------------------------------------------

describe("E) permissões por papel", () => {
  it("CLIENTE e PROMOTOR são somente leitura", () => {
    for (const role of ["CLIENTE", "PROMOTOR"]) {
      expect(isReadOnlyRole(role)).toBe(true);
      expect(canAssignOthers(role)).toBe(false);
      expect(canSelfAssign(role)).toBe(false);
      expect(canPlan(role)).toBe(false);
      expect(canIgnore(role)).toBe(false);
      expect(canReopen(role)).toBe(false);
      expect(canForceResolution(role)).toBe(false);
    }
  });

  it("SUPERVISOR atribui e planeja, mas não ignora nem reabre", () => {
    expect(canAssignOthers("SUPERVISOR")).toBe(true);
    expect(canSelfAssign("SUPERVISOR")).toBe(true);
    expect(canPlan("SUPERVISOR")).toBe(true);
    expect(canIgnore("SUPERVISOR")).toBe(false);
    expect(canReopen("SUPERVISOR")).toBe(false);
    expect(canForceResolution("SUPERVISOR")).toBe(false);
    expect(canUnassign("SUPERVISOR")).toBe(false);
  });

  it("AUDITOR observa: não assume nem ignora", () => {
    expect(canSelfAssign("AUDITOR")).toBe(false);
    expect(canAssignOthers("AUDITOR")).toBe(false);
    expect(canIgnore("AUDITOR")).toBe(false);
  });

  it("ADMIN concentra as decisões de risco", () => {
    expect(canIgnore("ADMIN")).toBe(true);
    expect(canReopen("ADMIN")).toBe(true);
    expect(canForceResolution("ADMIN")).toBe(true);
    expect(canUnassign("ADMIN")).toBe(true);
  });
});

describe("F) escopo do responsável", () => {
  const issue = { industryId: "ind-1", storeId: "loja-1", uf: "SP" };

  it("escopo irrestrito cobre qualquer ocorrência", () => {
    expect(
      scopeCoversIssue(
        { allowedIndustryIds: null, allowedStoreIds: null, allowedUfs: null },
        issue,
      ),
    ).toBe(true);
  });

  it("indústria fora do escopo recusa a atribuição", () => {
    expect(
      scopeCoversIssue(
        { allowedIndustryIds: ["ind-9"], allowedStoreIds: null, allowedUfs: null },
        issue,
      ),
    ).toBe(false);
  });

  it("UF fora do escopo recusa a atribuição", () => {
    expect(
      scopeCoversIssue(
        { allowedIndustryIds: null, allowedStoreIds: null, allowedUfs: ["RJ"] },
        issue,
      ),
    ).toBe(false);
  });

  it("escopo vazio não cobre nada", () => {
    expect(
      scopeCoversIssue({ allowedIndustryIds: [], allowedStoreIds: null, allowedUfs: null }, issue),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// G) Transições e resolução
// ---------------------------------------------------------------------------

describe("G) transições permitidas", () => {
  it("aberta permite reconhecer, iniciar, resolver e ignorar", () => {
    expect(allowedTransitions("OPEN")).toEqual([
      "ACKNOWLEDGED",
      "IN_PROGRESS",
      "RESOLVED",
      "IGNORED",
    ]);
  });

  it("em andamento não volta para reconhecida", () => {
    expect(canTransition("IN_PROGRESS", "ACKNOWLEDGED")).toBe(false);
  });

  it("encerrada não aceita transição manual", () => {
    for (const status of ["RESOLVED", "RESOLVED_AUTO", "IGNORED"]) {
      expect(allowedTransitions(status)).toEqual([]);
    }
  });

  it("reabertura só existe para ocorrência encerrada", () => {
    expect(canReopenStatus("RESOLVED")).toBe(true);
    expect(canReopenStatus("IGNORED")).toBe(true);
    expect(canReopenStatus("OPEN")).toBe(false);
  });

  it("reabertura exige motivo com pelo menos 10 caracteres", () => {
    expect(validateReopenReason("voltou")).toBe(false);
    expect(validateReopenReason("problema voltou após a reimportação")).toBe(true);
  });
});

describe("H) validação da resolução", () => {
  it("exige tipo e descrição", () => {
    expect(validateResolution({})).toContain("TYPE_REQUIRED");
    expect(validateResolution({ resolutionType: "DATA_FIXED" })).toContain("NOTE_REQUIRED");
  });

  it("aceita tipo válido com descrição", () => {
    expect(
      validateResolution({ resolutionType: "DATA_FIXED", note: "cadastro da loja corrigido" }),
    ).toEqual([]);
  });

  it("“Outro” exige detalhe mais longo", () => {
    expect(validateResolution({ resolutionType: "OTHER", note: "resolvido" })).toContain(
      "DETAIL_REQUIRED",
    );
    expect(
      validateResolution({
        resolutionType: "OTHER",
        note: "tratado junto à indústria por telefone, sem alteração de cadastro",
      }),
    ).toEqual([]);
  });

  it("recusa tipo inventado", () => {
    expect(validateResolution({ resolutionType: "MAGIC", note: "qualquer coisa" })).toContain(
      "TYPE_INVALID",
    );
  });
});

describe("I) revalidação antes de resolver", () => {
  it("problema resolvido de fato não pede justificativa", () => {
    const verdict = revalidationVerdict({ stillDetected: false, role: "SUPERVISOR" });
    expect(verdict.requiresForceJustification).toBe(false);
    expect(verdict.message).toBeNull();
  });

  it("problema ainda detectado: supervisor não força", () => {
    const verdict = revalidationVerdict({ stillDetected: true, role: "SUPERVISOR" });
    expect(verdict.canForce).toBe(false);
    expect(verdict.requiresForceJustification).toBe(true);
  });

  it("problema ainda detectado: gestão pode registrar com justificativa", () => {
    const verdict = revalidationVerdict({ stillDetected: true, role: "ADMIN" });
    expect(verdict.canForce).toBe(true);
    expect(verdict.requiresForceJustification).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// J) Comentários
// ---------------------------------------------------------------------------

describe("J) higienização de comentários", () => {
  it("mantém texto operacional normal", () => {
    const out = sanitizeCommentBody("Falei com o supervisor, roteiro será ajustado amanhã.");
    expect(out.redacted).toBe(false);
    expect(out.problems).toEqual([]);
    expect(out.body).toContain("roteiro será ajustado");
  });

  it("remove e-mail e telefone", () => {
    const out = sanitizeCommentBody("Contato joao@mk9.com.br ou (11) 98765-4321");
    expect(out.redacted).toBe(true);
    expect(out.body).not.toContain("@mk9.com.br");
    expect(out.body).not.toContain("98765");
  });

  it("remove SQL colado", () => {
    const out = sanitizeCommentBody("rodei select * from mk9_stores where id = 1 e vi o erro");
    expect(out.redacted).toBe(true);
    expect(out.body.toLowerCase()).not.toContain("from mk9_stores");
  });

  it("remove token e chave", () => {
    const out = sanitizeCommentBody("use token: sb_secret_abc123def456ghi para testar");
    expect(out.redacted).toBe(true);
    expect(out.body).not.toContain("sb_secret_abc123def456ghi");
  });

  it("remove stack trace", () => {
    const out = sanitizeCommentBody("TypeError: cannot read x at foo (index.tsx:12:3)");
    expect(out.redacted).toBe(true);
    expect(out.body).not.toContain("index.tsx:12");
  });

  it("comentário que vira só remoção é recusado", () => {
    const out = sanitizeCommentBody("joao@mk9.com.br");
    expect(out.problems).toContain("EMPTY");
  });

  it("recusa comentário longo demais", () => {
    const out = sanitizeCommentBody("a".repeat(2500));
    expect(out.problems).toContain("TOO_LONG");
  });
});

describe("K) visibilidade dos comentários", () => {
  const rows = [
    { id: "1", visibility: "INTERNAL" },
    { id: "2", visibility: "CLIENT_VISIBLE" },
  ];

  it("CLIENTE só vê o que foi marcado como visível", () => {
    expect(visibleComments("CLIENTE", rows).map((r) => r.id)).toEqual(["2"]);
    expect(canSeeComment("CLIENTE", "INTERNAL")).toBe(false);
  });

  it("papéis internos veem tudo", () => {
    expect(visibleComments("SUPERVISOR", rows)).toHaveLength(2);
    expect(visibleComments("ADMIN", rows)).toHaveLength(2);
  });

  it("CLIENTE nunca consegue publicar comentário visível ao cliente", () => {
    expect(effectiveVisibility("CLIENTE", "CLIENT_VISIBLE")).toBe("INTERNAL");
  });

  it("visibilidade inválida cai para interno", () => {
    expect(effectiveVisibility("ADMIN", "PUBLIC")).toBe("INTERNAL");
    expect(effectiveVisibility("ADMIN", "CLIENT_VISIBLE")).toBe("CLIENT_VISIBLE");
  });

  it("só o autor ou a gestão edita", () => {
    const comment = { authorId: "u1" };
    expect(canEditComment("SUPERVISOR", "u1", comment)).toBe(true);
    expect(canEditComment("SUPERVISOR", "u2", comment)).toBe(false);
    expect(canEditComment("ADMIN", "u2", comment)).toBe(true);
    expect(canEditComment("CLIENTE", "u1", comment)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// L) Métricas de SLA
// ---------------------------------------------------------------------------

describe("L) tempos médios", () => {
  it("calcula média apenas com o que tem data", () => {
    const result = slaAverages([
      {
        firstDetectedAt: "2026-07-01T00:00:00.000Z",
        acknowledgedAt: "2026-07-01T02:00:00.000Z",
        resolvedAt: "2026-07-02T00:00:00.000Z",
      },
      {
        firstDetectedAt: "2026-07-01T00:00:00.000Z",
        acknowledgedAt: "2026-07-01T04:00:00.000Z",
        resolvedAt: null,
      },
    ]);
    expect(result.hoursToAcknowledge).toBe(3);
    expect(result.hoursToResolve).toBe(24);
  });

  it("sem amostra devolve nulo, nunca zero enganoso", () => {
    const result = slaAverages([]);
    expect(result.hoursToAcknowledge).toBeNull();
    expect(result.hoursToResolve).toBeNull();
  });
});
