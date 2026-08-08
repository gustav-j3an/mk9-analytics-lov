import { describe, it, expect } from "vitest";
import { contractedVisitsForFrequencySegments } from "../mk9-frequency/segments";

describe("Contrato de Frequência KING (Agosto/2026)", () => {
  const window = {
    startDate: "2026-07-23",
    endDate: "2026-08-22",
  };

  it("Caso 1: Loja com VISITA MENSAL = 4 deve ter 4 contratadas (mesmo proporcionalmente)", () => {
    const segments = [
      {
        validFrom: "2020-01-01",
        validUntil: null,
        weeklyFrequency: 1,
        monthlyFrequency: 4,
      },
    ];

    const res = contractedVisitsForFrequencySegments({
      segments,
      operationPeriodStart: window.startDate,
      operationPeriodEnd: window.endDate,
    });
    // O valor raw deve ser 4 agora
    expect(res.raw).toBe(4);
    expect(res.contratadas).toBe(4);
  });

  it("Caso 2: Loja com VISITA MENSAL = 8 deve ter 8 contratadas", () => {
    const segments = [
      {
        validFrom: "2020-01-01",
        validUntil: null,
        weeklyFrequency: 2,
        monthlyFrequency: 8,
      },
    ];
    const res = contractedVisitsForFrequencySegments({
      segments,
      operationPeriodStart: window.startDate,
      operationPeriodEnd: window.endDate,
    });
    expect(res.raw).toBe(8);
    expect(res.contratadas).toBe(8);
  });

  it("Caso 3: Loja com VISITA MENSAL = 2 deve ter 2 contratadas", () => {
    const segments = [
      {
        validFrom: "2020-01-01",
        validUntil: null,
        weeklyFrequency: 0.5,
        monthlyFrequency: 2,
      },
    ];
    const res = contractedVisitsForFrequencySegments({
      segments,
      operationPeriodStart: window.startDate,
      operationPeriodEnd: window.endDate,
    });
    expect(res.raw).toBe(2);
    expect(res.contratadas).toBe(2);
  });
});
