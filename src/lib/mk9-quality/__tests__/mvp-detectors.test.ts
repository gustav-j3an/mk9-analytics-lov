/**
 * Fase 2B.2 — testes das regras dos 10 detectores do MVP.
 *
 * Tudo puro: nenhum acesso ao banco. O foco é o que realmente pode causar
 * dano operacional — falso positivo de duplicidade, sintoma consolidado
 * errado, gravidade errada e evidência exposta ao papel errado.
 */
import { describe, expect, it } from "vitest";
import { findProbableStoreDuplicates } from "../rules/store-duplicates";
import { evaluateOperationPair } from "../rules/operation-pair";
import {
  compareCounters,
  divergenceSeverity,
  evaluateImportHealth,
  needsChecklistValidation,
} from "../rules/import-health";
import { capDetections } from "../rules/cap";
import { resolveCompetence, calendarWindow, addDays } from "../rules/competence";
import { navigationTarget } from "../navigation";
import { evidenceForClient, sanitizeEvidence } from "../evidence";
import { MK9_QUALITY_DETECTORS } from "../detectors";
import type { DetectedIssue } from "../types";

const store = (id: string, name: string, chain: string | null = "KING", uf: string | null = "DF") => ({
  id, name, chain, uf,
});

describe("duplicidade de loja — sem falso positivo", () => {
  it("A. mesmo nome com pontuação diferente é duplicata", () => {
    const pairs = findProbableStoreDuplicates([
      store("a", "TATICO - SAMAMBAIA NORTE"),
      store("b", "TATICO SAMAMBAIA NORTE"),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].severity).toBe("CRITICO");
  });

  it("B. mesmas palavras em ordem diferente é duplicata", () => {
    const pairs = findProbableStoreDuplicates([
      store("a", "ATACADAO AV RIO VERDE APARECIDA"),
      store("b", "ATACADAO APARECIDA AV RIO VERDE"),
    ]);
    expect(pairs).toHaveLength(1);
  });

  it("C. numeração de filial diferente NUNCA é duplicata", () => {
    const pairs = findProbableStoreDuplicates([store("a", "SUPER LOJA 1"), store("b", "SUPER LOJA 2")]);
    expect(pairs).toHaveLength(0);
  });

  it("D. marcador de filial em apenas um dos nomes bloqueia o par", () => {
    const pairs = findProbableStoreDuplicates([
      store("a", "MERCADO CENTRAL NORTE"),
      store("b", "MERCADO CENTRAL"),
    ]);
    expect(pairs).toHaveLength(0);
  });

  it("E. UF diferente nunca é duplicata", () => {
    const pairs = findProbableStoreDuplicates([
      store("a", "TATICO SAMAMBAIA", "KING", "DF"),
      store("b", "TATICO SAMAMBAIA", "KING", "GO"),
    ]);
    expect(pairs).toHaveLength(0);
  });

  it("F. rede diferente nunca é duplicata", () => {
    const pairs = findProbableStoreDuplicates([
      store("a", "LOJA ALFA", "KING"),
      store("b", "LOJA ALFA", "OUTRA"),
    ]);
    expect(pairs).toHaveLength(0);
  });

  it("G. o par A↔B é reportado uma única vez, com ids ordenados", () => {
    const pairs = findProbableStoreDuplicates([store("b", "LOJA ALFA"), store("a", "LOJA ALFA")]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].aId < pairs[0].bId).toBe(true);
  });

  it("H. nomes apenas parecidos ficam abaixo do limiar", () => {
    const pairs = findProbableStoreDuplicates([
      store("a", "PADARIA DO JOAO"),
      store("b", "PADARIA DA MARIA"),
    ]);
    expect(pairs).toHaveLength(0);
  });

  it("I. respeita o limite máximo de pares", () => {
    const many = Array.from({ length: 30 }, (_, i) => store(`s${i}`, "LOJA IGUAL"));
    expect(findProbableStoreDuplicates(many, { maxPairs: 5 })).toHaveLength(5);
  });
});

