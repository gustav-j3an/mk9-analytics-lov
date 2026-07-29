/**
 * MK9 — Fase 1B.3: suíte matemática permanente do cálculo de contratadas
 * a partir de frequências VERSIONADAS.
 *
 * Cenários A–L exigidos pela missão. Qualquer regressão nas regras de
 * proporcionalidade, arredondamento ou vigência quebra estes testes.
 */
import { describe, it, expect } from "vitest";
import {
  contractedVisitsForFrequencySegments as contracted,
  describeFrequencySegments,
  daysInclusive,
  expectedVisitsUntil,
} from "@/lib/mk9-frequency/segments";

// Janela padrão (mês calendário de julho/2026): 31 dias.
const JUL = { operationPeriodStart: "2026-07-01", operationPeriodEnd: "2026-07-31" };
// Janela KING: 23/06 a 22/07 → 30 dias.
const KING = { operationPeriodStart: "2026-06-23", operationPeriodEnd: "2026-07-22" };

const seg = (
  validFrom: string,
  validUntil: string | null,
  monthly: number | null,
  weekly: number | null = null,
) => ({ validFrom, validUntil, monthlyFrequency: monthly, weeklyFrequency: weekly });

describe("1B.3 — cálculo de contratadas por segmentos de vigência", () => {
  it("A) frequência única durante todo o período → valor integral", () => {
    const r = contracted({ ...JUL, segments: [seg("2026-01-01", null, 4)] });
    expect(r.contratadas).toBe(4);
    expect(r.hasMultipleSegments).toBe(false);
    expect(r.source).toBe("MONTHLY_FREQUENCY");
  });

  it("B) troca de frequência no meio do período → soma proporcional", () => {
    // 1..15 (15 dias) a 4x/mês + 16..31 (16 dias) a 8x/mês
    // 4*15/31 + 8*16/31 = 1,9355 + 4,129 = 6,0645 → 6
    const r = contracted({
      ...JUL,
      segments: [seg("2026-06-01", "2026-07-15", 4), seg("2026-07-16", null, 8)],
    });
    expect(r.raw).toBeCloseTo(4 * (15 / 31) + 8 * (16 / 31), 6);
    expect(r.contratadas).toBe(6);
    expect(r.hasMultipleSegments).toBe(true);
  });

  it("C) vigência que começa depois do início do período → só a fração vigente", () => {
    // 21 dias de 11/07 a 31/07 → 4*21/31 = 2,709 → 3
    const r = contracted({ ...JUL, segments: [seg("2026-07-11", null, 4)] });
    expect(r.segments[0].days).toBe(21);
    expect(r.contratadas).toBe(3);
  });

  it("D) vigência que termina antes do fim do período → só a fração vigente", () => {
    // 10 dias de 01/07 a 10/07 → 4*10/31 = 1,29 → 1
    const r = contracted({ ...JUL, segments: [seg("2026-01-01", "2026-07-10", 4)] });
    expect(r.contratadas).toBe(1);
  });

  it("E) loja sem frequência no período → contratadas = 0", () => {
    expect(contracted({ ...JUL, segments: [] }).contratadas).toBe(0);
    expect(contracted({ ...JUL, segments: [] }).source).toBe("NONE");
  });

  it("F) vigência inteiramente fora do período é ignorada", () => {
    const antes = contracted({ ...JUL, segments: [seg("2026-01-01", "2026-06-30", 10)] });
    const depois = contracted({ ...JUL, segments: [seg("2026-08-01", null, 10)] });
    expect(antes.contratadas).toBe(0);
    expect(depois.contratadas).toBe(0);
  });

  it("G) janela KING (23/06→22/07) tem 30 dias e usa esse denominador", () => {
    expect(daysInclusive(KING.operationPeriodStart, KING.operationPeriodEnd)).toBe(30);
    const r = contracted({ ...KING, segments: [seg("2026-01-01", null, 4)] });
    expect(r.contratadas).toBe(4);
    // metade da janela KING (23/06 a 07/07 = 15 dias) → 4*15/30 = 2
    const meio = contracted({ ...KING, segments: [seg("2026-01-01", "2026-07-07", 4)] });
    expect(meio.contratadas).toBe(2);
  });

  it("H) frequência semanal usa dias/7 — nunca weekly × 4", () => {
    // 31 dias / 7 = 4,4286 semanas × 1 = 4,43 → 4  (weekly*4 daria 4, mas
    // com 2x/sem: 8,857 → 9, enquanto weekly*4 daria 8)
    expect(contracted({ ...JUL, segments: [seg("2026-01-01", null, null, 1)] }).contratadas).toBe(4);
    const duas = contracted({ ...JUL, segments: [seg("2026-01-01", null, null, 2)] });
    expect(duas.contratadas).toBe(9);
    expect(duas.contratadas).not.toBe(2 * 4);
    expect(duas.source).toBe("WEEKLY_FREQUENCY");
  });

  it("I) mensal tem prioridade sobre semanal no mesmo segmento", () => {
    const r = contracted({ ...JUL, segments: [seg("2026-01-01", null, 6, 3)] });
    expect(r.contratadas).toBe(6);
    expect(r.source).toBe("MONTHLY_FREQUENCY");
  });

  it("J) arredondamento é ÚNICO no fim (nunca por segmento)", () => {
    // 3 segmentos de ~1/3 do mês a 1x/mês: cada um ~0,33 (arredondaria a 0),
    // mas a soma é 1.
    const r = contracted({
      ...JUL,
      segments: [
        seg("2026-07-01", "2026-07-10", 1),
        seg("2026-07-11", "2026-07-20", 1),
        seg("2026-07-21", "2026-07-31", 1),
      ],
    });
    expect(r.segments.every((s) => s.raw < 0.5)).toBe(true);
    expect(r.contratadas).toBe(1);
    // meio-para-cima explícito: 0,5 → 1
    const meio = contracted({ ...JUL, segments: [seg("2026-01-01", null, 0.5)] });
    expect(meio.contratadas).toBe(1);
  });

  it("K) meta esperada até a data respeita a vigência de cada segmento", () => {
    const segs = [seg("2026-06-01", "2026-07-15", 4), seg("2026-07-16", null, 8)];
    // até 15/07: só o primeiro segmento → 4*15/31 = 1,93 → 2
    expect(expectedVisitsUntil({ ...JUL, segments: segs, untilDate: "2026-07-15" })).toBe(2);
    // até o fim: total do período
    expect(expectedVisitsUntil({ ...JUL, segments: segs, untilDate: "2026-07-31" })).toBe(6);
    // antes do período começar → 0
    expect(expectedVisitsUntil({ ...JUL, segments: segs, untilDate: "2026-06-30" })).toBe(0);
  });

  it("L) rótulo descreve a troca de frequência no período", () => {
    const r = contracted({
      ...JUL,
      segments: [seg("2026-06-01", "2026-07-15", null, 1), seg("2026-07-16", null, null, 2)],
    });
    const label = describeFrequencySegments(r, { start: JUL.operationPeriodStart, end: JUL.operationPeriodEnd });
    expect(label).toBe("1x/sem até 15/07 · 2x/sem desde 16/07");

    const unico = contracted({ ...JUL, segments: [seg("2026-01-01", null, 4)] });
    expect(describeFrequencySegments(unico, { start: JUL.operationPeriodStart, end: JUL.operationPeriodEnd })).toBe(
      "4x/mês",
    );
  });

  it("total por indústria é a soma dos valores JÁ arredondados por loja", () => {
    const lojas = [
      contracted({ ...JUL, segments: [seg("2026-01-01", null, 4)] }).contratadas,
      contracted({ ...JUL, segments: [seg("2026-01-01", null, null, 2)] }).contratadas,
      contracted({ ...JUL, segments: [seg("2026-07-11", null, 4)] }).contratadas,
    ];
    expect(lojas).toEqual([4, 9, 3]);
    expect(lojas.reduce((a, b) => a + b, 0)).toBe(16);
  });
});
