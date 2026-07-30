/**
 * MK9 — Etapas 3 a 5: testes das regras de gestão manual de frequências.
 */
import { describe, expect, it } from "vitest";

import {
  FREQUENCY_ADMIN_CACHE_KEYS,
  checkFrequencyCombination,
  closeFrequencySchema,
  frequencyRpcMessage,
  frequencyVersionStatus,
  isRetroactiveChange,
  listFrequenciesSchema,
  setFrequencySchema,
} from "../admin";

const base = {
  industryId: "11111111-1111-1111-1111-111111111111",
  storeId: "22222222-2222-2222-2222-222222222222",
  effectiveDate: "2026-07-01",
  confirmInconsistent: false,
  confirmRetroactive: false,
  expectedUpdatedAt: null,
};

describe("combinação semanal × mensal", () => {
  it("aceita 0,5/2 (quinzenal) sem confirmação", () => {
    const r = checkFrequencyCombination(0.5, 2);
    expect(r.ok).toBe(true);
    expect(r.isBiweekly).toBe(true);
    expect(r.needsConfirmation).toBe(false);
  });

  it("aceita 1/4", () => {
    expect(checkFrequencyCombination(1, 4).ok).toBe(true);
  });

  it("exige confirmação e justificativa em combinação divergente", () => {
    const bare = checkFrequencyCombination(1, 6);
    expect(bare.ok).toBe(false);
    expect(bare.needsConfirmation).toBe(true);
    expect(bare.warning).toMatch(/divergente/i);

    const confirmedNoReason = checkFrequencyCombination(1, 6, { confirmed: true });
    expect(confirmedNoReason.ok).toBe(false);
    expect(confirmedNoReason.needsJustification).toBe(true);

    const full = checkFrequencyCombination(1, 6, { confirmed: true, reason: "contrato especial" });
    expect(full.ok).toBe(true);
  });

  it("não avalia quando só um campo é informado", () => {
    expect(checkFrequencyCombination(null, 4).ok).toBe(true);
    expect(checkFrequencyCombination(2, null).ok).toBe(true);
  });
});

describe("status de vigência", () => {
  it("classifica vigente, futura e encerrada", () => {
    const today = "2026-07-15";
    expect(frequencyVersionStatus({ validFrom: "2026-07-01", validUntil: null }, today)).toBe("current");
    expect(frequencyVersionStatus({ validFrom: "2026-08-01", validUntil: null }, today)).toBe("future");
    expect(frequencyVersionStatus({ validFrom: "2026-05-01", validUntil: "2026-06-30" }, today)).toBe("ended");
    // encerra exatamente hoje ainda é vigente
    expect(frequencyVersionStatus({ validFrom: "2026-05-01", validUntil: "2026-07-15" }, today)).toBe("current");
  });
});

describe("alteração retroativa", () => {
  it("detecta competência encerrada", () => {
    expect(isRetroactiveChange("2026-06-30", "2026-07-15")).toBe(true);
    expect(isRetroactiveChange("2026-07-01", "2026-07-15")).toBe(false);
    expect(isRetroactiveChange("2026-07-20", "2026-07-15")).toBe(false);
  });
});

describe("schemas .strict()", () => {
  it("aceita 0,5/2", () => {
    const parsed = setFrequencySchema.parse({ ...base, weeklyFrequency: 0.5, monthlyFrequency: 2 });
    expect(parsed.monthlyFrequency).toBe(2);
  });

  it("recusa payload sem frequência", () => {
    expect(() =>
      setFrequencySchema.parse({ ...base, weeklyFrequency: null, monthlyFrequency: null }),
    ).toThrow();
  });

  it("recusa campos administrativos injetados", () => {
    expect(() =>
      setFrequencySchema.parse({ ...base, weeklyFrequency: 1, monthlyFrequency: 4, sourceType: "IMPORT" }),
    ).toThrow();
    expect(() =>
      setFrequencySchema.parse({ ...base, weeklyFrequency: 1, monthlyFrequency: 4, actorId: "x" }),
    ).toThrow();
  });

  it("recusa frequência negativa e data inválida", () => {
    expect(() => setFrequencySchema.parse({ ...base, weeklyFrequency: -1, monthlyFrequency: null })).toThrow();
    expect(() =>
      setFrequencySchema.parse({ ...base, effectiveDate: "01/07/2026", weeklyFrequency: 1, monthlyFrequency: 4 }),
    ).toThrow();
  });

  it("encerramento exige justificativa e concorrência", () => {
    expect(() =>
      closeFrequencySchema.parse({
        versionId: base.storeId,
        endDate: "2026-07-31",
        reason: "",
        expectedUpdatedAt: "2026-07-01T00:00:00Z",
      }),
    ).toThrow();
    const ok = closeFrequencySchema.parse({
      versionId: base.storeId,
      endDate: "2026-07-31",
      reason: "fim de contrato",
      expectedUpdatedAt: "2026-07-01T00:00:00Z",
    });
    expect(ok.endDate).toBe("2026-07-31");
  });

  it("listagem tem paginação com limite", () => {
    const parsed = listFrequenciesSchema.parse({ industryId: base.industryId });
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(() => listFrequenciesSchema.parse({ industryId: base.industryId, pageSize: 5000 })).toThrow();
  });
});

describe("erros sanitizados", () => {
  it("traduz códigos conhecidos sem vazar SQL", () => {
    expect(frequencyRpcMessage("... MK9_FREQUENCY_CONCURRENT_MODIFICATION ...", "x")).toMatch(/outra pessoa/i);
    expect(frequencyRpcMessage("MK9_FREQUENCY_OVERLAP", "x")).toMatch(/vigência/i);
    expect(
      frequencyRpcMessage('conflicting key value violates exclusion constraint "mk9_frequency_overlap"', "x"),
    ).toMatch(/vigência/i);
  });

  it("cai no fallback para erros internos", () => {
    const msg = frequencyRpcMessage(
      'insert into "mk9_industry_store_frequency_versions" violates policy',
      "Não foi possível salvar a frequência.",
    );
    expect(msg).toBe("Não foi possível salvar a frequência.");
    expect(msg).not.toMatch(/mk9_industry_store/);
  });
});

describe("invalidação de cache", () => {
  it("cobre Dashboard, Cockpit, Auditoria e Relatórios", () => {
    for (const key of ["mk9-dashboard", "mk9-cockpit", "mk9-audit", "mk9-reports", "mk9-industry-frequencies"]) {
      expect(FREQUENCY_ADMIN_CACHE_KEYS).toContain(key as any);
    }
  });
});