describe("par indústria × loja — sintomas consolidados", () => {
  const base = { industryId: "i", storeId: "s", hasFrequency: true, contractedVisits: 4, routeCount: 1, executedVisits: 4 };

  it("J. par saudável não gera ocorrência", () => {
    expect(evaluateOperationPair(base)).toBeNull();
  });

  it("K. par totalmente vazio não é problema (loja não pertence à indústria)", () => {
    expect(
      evaluateOperationPair({ ...base, hasFrequency: false, contractedVisits: 0, routeCount: 0, executedVisits: 0 }),
    ).toBeNull();
  });

  it("L. contratado sem roteiro é CRÍTICO", () => {
    const out = evaluateOperationPair({ ...base, routeCount: 0, executedVisits: 0 });
    expect(out?.severity).toBe("CRITICO");
    expect(out?.symptoms).toContain("NO_ROUTE");
  });

  it("M. visita sem roteiro é graduada: só é BLOQUEANTE sem frequência nem roteiro", () => {
    // Há frequência contratada: o problema é grave, mas não bloqueia o relatório.
    const comFrequencia = evaluateOperationPair({ ...base, routeCount: 0, executedVisits: 3 });
    expect(comFrequencia?.symptoms).toContain("VISITS_WITHOUT_ROUTE");
    expect(comFrequencia?.severity).toBe("CRITICO");

    // Sem frequência e sem roteiro: a visita não tem nenhum respaldo contratual.
    const semRespaldo = evaluateOperationPair({
      ...base,
      hasFrequency: false,
      contractedVisits: 0,
      routeCount: 0,
      executedVisits: 3,
    });
    expect(semRespaldo?.severity).toBe("BLOQUEANTE");
  });


  it("N. roteiro sem frequência contratada é CRÍTICO", () => {
    const out = evaluateOperationPair({ ...base, hasFrequency: false, contractedVisits: 0 });
    expect(out?.severity).toBe("CRITICO");
    expect(out?.symptoms).toContain("ROUTE_WITHOUT_FREQUENCY");
  });

  it("O. três sintomas viram UMA ocorrência, não três", () => {
    const out = evaluateOperationPair({ ...base, hasFrequency: false, contractedVisits: 0, routeCount: 0, executedVisits: 2 });
    expect(out).not.toBeNull();
    expect(out!.symptoms.length).toBeGreaterThan(1);
  });

  it("P. frequência vigente que resulta em zero visitas é sinalizada", () => {
    const out = evaluateOperationPair({ ...base, contractedVisits: 0, routeCount: 0 });
    expect(out?.symptoms).toContain("ZERO_FREQUENCY");
  });
});

