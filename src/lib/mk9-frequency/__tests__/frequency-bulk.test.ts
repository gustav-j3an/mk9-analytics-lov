/**
 * MK9 — Testes do cadastro em lote de frequências e da conferência
 * "total contratado × total distribuído".
 *
 * Tudo aqui exercita as regras PURAS que o servidor reexecuta antes de gravar.
 * Nenhuma fórmula nova: o total distribuído sai sempre de
 * `contractedVisitsForFrequencySegments`.
 */
import { describe, it, expect } from "vitest";

import {
  bulkApplySchema,
  bulkPreviewSchema,
  bulkRpcItems,
  classifyBulkStore,
  computeStoreDistribution,
  contractTotalSchema,
  countBulkPreview,
  distributionLabel,
  divergenceSeverity,
  evaluateContract,
  groupDistribution,
  WRITABLE_KINDS,
  type BulkStoreState,
} from "@/lib/mk9-frequency/bulk";
import { contractedVisitsForFrequencySegments } from "@/lib/mk9-frequency/segments";

const JUL = { start: "2026-07-01", end: "2026-07-31" };

const store = (over: Partial<BulkStoreState> = {}): BulkStoreState => ({
  storeId: over.storeId ?? "s1",
  storeName: over.storeName ?? "Loja",
  chain: over.chain ?? "REDE",
  uf: over.uf ?? "SP",
  current: over.current ?? null,
  hasFutureVersion: over.hasFutureVersion ?? false,
  explicitlySelected: over.explicitlySelected,
});

const version = (weekly: number | null, monthly: number | null, sourceType = "IMPORT") => ({
  id: "v1",
  weeklyFrequency: weekly,
  monthlyFrequency: monthly,
  validFrom: "2026-01-01",
  validUntil: null,
  sourceType,
  updatedAt: "2026-07-01T00:00:00Z",
});

const seg = (
  monthly: number | null,
  weekly: number | null = null,
  from = "2020-01-01",
  until: string | null = null,
) => ({
  validFrom: from,
  validUntil: until,
  monthlyFrequency: monthly,
  weeklyFrequency: weekly,
});

// ---------------------------------------------------------------------------
describe("lote — aplicar 4x/mês em todas as lojas", () => {
  const input = { weeklyFrequency: 1, monthlyFrequency: 4, mode: "REPLACE_FROM_DATE" as const };

  it("lojas sem frequência viram NEW_FREQUENCY", () => {
    const item = classifyBulkStore(store(), input);
    expect(item.kind).toBe("NEW_FREQUENCY");
    expect(item.expectedUpdatedAt).toBeNull();
  });

  it("lojas com frequência diferente viram CHANGED_FREQUENCY", () => {
    const item = classifyBulkStore(store({ current: version(2, 8) }), input);
    expect(item.kind).toBe("CHANGED_FREQUENCY");
    expect(item.expectedUpdatedAt).toBe("2026-07-01T00:00:00Z");
  });

  it("reexecutar o mesmo lote não gera nova versão (UNCHANGED)", () => {
    const item = classifyBulkStore(store({ current: version(1, 4) }), input);
    expect(item.kind).toBe("UNCHANGED");
    expect(bulkRpcItems([item], "2026-07-01")).toHaveLength(0);
  });
});

describe("lote — modo somente lojas sem frequência", () => {
  const input = { weeklyFrequency: 1, monthlyFrequency: 4, mode: "ONLY_WITHOUT" as const };

  it("ignora lojas que já possuem vigência", () => {
    expect(classifyBulkStore(store({ current: version(2, 8) }), input).kind).toBe("SKIPPED");
  });

  it("cadastra apenas as lojas sem vigência", () => {
    expect(classifyBulkStore(store(), input).kind).toBe("NEW_FREQUENCY");
  });
});

