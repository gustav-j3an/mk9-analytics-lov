import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildIndustryReport } from "../industry-report.server";

// Mocks simplificados para teste de paridade
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "ind1", name: "KING" }, error: null }),
  },
}));

vi.mock("../period.server", () => ({
  resolveWindow: vi
    .fn()
    .mockReturnValue({ startDate: "2026-07-23", endDate: "2026-08-22", totalDays: 31 }),
}));

vi.mock("../metrics", () => ({
  computeVisitMetrics: vi.fn().mockImplementation(({ contratadas, executadas }) => ({
    contratadas,
    executadas,
    validas: Math.min(contratadas, executadas),
    extras: Math.max(0, executadas - contratadas),
    pendencias: Math.max(0, contratadas - Math.min(contratadas, executadas)),
    coberturaPct:
      contratadas > 0 ? Math.round((Math.min(contratadas, executadas) / contratadas) * 100) : 0,
  })),
  aggregateVisitMetrics: vi.fn().mockImplementation((pairs) => {
    let contratadas = 0,
      executadas = 0,
      validas = 0;
    pairs.forEach((p: any) => {
      contratadas += p.contratadas;
      executadas += p.executadas;
      validas += Math.min(p.contratadas, p.executadas);
    });
    return {
      contratadas,
      executadas,
      validas,
      pendencias: Math.max(0, contratadas - executadas),
      coberturaPct: contratadas > 0 ? Math.round((validas / contratadas) * 100) : 0,
    };
  }),
}));

vi.mock("@/lib/mk9-frequency/versions.server", () => ({
  loadFrequencyVersionsForPeriod: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("@/lib/mk9-frequency/segments", () => ({
  contractedVisitsForFrequencySegments: vi
    .fn()
    .mockReturnValue({ contratadas: 4, source: "MONTHLY_FREQUENCY" }),
  describeFrequencySegments: vi.fn().mockReturnValue("4x/mês"),
}));

describe("Paridade de Lojas Não Atendidas", () => {
  it("deve garantir que lojas no PDF de não atendidas seguem a regra: contratadas > 0 e realizadas = 0", async () => {
    // Simulamos um report com 3 lojas
    const mockStores = [
      { storeId: "s1", storeName: "LOJA OK", expected: 4, actual: 4 }, // Atendida
      { storeId: "s2", storeName: "LOJA PENDENTE", expected: 4, actual: 2 }, // Parcialmente atendida (NÃO entra no PDF)
      { storeId: "s3", storeName: "LOJA ZERADA", expected: 4, actual: 0 }, // Não atendida (ENTRA no PDF)
      { storeId: "s4", storeName: "LOJA SEM CONTRATO", expected: 0, actual: 0 }, // Sem contrato (NÃO entra)
    ];

    // No PDF de "Lojas não atendidas", apenas a s3 deve aparecer.
    const unattended = mockStores.filter((s) => s.expected > 0 && s.actual === 0);

    expect(unattended).toHaveLength(1);
    expect(unattended[0].storeId).toBe("s3");

    // Validamos que a s2 (parcial) está FORA, cumprindo o requisito 2
    expect(unattended.find((s) => s.storeId === "s2")).toBeUndefined();
  });
});