describe("saúde das importações", () => {
  const now = new Date("2026-07-30T12:00:00Z");

  it("Q. importação concluída e validada não gera nada", () => {
    expect(evaluateImportHealth({ status: "done", startedAt: "2026-07-30T10:00:00Z", finishedAt: "2026-07-30T10:05:00Z" }, now)).toBeNull();
    expect(needsChecklistValidation({ status: "done", validationStatus: "OK", validatedAt: "2026-07-30T11:00:00Z", finishedAt: null })).toBe(false);
  });

  it("R. importação recém iniciada ainda não é 'travada'", () => {
    expect(evaluateImportHealth({ status: "committing", startedAt: "2026-07-30T11:30:00Z", finishedAt: null }, now)).toBeNull();
  });

  it("S. importação parada há horas é travada; há mais de um dia é crítica", () => {
    expect(evaluateImportHealth({ status: "pending", startedAt: "2026-07-30T06:00:00Z", finishedAt: null }, now)?.severity).toBe("ATENCAO");
    expect(evaluateImportHealth({ status: "pending", startedAt: "2026-07-28T06:00:00Z", finishedAt: null }, now)?.severity).toBe("CRITICO");
  });

  it("T. importação com falha é crítica", () => {
    expect(evaluateImportHealth({ status: "failed", startedAt: "2026-07-30T10:00:00Z", finishedAt: null }, now)?.symptom).toBe("FAILED");
  });

  it("U. checklist concluído sem validação é sinalizado", () => {
    expect(needsChecklistValidation({ status: "done", validationStatus: null, validatedAt: null, finishedAt: null })).toBe(true);
    expect(needsChecklistValidation({ status: "failed", validationStatus: null, validatedAt: null, finishedAt: null })).toBe(false);
  });

  it("V. divergência só existe quando os dois lados informam o número", () => {
    expect(compareCounters({ actualVisits: 353 }, { actualVisits: 353 })).toHaveLength(0);
    expect(compareCounters({}, { actualVisits: 353 })).toHaveLength(0);
    const diff = compareCounters({ actualVisits: 353 }, { actualVisits: 300 });
    expect(diff[0]).toMatchObject({ expected: 353, actual: 300, delta: -53 });
  });

  it("W. gravidade da divergência é proporcional ao desvio", () => {
    expect(divergenceSeverity(compareCounters({ v: 100 }, { v: 99 }))).toBe("AVISO");
    expect(divergenceSeverity(compareCounters({ v: 100 }, { v: 90 }))).toBe("ATENCAO");
    expect(divergenceSeverity(compareCounters({ v: 100 }, { v: 50 }))).toBe("CRITICO");
  });
});

describe("volume, competência e navegação", () => {
  const issue = (i: number): DetectedIssue => ({
    category: "CADASTRO",
    issueType: "X",
    severity: "AVISO",
    entityType: "STORE",
    entityId: String(i),
    title: "t",
    description: "d",
    evidence: {},
    source: "s",
    fingerprintParts: {},
    contextParts: {},
  });

  it("X. excedente de volume vira UMA ocorrência-resumo", () => {
    const out = capDetections(Array.from({ length: 10 }, (_, i) => issue(i)), (hidden, total) => ({
      ...issue(999),
      issueType: "X_SUMMARY",
      evidence: { hidden, count: total },
    }), 4);
    expect(out).toHaveLength(5);
    expect(out[4].issueType).toBe("X_SUMMARY");
    expect(out[4].evidence).toMatchObject({ hidden: 6, count: 10 });
  });

  it("Y. competência ausente cai no mês corrente e a janela é o mês fechado", () => {
    expect(resolveCompetence(null, new Date("2026-07-15T00:00:00Z"))).toEqual({ year: 2026, month: 7 });
    expect(calendarWindow(2026, 2)).toEqual({ startDate: "2026-02-01", endDate: "2026-02-28" });
    expect(addDays("2026-07-30", 2)).toBe("2026-08-01");
  });

  it("Z. destino de navegação descarta campos vazios", () => {
    expect(navigationTarget({ module: "stores", storeId: "s1", industryId: null, month: 7 })).toEqual({
      module: "stores", storeId: "s1", month: 7,
    });
  });

  it("AA. CLIENTE recebe contexto operacional mas nunca detalhe técnico", () => {
    const evidence = sanitizeEvidence({
      storeName: "Loja Centro",
      symptoms: ["NO_ROUTE"],
      navigationTarget: { module: "routes", storeId: "s1" },
      filename: "KING.xlsx",
      divergences: [{ metric: "v", expected: 1, found: 2 }],
      importKind: "CHECKLIST",
    });
    const client = evidenceForClient(evidence);
    expect(Object.keys(client).sort()).toEqual(["navigationTarget", "storeName", "symptoms"]);
  });

  it("AB. o catálogo expõe 11 detectores, cada um com id e tipos únicos", () => {
    expect(MK9_QUALITY_DETECTORS).toHaveLength(11);
    const ids = MK9_QUALITY_DETECTORS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const types = MK9_QUALITY_DETECTORS.flatMap((d) => d.issueTypes);
    expect(new Set(types).size).toBe(types.length);
    for (const d of MK9_QUALITY_DETECTORS) expect(d.issueTypes).toContain(d.id);
  });
});