describe("lote — modo somente lojas selecionadas", () => {
  const input = { weeklyFrequency: 1, monthlyFrequency: 4, mode: "SELECTED_ONLY" as const };

  it("loja não marcada é ignorada", () => {
    expect(classifyBulkStore(store({ explicitlySelected: false }), input).kind).toBe("SKIPPED");
  });

  it("loja marcada é aplicada", () => {
    expect(classifyBulkStore(store({ explicitlySelected: true }), input).kind).toBe(
      "NEW_FREQUENCY",
    );
  });
});

describe("lote — conflitos nunca são sobrescritos silenciosamente", () => {
  const input = { weeklyFrequency: 1, monthlyFrequency: 4, mode: "REPLACE_FROM_DATE" as const };

  it("frequência MANUAL vigente gera MANUAL_CONFLICT", () => {
    const item = classifyBulkStore(store({ current: version(2, 8, "MANUAL") }), input);
    expect(item.kind).toBe("MANUAL_CONFLICT");
    expect(WRITABLE_KINDS).not.toContain(item.kind);
  });

  it("conflito manual só é gravado com confirmação explícita", () => {
    const item = classifyBulkStore(store({ current: version(2, 8, "MANUAL") }), {
      ...input,
      forceManualConflicts: true,
    });
    expect(item.kind).toBe("CHANGED_FREQUENCY");
  });

  it("vigência futura gera FUTURE_VERSION_CONFLICT", () => {
    const item = classifyBulkStore(
      store({ current: version(2, 8), hasFutureVersion: true }),
      input,
    );
    expect(item.kind).toBe("FUTURE_VERSION_CONFLICT");
  });

  it("conflito futuro só é gravado com confirmação explícita", () => {
    const item = classifyBulkStore(store({ current: version(2, 8), hasFutureVersion: true }), {
      ...input,
      forceFutureConflicts: true,
    });
    expect(item.kind).toBe("CHANGED_FREQUENCY");
  });
});

