/**
 * Fase 2B.1 — testes da fundação do Centro de Qualidade dos Dados.
 * Cobrem identidade (fingerprint), estado (contextHash), ciclo de vida e
 * sanitização de evidência. Tudo puro: nenhum acesso ao banco.
 */
import { describe, expect, it } from "vitest";
import { buildContextHash, buildFingerprint, canonicalize, fingerprintIssue } from "../fingerprint";
import { evidenceForClient, sanitizeEvidence, technicalErrorEvidence } from "../evidence";
import { decideOnDetection, decideOnDisappearance, validateReason } from "../lifecycle";
import type { DetectedIssue } from "../types";

const base: DetectedIssue = {
  category: "CADASTRO",
  issueType: "DUPLICATE_STORE",
  severity: "CRITICO",
  entityType: "STORE",
  entityId: "aaa",
  peerEntityId: "bbb",
  industryId: null,
  storeId: null,
  competence: { month: 7, year: 2026 },
  title: "Lojas duplicadas",
  description: "Duas lojas equivalentes",
  evidence: { similarity: 1 },
  source: "detector:test",
  fingerprintParts: { rule: "permutation" },
  contextParts: { similarity: 1 },
};

describe("fingerprint — identidade estável", () => {
  it("A. ordem das chaves não altera a canonicalização", () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });

  it("B. mesmo problema gera o mesmo fingerprint em execuções diferentes", () => {
    expect(buildFingerprint(base)).toBe(buildFingerprint({ ...base }));
  });

  it("C. duplicata A↔B é o mesmo problema que B↔A", () => {
    const invertido = { ...base, entityId: "bbb", peerEntityId: "aaa" };
    expect(buildFingerprint(invertido)).toBe(buildFingerprint(base));
  });

  it("D. título e descrição não fazem parte da identidade", () => {
    const outroTexto = { ...base, title: "Outro título", description: "Outro texto" };
    expect(buildFingerprint(outroTexto)).toBe(buildFingerprint(base));
  });

  it("E. competência diferente é outro problema", () => {
    const outraComp = { ...base, competence: { month: 8, year: 2026 } };
    expect(buildFingerprint(outraComp)).not.toBe(buildFingerprint(base));
  });

  it("F. tipo de problema diferente é outro problema", () => {
    expect(buildFingerprint({ ...base, issueType: "OUTRO" })).not.toBe(buildFingerprint(base));
  });

  it("G. contextHash muda quando o cenário muda, mas o fingerprint não", () => {
    const mudou = { ...base, contextParts: { similarity: 0.92 } };
    expect(buildFingerprint(mudou)).toBe(buildFingerprint(base));
    expect(buildContextHash(mudou)).not.toBe(buildContextHash(base));
  });

  it("H. fingerprintIssue devolve identidade + estado", () => {
    const fp = fingerprintIssue(base);
    expect(fp.fingerprint).toHaveLength(64);
    expect(fp.contextHash).toHaveLength(64);
  });
});

describe("ciclo de vida", () => {
  it("I. primeira detecção abre a ocorrência", () => {
    expect(decideOnDetection(null, false)).toMatchObject({ status: "OPEN", event: "DETECTED" });
  });

  it("J. detectar de novo o mesmo cenário não cria duplicata nem muda status", () => {
    expect(decideOnDetection("OPEN", false)).toMatchObject({ status: "OPEN", event: "SEEN_AGAIN" });
  });

  it("K. cenário alterado atualiza a evidência sem perder o status de trabalho", () => {
    expect(decideOnDetection("IN_PROGRESS", true)).toMatchObject({
      status: "IN_PROGRESS",
      event: "EVIDENCE_UPDATED",
    });
  });

  it("L. voltar depois de resolvido reabre", () => {
    expect(decideOnDetection("RESOLVED", false)).toMatchObject({ status: "REOPENED" });
    expect(decideOnDetection("RESOLVED_AUTO", false)).toMatchObject({ status: "REOPENED" });
  });

  it("M. IGNORADO só reabre quando o contexto muda", () => {
    expect(decideOnDetection("IGNORED", false).status).toBe("IGNORED");
    expect(decideOnDetection("IGNORED", true).status).toBe("REOPENED");
  });

  it("N. sumir do detector resolve automaticamente os estados abertos", () => {
    for (const s of ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "REOPENED"] as const) {
      expect(decideOnDisappearance(s)?.status).toBe("RESOLVED_AUTO");
    }
  });

  it("O. decisões humanas nunca são apagadas por auto-resolução", () => {
    expect(decideOnDisappearance("IGNORED")).toBeNull();
    expect(decideOnDisappearance("RESOLVED")).toBeNull();
  });

  it("P. ignorar e resolver exigem justificativa", () => {
    expect(validateReason("IGNORED", "abc")).toBe(false);
    expect(validateReason("IGNORED", "motivo real")).toBe(true);
    expect(validateReason("RESOLVED", "")).toBe(false);
    expect(validateReason("ACKNOWLEDGED", null)).toBe(true);
  });
});

describe("evidência — sanitização", () => {
  it("Q. remove segredos, PII e payload bruto", () => {
    const out = sanitizeEvidence({
      token: "abc123",
      password: "x",
      contact: "11999998888",
      email: "a@b.com",
      rawPayload: { tudo: 1 },
      stack: "Error: ...",
      sql: "select 1",
      notes: "observação pessoal",
      storeName: "Loja Centro",
    });
    expect(Object.keys(out)).toEqual(["storeName"]);
  });

  it("R. redige e-mail e telefone dentro de textos livres", () => {
    const out = sanitizeEvidence({ title: "fale com a@b.com ou (11) 99999-8888" });
    expect(out.title).not.toContain("@b.com");
    expect(String(out.title)).toContain("[redigido]");
  });

  it("S. erro técnico vira código controlado, sem mensagem crua", () => {
    const out = technicalErrorEvidence("dq_detector_failed", { detector: "freq" });
    expect(out.errorCode).toBe("DQ_DETECTOR_FAILED");
    expect(JSON.stringify(out)).not.toContain("Error");
  });

  it("T. CLIENTE só recebe campos operacionais liberados", () => {
    const out = evidenceForClient(
      sanitizeEvidence({ storeName: "Loja", versionId: "uuid", overlappingRows: 3 }),
    );
    expect(out).toEqual({ storeName: "Loja" });
  });

  it("U. evidência sanitizada é sempre serializável em JSON", () => {
    const out = sanitizeEvidence({ n: Number.NaN, d: new Date(0), f: () => 1, ok: 2 });
    expect(() => JSON.stringify(out)).not.toThrow();
    expect(out.ok).toBe(2);
    expect(out.n).toBeNull();
  });
});
