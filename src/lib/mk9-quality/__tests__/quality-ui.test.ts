/**
 * Fase 2B.3 — testes da camada de apresentação do Centro de Qualidade.
 *
 * O risco aqui não é visual: é comunicar número errado, oferecer uma ação
 * proibida para o papel ou vazar detalhe técnico para o cliente.
 */
import { describe, expect, it } from "vitest";
import {
  availableTransitions,
  canOpenQualityModule,
  canRunPersistentCycle,
  competenceLabel,
  countLabel,
  describeConsolidation,
  describeIncompleteStores,
  issueTypeLabel,
  relativeLabel,
  sortIssues,
} from "../labels";
import { evidenceRows, issueSymptoms, resolveIssueNavigation, technicalRows } from "../evidence-view";
import type { Mk9QualityIssueView } from "../types";

const issue = (over: Partial<Mk9QualityIssueView> = {}): Mk9QualityIssueView =>
  ({
    id: "11111111-1111-1111-1111-111111111111",
    fingerprint: "abc",
    category: "INTEGRIDADE",
    issueType: "OPERATION_PAIR_INTEGRITY",
    severity: "CRITICO",
    status: "OPEN",
    entityType: "PAIR",
    entityId: "i:s",
    industryId: "22222222-2222-2222-2222-222222222222",
    storeId: "33333333-3333-3333-3333-333333333333",
    title: "Par sem roteiro",
    description: "d",
    suggestedAction: null,
    evidence: {},
    competenceMonth: 7,
    competenceYear: 2026,
    firstDetectedAt: "2026-07-01T00:00:00Z",
    lastSeenAt: "2026-07-30T00:00:00Z",
    source: "operation-pair-integrity",
    ...over,
  }) as Mk9QualityIssueView;

describe("unidades e contagens nunca se misturam", () => {
  it("1. cada unidade tem singular e plural próprios", () => {
    expect(countLabel(1, "ocorrencia")).toBe("1 ocorrência");
    expect(countLabel(2, "ocorrencia")).toBe("2 ocorrências");
    expect(countLabel(1, "loja")).toBe("1 loja");
    expect(countLabel(3, "visita")).toBe("3 visitas");
    expect(countLabel(1, "industria")).toBe("1 indústria");
  });

  it("2. lojas incompletas separam ocorrência, loja e visita", () => {
    const text = describeIncompleteStores({ issues: 76, stores: 41, visits: 113 });
    expect(text).toContain("76 ocorrências");
    expect(text).toContain("41 lojas");
    expect(text).toContain("113 visitas");
  });

  it("3. consolidação explica que sintomas não são ocorrências", () => {
    const text = describeConsolidation(151, 264);
    expect(text).toContain("151 ocorrências");
    expect(text).toContain("264 sintomas");
  });

  it("4. zero nunca vira frase vazia", () => {
    expect(countLabel(0, "ocorrencia")).toBe("0 ocorrências");
    expect(describeIncompleteStores({ issues: 0, stores: 0, visits: 0 })).toContain("Nenhuma");
  });
});

describe("permissões espelham exatamente o servidor", () => {
  it("5. CLIENTE nunca recebe ação de status", () => {
    expect(availableTransitions({ role: "CLIENTE", status: "OPEN", persisted: true })).toHaveLength(0);
  });

  it("6. SUPERVISOR não pode ignorar, ADMIN e AUDITOR podem", () => {
    const sup = availableTransitions({ role: "SUPERVISOR", status: "OPEN", persisted: true });
    expect(sup.some((t) => t.target === "IGNORED")).toBe(false);
    for (const role of ["ADMIN", "AUDITOR"]) {
      const opts = availableTransitions({ role, status: "OPEN", persisted: true });
      expect(opts.some((t) => t.target === "IGNORED")).toBe(true);
    }
  });

  it("7. ignorar e resolver sempre exigem justificativa", () => {
    const opts = availableTransitions({ role: "ADMIN", status: "OPEN", persisted: true });
    expect(opts.find((t) => t.target === "IGNORED")?.reasonRequired).toBe(true);
    expect(opts.find((t) => t.target === "RESOLVED")?.reasonRequired).toBe(true);
  });

  it("8. sinal calculado agora (sem histórico) não aceita ação", () => {
    expect(availableTransitions({ role: "ADMIN", status: "OPEN", persisted: false })).toHaveLength(0);
  });

  it("9. ocorrência já encerrada não repete a mesma ação", () => {
    const opts = availableTransitions({ role: "ADMIN", status: "RESOLVED", persisted: true });
    expect(opts.some((t) => t.target === "RESOLVED")).toBe(false);
  });

  it("10. acesso ao módulo e ao ciclo com histórico são regras distintas", () => {
    expect(canOpenQualityModule(["CLIENTE"])).toBe(true);
    expect(canOpenQualityModule(["PROMOTOR"])).toBe(false);
    expect(canRunPersistentCycle("ADMIN", true)).toBe(true);
    expect(canRunPersistentCycle("ADMIN", false)).toBe(false);
    expect(canRunPersistentCycle("SUPERVISOR", true)).toBe(false);
  });
});

describe("evidências viram texto humano, sem termo técnico", () => {
  it("11. sintomas são traduzidos para linguagem operacional", () => {
    const rendered = issueSymptoms({ symptoms: ["NO_ROUTE", "VISITS_WITHOUT_ROUTE"] });
    expect(rendered).toHaveLength(2);
    for (const line of rendered) expect(line).not.toMatch(/[A-Z]{3,}_/);
  });

  it("12. evidência sem renderizador não quebra a tela", () => {
    expect(() => evidenceRows("TIPO_DESCONHECIDO", { qualquer: 1 })).not.toThrow();
  });

  it("13. detalhes técnicos existem, mas em bloco separado", () => {
    const rows = technicalRows(issue({ fingerprint: "deadbeef" }));
    expect(rows.some((r) => String(r.value).includes("deadbeef"))).toBe(true);
    const humanRows = evidenceRows("OPERATION_PAIR_INTEGRITY", { symptoms: ["NO_ROUTE"] });
    expect(humanRows.some((r) => /fingerprint/i.test(r.label))).toBe(false);
  });

  it("14. navegação leva ao módulo de origem carregando o contexto", () => {
    const target = resolveIssueNavigation(issue());
    expect(target.storeId).toBe("33333333-3333-3333-3333-333333333333");
    expect(target.industryId).toBe("22222222-2222-2222-2222-222222222222");
    expect(target.month).toBe(7);
  });

  it("15. tipo de problema sempre tem rótulo legível", () => {
    expect(issueTypeLabel("OPERATION_PAIR_INTEGRITY")).not.toContain("_");
    expect(issueTypeLabel("ALGO_NOVO_AINDA_SEM_ROTULO")).toBeTruthy();
  });
});

describe("ordenação e datas", () => {
  it("16. o mais grave e mais recente aparece primeiro", () => {
    const sorted = sortIssues([
      issue({ id: "a", severity: "AVISO" }),
      issue({ id: "b", severity: "BLOQUEANTE" }),
      issue({ id: "c", severity: "CRITICO" }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("17. competência ausente não imprime 'null'", () => {
    expect(competenceLabel(null, null)).not.toMatch(/null|NaN/);
    expect(competenceLabel(7, 2026)).toBe("Julho/2026");
  });

  it("18. tempo relativo é estável e sem data inválida", () => {
    const now = new Date("2026-07-30T12:00:00Z");
    expect(relativeLabel("2026-07-30T11:30:00Z", now)).toContain("min");
    expect(relativeLabel(null, now)).not.toMatch(/NaN|Invalid/);
  });
});
