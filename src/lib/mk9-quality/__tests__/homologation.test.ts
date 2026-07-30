/**
 * Fase 2B.5 — homologação final do Centro de Qualidade.
 *
 * Testes de fechamento: garantem que as travas de escopo, papel, visibilidade
 * e evidência continuam valendo mesmo quando alguém tenta forçar o caminho
 * (ID manipulado, papel errado, deep-link fora do escopo).
 *
 * Tudo puro: nenhum acesso ao banco.
 */
import { describe, expect, it } from "vitest";
import {
  canForceResolution,
  canIgnore,
  canAssignOthers,
  canSelfAssign,
  canReopen,
  isReadOnlyRole,
  scopeCoversIssue,
  validateResolution,
  revalidationVerdict,
  FORCE_MIN_JUSTIFICATION,
} from "../assignment";
import { canSeeComment, visibleComments, effectiveVisibility } from "../comments";
import { evidenceForClient, sanitizeEvidence, technicalErrorEvidence } from "../evidence";
import { navigationTarget } from "../navigation";
import { defaultDueAt, isOverdue, ignoreExpired, compareQueue } from "../sla";
import { decideOnDetection, decideOnDisappearance, canReopenStatus, validateReopenReason } from "../lifecycle";

const scope = (over: Partial<{ allowedUfs: string[] | null; allowedIndustryIds: string[] | null; allowedStoreIds: string[] | null }> = {}) => ({
  allowedUfs: null,
  allowedIndustryIds: null,
  allowedStoreIds: null,
  ...over,
});

describe("2B.5 — escopo não pode ser ampliado por ID manipulado", () => {
  it("issue de indústria fora do escopo é recusada mesmo com id válido", () => {
    expect(
      scopeCoversIssue(scope({ allowedIndustryIds: ["i1"] }), { industryId: "i2", storeId: null, uf: null }),
    ).toBe(false);
  });

  it("issue de UF fora do escopo é recusada", () => {
    expect(scopeCoversIssue(scope({ allowedUfs: ["DF"] }), { industryId: null, storeId: null, uf: "GO" })).toBe(false);
  });

  it("issue de loja fora do escopo é recusada (enumeração por ID)", () => {
    expect(
      scopeCoversIssue(scope({ allowedStoreIds: ["s1"] }), { industryId: null, storeId: "s999", uf: null }),
    ).toBe(false);
  });

  it("escopo total continua permitindo tudo", () => {
    expect(scopeCoversIssue(scope(), { industryId: "x", storeId: "y", uf: "MS" })).toBe(true);
  });
});

describe("2B.5 — papéis", () => {
  it("somente ADMIN/DEV forçam resolução de problema ainda detectado", () => {
    expect(canForceResolution("ADMIN")).toBe(true);
    for (const role of ["AUDITOR", "SUPERVISOR", "CLIENTE", "PROMOTOR"]) {
      expect(canForceResolution(role)).toBe(false);
    }
  });

  it("auditor e supervisor nunca ignoram", () => {
    expect(canIgnore("AUDITOR")).toBe(false);
    expect(canIgnore("SUPERVISOR")).toBe(false);
    expect(canIgnore("ADMIN")).toBe(true);
  });

  it("cliente e promotor são somente leitura", () => {
    for (const role of ["CLIENTE", "PROMOTOR"]) {
      expect(isReadOnlyRole(role)).toBe(true);
      expect(canAssignOthers(role)).toBe(false);
      expect(canSelfAssign(role)).toBe(false);
      expect(canReopen(role)).toBe(false);
    }
  });
});

describe("2B.5 — comentários e evidência", () => {
  it("CLIENTE nunca recebe comentário interno", () => {
    expect(canSeeComment("CLIENTE", "INTERNAL")).toBe(false);
    const rows = [{ visibility: "INTERNAL" }, { visibility: "CLIENT_VISIBLE" }];
    expect(visibleComments("CLIENTE", rows)).toHaveLength(1);
  });

  it("comentário pedido por CLIENTE nunca vira visível ao cliente", () => {
    expect(effectiveVisibility("CLIENTE", "CLIENT_VISIBLE")).toBe("INTERNAL");
  });

  it("evidência técnica nunca chega ao cliente", () => {
    const client = evidenceForClient(
      sanitizeEvidence({
        ...technicalErrorEvidence("MK9_DQ_DETECTOR_FAILED", { table: "mk9_stores" }),
        storeName: "Loja Centro",
        symptoms: ["NO_ROUTE"],
      }),
    );
    expect(JSON.stringify(client)).not.toContain("mk9_stores");
    expect(JSON.stringify(client)).not.toContain("MK9_DQ_DETECTOR_FAILED");
  });

  it("deep-link só carrega campos preenchidos, sem vazar nulos", () => {
    const target = navigationTarget({ module: "frequency", industryId: "i1", storeId: null, month: 7, year: 2026 });
    expect(target).toEqual({ module: "frequency", industryId: "i1", month: 7, year: 2026 });
  });
});