describe("lote — payload enviado à RPC transacional", () => {
  it("só inclui itens graváveis e carrega o expected_updated_at de cada loja", () => {
    const items = [
      classifyBulkStore(store({ storeId: "a" }), {
        weeklyFrequency: 1,
        monthlyFrequency: 4,
        mode: "REPLACE_FROM_DATE",
      }),
      classifyBulkStore(store({ storeId: "b", current: version(1, 4) }), {
        weeklyFrequency: 1,
        monthlyFrequency: 4,
        mode: "REPLACE_FROM_DATE",
      }),
      classifyBulkStore(store({ storeId: "c", current: version(2, 8, "MANUAL") }), {
        weeklyFrequency: 1,
        monthlyFrequency: 4,
        mode: "REPLACE_FROM_DATE",
      }),
      classifyBulkStore(store({ storeId: "d", current: version(2, 8) }), {
        weeklyFrequency: 1,
        monthlyFrequency: 4,
        mode: "REPLACE_FROM_DATE",
      }),
    ];
    const payload = bulkRpcItems(items, "2026-07-01");
    expect(payload.map((p) => p.store_id)).toEqual(["a", "d"]);
    expect(payload[0].expected_updated_at).toBeNull();
    expect(payload[1].expected_updated_at).toBe("2026-07-01T00:00:00Z");
    expect(payload.every((p) => p.effective_date === "2026-07-01")).toBe(true);

    const counters = countBulkPreview(items);
    expect(counters).toMatchObject({
      selected: 4,
      new: 1,
      changed: 1,
      unchanged: 1,
      manualConflicts: 1,
      writable: 2,
    });
  });

  it("nada gravável = nada enviado (rollback nem chega a ser necessário)", () => {
    const items = [
      classifyBulkStore(store({ current: version(1, 4) }), {
        weeklyFrequency: 1,
        monthlyFrequency: 4,
        mode: "REPLACE_FROM_DATE",
      }),
    ];
    expect(bulkRpcItems(items, "2026-07-01")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("total distribuído — usa exclusivamente o motor oficial", () => {
  it("4x/mês em 3 lojas = 12 visitas", () => {
    const rows = computeStoreDistribution(
      ["a", "b", "c"].map((id) => ({ storeId: id, segments: [seg(4)] })),
      JUL,
    );
    expect(evaluateContract({ contractedTotal: 12, rows }).distributedTotal).toBe(12);
  });

  it("bate número a número com contractedVisitsForFrequencySegments", () => {
    const segments = [seg(null, 2)];
    const rows = computeStoreDistribution([{ storeId: "a", segments }], JUL);
    expect(rows[0].contratadas).toBe(
      contractedVisitsForFrequencySegments({
        segments,
        operationPeriodStart: JUL.start,
        operationPeriodEnd: JUL.end,
      }).contratadas,
    );
  });

  it("frequência quinzenal 0,5/2 conta 2 visitas", () => {
    const rows = computeStoreDistribution([{ storeId: "a", segments: [seg(2, 0.5)] }], JUL);
    expect(rows[0].contratadas).toBe(2);
    expect(distributionLabel([seg(2, 0.5)])).toBe("2x/mês");
  });

  it("mudança no meio do período soma proporcionalmente", () => {
    const rows = computeStoreDistribution(
      [
        {
          storeId: "a",
          segments: [seg(4, null, "2020-01-01", "2026-07-15"), seg(8, null, "2026-07-16")],
        },
      ],
      JUL,
    );
    // 4 × 15/31 + 8 × 16/31 = 1,935 + 4,129 = 6,06 → 6
    expect(rows[0].contratadas).toBe(6);
  });

  it("loja sem frequência entra com zero e é contada como 'sem frequência'", () => {
    const rows = computeStoreDistribution([{ storeId: "a", segments: [] }], JUL);
    const check = evaluateContract({ contractedTotal: 0, rows });
    expect(check.storesWithoutFrequency).toBe(1);
    expect(check.distributedTotal).toBe(0);
  });
});

describe("agrupamento da distribuição", () => {
  it("agrupa por frequência com lojas e visitas", () => {
    const rows = computeStoreDistribution(
      [
        ...Array.from({ length: 120 }, (_, i) => ({ storeId: `m4-${i}`, segments: [seg(4)] })),
        ...Array.from({ length: 15 }, (_, i) => ({ storeId: `m2-${i}`, segments: [seg(2)] })),
        ...Array.from({ length: 8 }, (_, i) => ({ storeId: `m8-${i}`, segments: [seg(8)] })),
      ],
      JUL,
    );
    const groups = groupDistribution(rows);
    expect(groups).toEqual([
      { label: "4x/mês", stores: 120, visits: 480 },
      { label: "8x/mês", stores: 8, visits: 64 },
      { label: "2x/mês", stores: 15, visits: 30 },
    ]);
    expect(groups.reduce((a, g) => a + g.visits, 0)).toBe(574);
  });
});

// ---------------------------------------------------------------------------
describe("conferência contrato × distribuição", () => {
  const rows = computeStoreDistribution(
    Array.from({ length: 136 }, (_, i) => ({ storeId: `s${i}`, segments: [seg(4)] })),
    JUL,
  );

  it("544 contratadas × 544 distribuídas = CONFERIDO", () => {
    const check = evaluateContract({ contractedTotal: 544, rows });
    expect(check.distributedTotal).toBe(544);
    expect(check.difference).toBe(0);
    expect(check.status).toBe("CONFERIDO");
    expect(check.message).toBeNull();
  });

  it("total contratado maior gera ABAIXO_DO_CONTRATO com aviso", () => {
    const check = evaluateContract({ contractedTotal: 572, rows });
    expect(check.status).toBe("ABAIXO_DO_CONTRATO");
    expect(check.difference).toBe(-28);
    expect(check.message).toContain("28 visita");
  });

  it("total contratado menor gera ACIMA_DO_CONTRATO", () => {
    expect(evaluateContract({ contractedTotal: 500, rows }).status).toBe("ACIMA_DO_CONTRATO");
  });

  it("sem total informado não acusa divergência", () => {
    const check = evaluateContract({ contractedTotal: null, rows });
    expect(check.status).toBe("SEM_TOTAL_INFORMADO");
    expect(check.difference).toBeNull();
    expect(check.message).toBeNull();
  });

  it("severidade do Centro de Qualidade: pequena = ATENCAO, relevante = CRITICO", () => {
    expect(divergenceSeverity(evaluateContract({ contractedTotal: 546, rows }))).toBe("ATENCAO");
    expect(divergenceSeverity(evaluateContract({ contractedTotal: 400, rows }))).toBe("CRITICO");
  });
});

describe("exceções por loja recalculam o total automaticamente", () => {
  it("padrão 1x/sem · 4x/mês com duas exceções", () => {
    const rows = computeStoreDistribution(
      [
        { storeId: "padrao1", segments: [seg(4, 1)] },
        { storeId: "padrao2", segments: [seg(4, 1)] },
        { storeId: "lojaA", segments: [seg(2, 0.5)] },
        { storeId: "lojaB", segments: [seg(8, 2)] },
      ],
      JUL,
    );
    const check = evaluateContract({ contractedTotal: 18, rows });
    expect(check.distributedTotal).toBe(4 + 4 + 2 + 8);
    expect(check.status).toBe("CONFERIDO");
    expect(groupDistribution(rows).map((g) => g.label)).toEqual(["4x/mês", "8x/mês", "2x/mês"]);
  });
});

describe("Base MK9 preserva o total comercial", () => {
  it("importação que altera a distribuição não altera o total contratado — só a conferência muda", () => {
    const contractedTotal = 544;
    const antes = computeStoreDistribution(
      Array.from({ length: 136 }, (_, i) => ({ storeId: `s${i}`, segments: [seg(4)] })),
      JUL,
    );
    const depois = computeStoreDistribution(
      Array.from({ length: 130 }, (_, i) => ({ storeId: `s${i}`, segments: [seg(4)] })),
      JUL,
    );
    expect(evaluateContract({ contractedTotal, rows: antes }).status).toBe("CONFERIDO");
    const check = evaluateContract({ contractedTotal, rows: depois });
    expect(check.contractedTotal).toBe(544);
    expect(check.status).toBe("ABAIXO_DO_CONTRATO");
    expect(check.difference).toBe(-24);
  });

  it("importação sem frequência não zera o total contratado", () => {
    const check = evaluateContract({ contractedTotal: 544, rows: [] });
    expect(check.contractedTotal).toBe(544);
    expect(check.distributedTotal).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("validação dos payloads (Zod strict)", () => {
  const base = {
    industryId: "11111111-1111-1111-1111-111111111111",
    selection: { scope: "ALL_LINKED", uf: null, chain: null, search: null, storeIds: [] },
    weeklyFrequency: 1,
    monthlyFrequency: 4,
    effectiveDate: "2026-07-01",
    mode: "REPLACE_FROM_DATE",
    competenceMonth: 7,
    competenceYear: 2026,
  };

  it("aceita uma prévia válida", () => {
    expect(bulkPreviewSchema.parse(base)).toMatchObject({ mode: "REPLACE_FROM_DATE" });
  });

  it("recusa lote sem frequência informada", () => {
    expect(() =>
      bulkPreviewSchema.parse({ ...base, weeklyFrequency: null, monthlyFrequency: null }),
    ).toThrow();
  });

  it("recusa campos desconhecidos", () => {
    expect(() => bulkPreviewSchema.parse({ ...base, hack: true })).toThrow();
  });

  it("aplicação exige justificativa", () => {
    expect(() => bulkApplySchema.parse({ ...base, reason: "x" })).toThrow();
    expect(
      bulkApplySchema.parse({ ...base, reason: "Ajuste comercial" }).forceManualConflicts,
    ).toBe(false);
  });

  it("total contratado recusa valor negativo", () => {
    expect(() =>
      contractTotalSchema.parse({
        industryId: base.industryId,
        competenceMonth: 7,
        competenceYear: 2026,
        contractedTotal: -1,
      }),
    ).toThrow();
  });
});
