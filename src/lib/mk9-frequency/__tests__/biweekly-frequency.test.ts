/**
 * MK9 — Missão preventiva: frequência quinzenal (0,5x/semana = 2x/mês).
 *
 * Suíte permanente que impede regressões em três frentes:
 *   1. leitura de valores decimais na planilha (parser);
 *   2. regra canônica semanal × mensal e sua tolerância numérica;
 *   3. cálculo proporcional de contratadas no cenário 0,5 / 2.
 *
 * Nada aqui altera dados: são testes puros sobre módulos puros.
 */
import { describe, it, expect } from "vitest";
import { parseNumber } from "@/lib/mk9/normalization";
import {
  CANONICAL_FREQUENCY_PAIRS,
  describeFrequency,
  evaluateFrequencyConsistency,
  expectedMonthlyFromWeekly,
  FREQUENCY_TOLERANCE,
  isWeeklyMonthlyConsistent,
} from "@/lib/mk9-frequency/canonical";
import { contractedVisitsForFrequencySegments as contracted } from "@/lib/mk9-frequency/segments";

// ---------------------------------------------------------------------------
// 1. Parser — todos os formatos possíveis de 0,5
// ---------------------------------------------------------------------------

describe("parser de frequência — 0,5 em todos os formatos", () => {
  const halfCases: Array<[string, unknown]> = [
    ["numérico 0.5 (célula Excel)", 0.5],
    ["string 0,5", "0,5"],
    ["string 0.5", "0.5"],
    ["string 0,50", "0,50"],
    ["string 0.50", "0.50"],
    ["string com espaços ' 0,5 '", " 0,5 "],
    ["string com espaços ' 0.5 '", " 0.5 "],
    ["resultado calculado de fórmula (1/2)", 1 / 2],
    ["string com sufixo '0,5x'", "0,5x"],
    [",5 sem zero à esquerda", ",5"],
  ];

  for (const [label, input] of halfCases) {
    it(`${label} → 0.5`, () => {
      expect(parseNumber(input)).toBeCloseTo(0.5, 10);
    });
  }

  it("G) parser \"0,5\" → 0.5", () => {
    expect(parseNumber("0,5")).toBe(0.5);
  });

  it("H) parser 0.5 numérico → 0.5", () => {
    expect(parseNumber(0.5)).toBe(0.5);
  });

  it("não confunde 1,5 com 0,5", () => {
    expect(parseNumber("1,5")).toBe(1.5);
    expect(parseNumber("1.5")).toBe(1.5);
    expect(parseNumber(1.5)).toBe(1.5);
    expect(parseNumber("1,50")).toBe(1.5);
    expect(parseNumber("1.50")).toBe(1.5);
  });

  it("preserva inteiros e separador de milhar", () => {
    expect(parseNumber("2")).toBe(2);
    expect(parseNumber("12")).toBe(12);
    expect(parseNumber("1.234")).toBe(1234);
    expect(parseNumber("1.234,5")).toBe(1234.5);
    expect(parseNumber("1,234.5")).toBe(1234.5);
    expect(parseNumber("-0,5")).toBe(-0.5);
  });

  it("valores vazios ou não numéricos → null", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("   ")).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber("—")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Regra canônica e detector de inconsistência
// ---------------------------------------------------------------------------

describe("regra canônica semanal × mensal", () => {
  it("pares canônicos documentados são consistentes", () => {
    for (const { weekly, monthly } of CANONICAL_FREQUENCY_PAIRS) {
      expect(isWeeklyMonthlyConsistent(weekly, monthly)).toBe(true);
      expect(expectedMonthlyFromWeekly(weekly)).toBeCloseTo(monthly, 10);
    }
  });

  it("F) 0,5 semanal + 2 mensal → detector NÃO sinaliza", () => {
    const r = evaluateFrequencyConsistency(0.5, 2);
    expect(r.consistent).toBe(true);
    expect(r.isBiweekly).toBe(true);
  });

  it("D) 1,5 semanal + 6 mensal → válido", () => {
    expect(evaluateFrequencyConsistency(1.5, 6).consistent).toBe(true);
  });

  it("E) 1,5 semanal + 2 mensal → detector sinaliza inconsistência", () => {
    const r = evaluateFrequencyConsistency(1.5, 2);
    expect(r.evaluable).toBe(true);
    expect(r.consistent).toBe(false);
    expect(r.expectedMonthly).toBe(6);
    expect(r.difference).toBe(-4);
  });

  it("outros pares inconsistentes conhecidos", () => {
    for (const [w, m] of [[0.5, 6], [1, 8], [2, 4]] as const) {
      expect(isWeeklyMonthlyConsistent(w, m)).toBe(false);
    }
  });

  it("tolerância numérica evita falso positivo de ponto flutuante", () => {
    expect(isWeeklyMonthlyConsistent(0.5, 2 + FREQUENCY_TOLERANCE / 2)).toBe(true);
    expect(isWeeklyMonthlyConsistent(0.1 + 0.4, 2)).toBe(true);
    expect(isWeeklyMonthlyConsistent(0.5, 2.01)).toBe(false);
  });

  it("campos ausentes não geram ocorrência", () => {
    expect(evaluateFrequencyConsistency(0.5, null).evaluable).toBe(false);
    expect(evaluateFrequencyConsistency(null, 2).evaluable).toBe(false);
    expect(evaluateFrequencyConsistency(0, 0).evaluable).toBe(false);
    expect(isWeeklyMonthlyConsistent(null, null)).toBe(true);
  });
});

describe("apresentação da frequência no preview", () => {
  it("0,5 / 2 é rotulada como quinzenal", () => {
    expect(describeFrequency(0.5, 2)).toBe("Frequência quinzenal: 0,5x/semana · 2x/mês");
  });

  it("demais casos usam o formato padrão", () => {
    expect(describeFrequency(1, 4)).toBe("1x/semana · 4x/mês");
    expect(describeFrequency(1.5, 6)).toBe("1,5x/semana · 6x/mês");
    expect(describeFrequency(2, 8)).toBe("2x/semana · 8x/mês");
    expect(describeFrequency(3, 12)).toBe("3x/semana · 12x/mês");
  });

  it("valores divergentes continuam sendo exibidos como cadastrados", () => {
    expect(describeFrequency(1.5, 2)).toBe("1,5x/semana · 2x/mês");
    expect(describeFrequency(null, null)).toBe("Frequência não informada");
  });
});

// ---------------------------------------------------------------------------
// 3. Matemática das contratadas no cenário quinzenal
// ---------------------------------------------------------------------------

const seg = (
  validFrom: string,
  validUntil: string | null,
  weekly: number | null,
  monthly: number | null,
) => ({ validFrom, validUntil, weeklyFrequency: weekly, monthlyFrequency: monthly });

describe("contratadas com frequência quinzenal", () => {
  it("A) 0,5 semanal + 2 mensal em período completo → 2 contratadas", () => {
    const r = contracted({
      operationPeriodStart: "2026-07-01",
      operationPeriodEnd: "2026-07-31",
      segments: [seg("2026-01-01", null, 0.5, 2)],
    });
    expect(r.contratadas).toBe(2);
    expect(r.source).toBe("MONTHLY_FREQUENCY");
  });

  it("B) 0,5 semanal sem mensal em 28 dias → 2 contratadas", () => {
    const r = contracted({
      operationPeriodStart: "2026-02-01",
      operationPeriodEnd: "2026-02-28",
      segments: [seg("2026-01-01", null, 0.5, null)],
    });
    expect(r.raw).toBeCloseTo(2, 10); // 0,5 × (28/7)
    expect(r.contratadas).toBe(2);
    expect(r.source).toBe("WEEKLY_FREQUENCY");
  });

  it("C) 0,5 semanal sem mensal em 30 dias → proporcional (2,14 → 2)", () => {
    const r = contracted({
      operationPeriodStart: "2026-06-23",
      operationPeriodEnd: "2026-07-22",
      segments: [seg("2026-01-01", null, 0.5, null)],
    });
    expect(r.raw).toBeCloseTo(0.5 * (30 / 7), 10);
    expect(r.contratadas).toBe(2);
  });

  it("nunca usa weekly × 4 como cálculo de contratadas", () => {
    const r = contracted({
      operationPeriodStart: "2026-07-01",
      operationPeriodEnd: "2026-07-31",
      segments: [seg("2026-01-01", null, 0.5, null)],
    });
    expect(r.contratadas).not.toBe(0.5 * 4);
    expect(r.raw).toBeCloseTo(0.5 * (31 / 7), 10);
  });

  it("I) Dashboard = Auditoria = PDF: o mesmo motor devolve o mesmo número", () => {
    const input = {
      operationPeriodStart: "2026-07-01",
      operationPeriodEnd: "2026-07-31",
      segments: [seg("2026-01-01", null, 0.5, 2)],
    };
    const dashboard = contracted(input).contratadas;
    const auditoria = contracted(input).contratadas;
    const pdf = contracted(input).contratadas;
    expect(dashboard).toBe(2);
    expect(auditoria).toBe(dashboard);
    expect(pdf).toBe(dashboard);
  });

  it("J) reimportação idêntica 0,5/2 → valores inalterados (UNCHANGED)", () => {
    const before = { weekly: 0.5, monthly: 2 };
    const reimported = { weekly: parseNumber("0,5")!, monthly: parseNumber("2")! };
    expect(reimported.weekly).toBe(before.weekly);
    expect(reimported.monthly).toBe(before.monthly);
    const unchanged =
      Math.abs(reimported.weekly - before.weekly) <= FREQUENCY_TOLERANCE &&
      Math.abs(reimported.monthly - before.monthly) <= FREQUENCY_TOLERANCE;
    expect(unchanged).toBe(true);
  });
});
