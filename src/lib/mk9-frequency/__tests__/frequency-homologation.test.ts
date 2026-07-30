/**
 * MK9 — Fase 1B.4: suíte de homologação da frequência versionada.
 *
 * Complementa a suíte 1B.3 (cenários A–L) com:
 *   - matriz mensal × semanal em janela padrão e janela KING;
 *   - ciclo completo de troca de frequência dentro do período;
 *   - garantia de que a proporcionalidade nunca é substituída por weekly × 4;
 *   - paridade de agregação entre módulos (soma de valores já arredondados).
 */
import { describe, it, expect } from "vitest";
import {
  contractedVisitsForFrequencySegments as contracted,
  describeFrequencySegments,
  daysInclusive,
} from "@/lib/mk9-frequency/segments";
import { aggregateVisitMetrics } from "@/lib/mk9-reports/metrics";

const JUL = { operationPeriodStart: "2026-07-01", operationPeriodEnd: "2026-07-31" };
const KING = { operationPeriodStart: "2026-06-23", operationPeriodEnd: "2026-07-22" };
const AGO = { operationPeriodStart: "2026-08-01", operationPeriodEnd: "2026-08-31" };

const seg = (from: string, until: string | null, monthly: number | null, weekly: number | null = null) => ({
  validFrom: from,
  validUntil: until,
  monthlyFrequency: monthly,
  weeklyFrequency: weekly,
});

describe("1B.4 — matriz de frequências mensais (período completo)", () => {
  for (const m of [1, 2, 4, 8, 12]) {
    it(`mensal ${m}x no mês inteiro devolve exatamente ${m}`, () => {
      expect(contracted({ ...JUL, segments: [seg("2020-01-01", null, m)] }).contratadas).toBe(m);
      expect(contracted({ ...KING, segments: [seg("2020-01-01", null, m)] }).contratadas).toBe(m);
    });
  }

  it("frequência quinzenal (0,5x/mês) arredonda meio-para-cima", () => {
    expect(contracted({ ...JUL, segments: [seg("2020-01-01", null, 0.5)] }).contratadas).toBe(1);
  });
});

describe("1B.4 — matriz de frequências semanais (proporcional a dias/7)", () => {
  const casos: Array<[number, number, number]> = [
    // [weekly, esperado julho (31d), esperado KING (30d)]
    [1, 4, 4],
    [2, 9, 9],
    [3, 13, 13],
    [5, 22, 21],
  ];
  for (const [weekly, jul, king] of casos) {
    it(`semanal ${weekly}x → ${jul} em julho e ${king} na janela KING`, () => {
      expect(contracted({ ...JUL, segments: [seg("2020-01-01", null, null, weekly)] }).contratadas).toBe(jul);
      expect(contracted({ ...KING, segments: [seg("2020-01-01", null, null, weekly)] }).contratadas).toBe(king);
    });
    it(`semanal ${weekly}x nunca usa weekly × 4`, () => {
      const r = contracted({ ...JUL, segments: [seg("2020-01-01", null, null, weekly)] });
      expect(r.raw).toBeCloseTo(weekly * (31 / 7), 6);
      expect(r.raw).not.toBeCloseTo(weekly * 4, 6);
    });
  }
});

describe("1B.4 — ciclo completo de troca de frequência", () => {
  const segments = [seg("2026-07-20", "2026-08-15", null, 1), seg("2026-08-16", null, null, 2)];

  it("soma proporcional dos dois trechos (15d a 1x/sem + 16d a 2x/sem)", () => {
    const r = contracted({ ...AGO, segments });
    expect(r.segments.map((s) => s.days)).toEqual([15, 16]);
    expect(r.raw).toBeCloseTo(1 * (15 / 7) + 2 * (16 / 7), 6);
    expect(r.contratadas).toBe(7);
    expect(r.hasMultipleSegments).toBe(true);
  });

  it("rótulo descreve as duas vigências com as datas de corte", () => {
    const r = contracted({ ...AGO, segments });
    expect(describeFrequencySegments(r, { start: AGO.operationPeriodStart, end: AGO.operationPeriodEnd })).toBe(
      "1x/sem até 15/08 · 2x/sem desde 16/08",
    );
  });

  it("mês anterior à troca continua com a frequência antiga", () => {
    // julho: apenas 12 dias (20..31) do primeiro segmento
    const r = contracted({ ...JUL, segments });
    expect(r.segments).toHaveLength(1);
    expect(r.contratadas).toBe(2);
  });

  it("mês posterior à troca usa só a frequência nova", () => {
    const set = { operationPeriodStart: "2026-09-01", operationPeriodEnd: "2026-09-30" };
    const r = contracted({ ...set, segments });
    expect(r.segments).toHaveLength(1);
    expect(r.hasMultipleSegments).toBe(false);
    expect(r.contratadas).toBe(9); // 2 × 30/7 = 8,57 → 9
  });

  it("recalcular o mesmo período repetidas vezes dá sempre o mesmo número", () => {
    const vals = Array.from({ length: 5 }, () => contracted({ ...AGO, segments }).contratadas);
    expect(new Set(vals).size).toBe(1);
  });
});

describe("1B.4 — janelas operacionais personalizadas", () => {
  it("janela KING tem 30 dias e janela calendário de julho tem 31", () => {
    expect(daysInclusive(KING.operationPeriodStart, KING.operationPeriodEnd)).toBe(30);
    expect(daysInclusive(JUL.operationPeriodStart, JUL.operationPeriodEnd)).toBe(31);
  });

  it("vigência que só intercepta a virada do mês entra proporcionalmente na janela KING", () => {
    // 23/06 a 30/06 = 8 dias a 4x/mês → 4 × 8/30 = 1,07 → 1
    const r = contracted({ ...KING, segments: [seg("2020-01-01", "2026-06-30", 4)] });
    expect(r.contratadas).toBe(1);
  });
});

describe("1B.4 — paridade de agregação entre módulos", () => {
  it("total da indústria é a soma dos valores já arredondados por loja", () => {
    const lojas = [
      contracted({ ...JUL, segments: [seg("2020-01-01", null, 4)] }).contratadas,
      contracted({ ...JUL, segments: [seg("2020-01-01", null, null, 2)] }).contratadas,
      contracted({ ...JUL, segments: [seg("2026-07-11", null, 4)] }).contratadas,
    ];
    const agg = aggregateVisitMetrics(lojas.map((c, i) => ({ contratadas: c, executadas: [4, 5, 0][i] })));
    expect(agg.contratadas).toBe(16);
    expect(agg.executadas).toBe(9);
    expect(agg.validas).toBe(9); // 4 + 5 + 0
    expect(agg.extras).toBe(0);
    expect(agg.pendencias).toBe(7);
    expect(agg.coberturaPct).toBe(56);
  });

  it("visitas extras de uma loja não compensam pendências de outra", () => {
    const agg = aggregateVisitMetrics([
      { contratadas: 4, executadas: 10 },
      { contratadas: 4, executadas: 0 },
    ]);
    expect(agg.extras).toBe(6);
    expect(agg.pendencias).toBe(4);
    expect(agg.coberturaPct).toBe(50);
  });
});