describe("2B.5 — resolução, reabertura e SLA", () => {
  it("resolução OTHER exige nota detalhada", () => {
    expect(validateResolution({ resolutionType: "OTHER", note: "ok mesmo" })).toContain("DETAIL_REQUIRED");
    expect(
      validateResolution({ resolutionType: "OTHER", note: "acordo comercial documentado com a indústria" }),
    ).toHaveLength(0);
  });

  it("resolução sem tipo ou sem nota é recusada", () => {
    expect(validateResolution({ note: "corrigido" })).toContain("TYPE_REQUIRED");
    expect(validateResolution({ resolutionType: "DATA_FIXED", note: "" })).toContain("NOTE_REQUIRED");
  });

  it("problema ainda detectado só é forçado por ADMIN", () => {
    expect(revalidationVerdict({ stillDetected: false, role: "SUPERVISOR" }).requiresForceJustification).toBe(false);
    const supervisor = revalidationVerdict({ stillDetected: true, role: "SUPERVISOR" });
    expect(supervisor.canForce).toBe(false);
    expect(supervisor.requiresForceJustification).toBe(true);
    expect(revalidationVerdict({ stillDetected: true, role: "ADMIN" }).canForce).toBe(true);
    expect(FORCE_MIN_JUSTIFICATION).toBeGreaterThanOrEqual(20);
  });

  it("reabertura exige motivo e só vale em ocorrência encerrada", () => {
    expect(canReopenStatus("OPEN")).toBe(false);
    expect(canReopenStatus("RESOLVED_AUTO")).toBe(true);
    expect(validateReopenReason("curto")).toBe(false);
    expect(validateReopenReason("problema voltou na conferência")).toBe(true);
  });

  it("SLA usa dias úteis e pula o fim de semana", () => {
    // 2026-07-31 é sexta; 1 dia útil cai na segunda 2026-08-03.
    expect(defaultDueAt("CRITICO", "2026-07-31T10:00:00Z")?.slice(0, 10)).toBe("2026-08-03");
    expect(defaultDueAt("INFO", "2026-07-31T10:00:00Z")).toBeNull();
  });

  it("ocorrência encerrada nunca fica vencida", () => {
    const past = { dueAt: "2026-01-01T00:00:00Z" };
    expect(isOverdue({ ...past, status: "OPEN" }, new Date("2026-07-30T00:00:00Z"))).toBe(true);
    expect(isOverdue({ ...past, status: "RESOLVED" }, new Date("2026-07-30T00:00:00Z"))).toBe(false);
  });

  it("ignore vencido volta a ser cobrado", () => {
    const now = new Date("2026-07-30T00:00:00Z");
    expect(ignoreExpired({ status: "IGNORED", ignoreUntil: "2026-07-01T00:00:00Z" }, now)).toBe(true);
    expect(ignoreExpired({ status: "IGNORED", ignoreUntil: "2026-08-30T00:00:00Z" }, now)).toBe(false);
  });

  it("fila prioriza atraso antes de prioridade e severidade", () => {
    const now = new Date("2026-07-30T00:00:00Z");
    const atrasada = { dueAt: "2026-07-01T00:00:00Z", status: "OPEN", priority: "LOW", severity: "AVISO", lastSeenAt: "2026-07-01" };
    const urgente = { dueAt: null, status: "OPEN", priority: "URGENT", severity: "BLOQUEANTE", lastSeenAt: "2026-07-29" };
    expect([urgente, atrasada].sort((a, b) => compareQueue(a, b, now))[0]).toBe(atrasada);
  });
});

describe("2B.5 — ciclo de vida preservado", () => {
  it("IGNORED com mesmo contexto permanece ignorada", () => {
    expect(decideOnDetection("IGNORED", false)).toMatchObject({ status: "IGNORED", event: "SEEN_AGAIN" });
  });

  it("IGNORED com contexto diferente reabre", () => {
    expect(decideOnDetection("IGNORED", true)).toMatchObject({ status: "REOPENED" });
  });

  it("resolvida que reaparece sempre reabre", () => {
    expect(decideOnDetection("RESOLVED", false).status).toBe("REOPENED");
    expect(decideOnDetection("RESOLVED_AUTO", false).status).toBe("REOPENED");
  });

  it("problema que some fecha automaticamente sem apagar decisão humana", () => {
    expect(decideOnDisappearance("IN_PROGRESS")?.status).toBe("RESOLVED_AUTO");
    expect(decideOnDisappearance("IGNORED")).toBeNull();
    expect(decideOnDisappearance("RESOLVED")).toBeNull();
  });
});
