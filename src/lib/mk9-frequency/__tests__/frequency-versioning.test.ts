/**
 * MK9 — Fase 1B.2: testes permanentes do versionamento de frequências.
 *
 * Cobrem a classificação do diff e o contrato de aplicação transacional:
 *  - reimportação idêntica → 0 alterações;
 *  - alteração de frequência → CHANGED_FREQUENCY (nunca UPDATE de valor);
 *  - remoção da planilha → REMOVED_FROM_IMPORT (nunca DELETE);
 *  - alteração manual vigente → MANUAL_CONFLICT;
 *  - versão futura → FUTURE_VERSION_CONFLICT;
 *  - dedup por loja preservando o total contratado;
 *  - payload enviado à RPC transacional (force + justificativa + ator).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, any>;

const state: { versions: Row[]; stores: Row[]; rpcCalls: any[]; rpcResult: any } = {
  versions: [],
  stores: [],
  rpcCalls: [],
  rpcResult: { unchanged: 0, new: 0, changed: 0, removed: 0, skipped: 0, forced: 0 },
};

vi.mock("@/integrations/supabase/client.server", () => {
  const builder = (table: string) => {
    const q: any = {
      _rows: table === "mk9_stores" ? state.stores : state.versions,
      select() {
        return q;
      },
      eq(col: string, val: any) {
        q._rows = q._rows.filter((r: Row) => r[col] === val);
        return q;
      },
      is(col: string, val: any) {
        q._rows = q._rows.filter((r: Row) => (r[col] ?? null) === val);
        return q;
      },
      in(col: string, vals: any[]) {
        q._rows = q._rows.filter((r: Row) => vals.includes(r[col]));
        return q;
      },
      then(resolve: any) {
        return Promise.resolve({ data: q._rows, error: null }).then(resolve);
      },
    };
    return q;
  };
  return {
    supabaseAdmin: {
      from: (table: string) => builder(table),
      rpc: async (name: string, args: any) => {
        state.rpcCalls.push({ name, args });
        return { data: state.rpcResult, error: null };
      },
    },
  };
});

const { buildFrequencyDiff, applyFrequencyDiff, dedupIncoming } =
  await import("@/lib/mk9-frequency/diff.server");

const INDUSTRY = "11111111-1111-1111-1111-111111111111";
const STORE_1 = "aaaaaaa1-0000-0000-0000-000000000001";
const STORE_2 = "aaaaaaa1-0000-0000-0000-000000000002";

function version(partial: Partial<Row>): Row {
  return {
    id: crypto.randomUUID(),
    industry_id: INDUSTRY,
    store_id: STORE_1,
    weekly_frequency: null,
    monthly_frequency: 4,
    valid_from: "2026-07-01",
    valid_until: null,
    archived_at: null,
    source_type: "IMPORT",
    source_import_id: null,
    ...partial,
  };
}

beforeEach(() => {
  state.versions = [];
  state.stores = [
    { id: STORE_1, name: "Loja 1", uf: "SP" },
    { id: STORE_2, name: "Loja 2", uf: "RJ" },
  ];
  state.rpcCalls = [];
});

describe("buildFrequencyDiff", () => {
  it("reimportação idêntica não gera nenhuma alteração", async () => {
    state.versions = [version({ monthly_frequency: 4 })];
    const report = await buildFrequencyDiff(
      INDUSTRY,
      [{ storeId: STORE_1, weeklyFrequency: null, monthlyFrequency: 4 }],
      7,
      2026,
    );
    expect(report.unchanged).toBe(1);
    expect(report.new + report.changed + report.removed).toBe(0);
    expect(report.manualConflicts + report.futureConflicts).toBe(0);
  });

  it("frequência diferente gera CHANGED_FREQUENCY com nova versão", async () => {
    state.versions = [version({ monthly_frequency: 4 })];
    const report = await buildFrequencyDiff(
      INDUSTRY,
      [{ storeId: STORE_1, weeklyFrequency: null, monthlyFrequency: 6 }],
      7,
      2026,
    );
    expect(report.changed).toBe(1);
    const item = report.items[0];
    expect(item.kind).toBe("CHANGED_FREQUENCY");
    expect(item.currentVersionId).toBe(state.versions[0].id);
    expect(item.newVersion).toMatchObject({ monthly_frequency: 6, store_id: STORE_1 });
    expect(item.competencyStart).toBe("2026-07-01");
  });

  it("loja nova gera NEW_FREQUENCY sem versão anterior", async () => {
    const report = await buildFrequencyDiff(
      INDUSTRY,
      [{ storeId: STORE_2, weeklyFrequency: 1, monthlyFrequency: 4 }],
      7,
      2026,
    );
    expect(report.new).toBe(1);
    expect(report.items[0].currentVersionId).toBeNull();
  });

  it("loja ausente da planilha gera REMOVED_FROM_IMPORT (encerra vigência)", async () => {
    state.versions = [version({ store_id: STORE_2, monthly_frequency: 2 })];
    const report = await buildFrequencyDiff(
      INDUSTRY,
      [{ storeId: STORE_1, weeklyFrequency: null, monthlyFrequency: 4 }],
      7,
      2026,
    );
    expect(report.removed).toBe(1);
    const removed = report.items.find((i) => i.kind === "REMOVED_FROM_IMPORT")!;
    expect(removed.storeId).toBe(STORE_2);
    expect(removed.newVersion).toBeNull();
  });

  it("versão MANUAL vigente nunca é sobrescrita: gera MANUAL_CONFLICT", async () => {
    state.versions = [version({ source_type: "MANUAL", monthly_frequency: 9 })];
    const report = await buildFrequencyDiff(
      INDUSTRY,
      [{ storeId: STORE_1, weeklyFrequency: null, monthlyFrequency: 4 }],
      7,
      2026,
    );
    expect(report.manualConflicts).toBe(1);
    expect(report.changed).toBe(0);
  });

  it("versão MANUAL ausente da planilha é preservada (sem encerramento)", async () => {
    state.versions = [version({ store_id: STORE_2, source_type: "MANUAL" })];
    const report = await buildFrequencyDiff(INDUSTRY, [], 7, 2026);
    expect(report.removed).toBe(0);
    expect(report.items).toHaveLength(0);
  });

  it("versão futura nunca é destruída: gera FUTURE_VERSION_CONFLICT", async () => {
    state.versions = [version({ valid_from: "2026-09-01", monthly_frequency: 8 })];
    const report = await buildFrequencyDiff(
      INDUSTRY,
      [{ storeId: STORE_1, weeklyFrequency: null, monthlyFrequency: 4 }],
      7,
      2026,
    );
    expect(report.futureConflicts).toBe(1);
    expect(report.items[0].reason).toContain("2026-09-01");
  });

  it("versões já encerradas não contam como vigentes", async () => {
    state.versions = [version({ valid_from: "2026-05-01", valid_until: "2026-06-30" })];
    const report = await buildFrequencyDiff(
      INDUSTRY,
      [{ storeId: STORE_1, weeklyFrequency: null, monthlyFrequency: 4 }],
      7,
      2026,
    );
    expect(report.new).toBe(1);
  });
});

describe("dedupIncoming", () => {
  it("soma linhas da mesma loja e descarta linhas totalmente nulas", () => {
    const rows = dedupIncoming([
      { storeId: STORE_1, weeklyFrequency: null, monthlyFrequency: 2 },
      { storeId: STORE_1, weeklyFrequency: null, monthlyFrequency: 3 },
      { storeId: STORE_2, weeklyFrequency: null, monthlyFrequency: null },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].monthlyFrequency).toBe(5);
  });
});

describe("applyFrequencyDiff", () => {
  it("envia decisões, força e justificativa para a RPC transacional", async () => {
    state.versions = [version({ monthly_frequency: 4 })];
    const report = await buildFrequencyDiff(
      INDUSTRY,
      [{ storeId: STORE_1, weeklyFrequency: null, monthlyFrequency: 6 }],
      7,
      2026,
    );
    await applyFrequencyDiff("99999999-9999-9999-9999-999999999999", report, {
      force: true,
      reason: "Correção aprovada pela operação",
      actorId: "77777777-7777-7777-7777-777777777777",
    });
    const call = state.rpcCalls.at(-1)!;
    expect(call.name).toBe("mk9_apply_frequency_diff");
    expect(call.args._force).toBe(true);
    expect(call.args._reason).toBe("Correção aprovada pela operação");
    expect(call.args._actor).toBe("77777777-7777-7777-7777-777777777777");
    expect(call.args._decisions[0]).toMatchObject({
      kind: "CHANGED_FREQUENCY",
      competency_start: "2026-07-01",
    });
  });

  it("nenhuma escrita direta acontece fora da RPC (sem DELETE/UPSERT)", async () => {
    const report = await buildFrequencyDiff(
      INDUSTRY,
      [{ storeId: STORE_1, weeklyFrequency: null, monthlyFrequency: 4 }],
      7,
      2026,
    );
    await applyFrequencyDiff("99999999-9999-9999-9999-999999999999", report, { force: false });
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0].args._force).toBe(false);
  });
});
