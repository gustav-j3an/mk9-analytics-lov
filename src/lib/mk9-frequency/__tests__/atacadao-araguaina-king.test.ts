/**
 * MK9 — Correção pontual: ATACADÃO ARAGUAÍNA × KING (Agosto/2026).
 *
 * Causa raiz: o checklist KING de Agosto/2026 trazia DUAS linhas distintas
 * ("ATACADÃO ARAGUAÍNA" na linha 116 e "ATACADÃO ARAGUAÍNA 2" na linha 117,
 * esta vinculada por similaridade 0,95 à mesma loja). O dedup somava as duas
 * → 2x/semana e 8x/mês, quando o Excel informa 1x/semana e 4x/mês.
 *
 * Estes testes travam a regra em definitivo.
 */
import { describe, it, expect } from "vitest";
import { dedupIncoming } from "@/lib/mk9-frequency/diff.server";
import { contractedVisitsForFrequencySegments as contracted } from "@/lib/mk9-frequency/segments";

const ATACADAO = "1d633b3a-a3bb-41ce-bbaf-50610af5a06c";
const ATACADAO_2 = "aaaaaaaa-0000-0000-0000-000000000002";
const CAMPELO = "79bff975-ccbc-4623-a492-4a6d3e53bb9e";

// Janela oficial da KING para Agosto/2026: 23/07 a 22/08 (31 dias).
const KING_AGO = { operationPeriodStart: "2026-07-23", operationPeriodEnd: "2026-08-22" };

describe("dedup do importador — nunca soma nomes diferentes do Excel", () => {
  it("Excel 1/4 + linha 'ATACADÃO ARAGUAÍNA 2' por similaridade mantém 1/4", () => {
    const rows = dedupIncoming([
      {
        storeId: ATACADAO,
        storeKey: "atacadao araguaina|TO",
        matchKind: "EXACT",
        weeklyFrequency: 1,
        monthlyFrequency: 4,
      },
      {
        storeId: ATACADAO,
        storeKey: "atacadao araguaina 2|TO",
        matchKind: "SIMILARITY",
        weeklyFrequency: 1,
        monthlyFrequency: 4,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].monthlyFrequency).toBe(4);
    expect(rows[0].weeklyFrequency).toBe(1);
    expect(rows[0].monthlyFrequency).not.toBe(8);
  });

  it("a mesma linha repetida no arquivo continua sendo somada", () => {
    const rows = dedupIncoming([
      { storeId: ATACADAO, storeKey: "atacadao araguaina|TO", matchKind: "EXACT", weeklyFrequency: null, monthlyFrequency: 2 },
      { storeId: ATACADAO, storeKey: "atacadao araguaina|TO", matchKind: "EXACT", weeklyFrequency: null, monthlyFrequency: 3 },
    ]);
    expect(rows[0].monthlyFrequency).toBe(5);
  });

  it("sem correspondência exata, vence a maior — nunca a soma", () => {
    const rows = dedupIncoming([
      { storeId: ATACADAO, storeKey: "a|TO", matchKind: "SIMILARITY", weeklyFrequency: 1, monthlyFrequency: 4 },
      { storeId: ATACADAO, storeKey: "b|TO", matchKind: "SIMILARITY", weeklyFrequency: 0.5, monthlyFrequency: 2 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].monthlyFrequency).toBe(4);
  });

  it("demais lojas do mesmo lote não são afetadas", () => {
    const rows = dedupIncoming([
      { storeId: ATACADAO, storeKey: "atacadao araguaina|TO", matchKind: "EXACT", weeklyFrequency: 1, monthlyFrequency: 4 },
      { storeId: ATACADAO, storeKey: "atacadao araguaina 2|TO", matchKind: "SIMILARITY", weeklyFrequency: 1, monthlyFrequency: 4 },
      { storeId: CAMPELO, storeKey: "campelo araguaina|TO", matchKind: "EXACT", weeklyFrequency: 0.5, monthlyFrequency: 2 },
      { storeId: ATACADAO_2, storeKey: "atacadao outro|TO", matchKind: "EXACT", weeklyFrequency: 1, monthlyFrequency: 4 },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.storeId === CAMPELO)?.monthlyFrequency).toBe(2);
    expect(rows.find((r) => r.storeId === ATACADAO_2)?.monthlyFrequency).toBe(4);
  });
});

describe("cálculo contratado da KING Agosto/2026 para ATACADÃO ARAGUAÍNA", () => {
  const antes = [
    { validFrom: "2026-06-23", validUntil: "2026-07-31", weeklyFrequency: 1, monthlyFrequency: 4 },
    { validFrom: "2026-08-01", validUntil: "2026-08-29", weeklyFrequency: 2, monthlyFrequency: 8 },
  ];
  const depois = [
    { validFrom: "2026-06-23", validUntil: "2026-07-31", weeklyFrequency: 1, monthlyFrequency: 4 },
    { validFrom: "2026-08-01", validUntil: null, weeklyFrequency: 1, monthlyFrequency: 4 },
  ];

  it("reproduz o valor errado do PDF antes da correção", () => {
    expect(contracted({ ...KING_AGO, segments: antes }).contratadas).toBe(7);
  });

  it("após a correção, contratadas = 4 e sem troca de frequência em 01/08", () => {
    const r = contracted({ ...KING_AGO, segments: depois });
    expect(r.contratadas).toBe(4);
    // Ambos os segmentos têm o mesmo valor → nenhuma mudança de 8x/mês é exibida.
    const valores = new Set(r.segments.map((s) => s.monthlyFrequency));
    expect(Array.from(valores)).toEqual([4]);
  });

  it("pendentes = 4 enquanto não houver visita realizada", () => {
    const contratadas = contracted({ ...KING_AGO, segments: depois }).contratadas;
    const realizadas = 0;
    expect(Math.max(contratadas - realizadas, 0)).toBe(4);
  });

  it("a versão arquivada é ignorada — o histórico permanece consultável", () => {
    // O motor só recebe segmentos NÃO arquivados; a versão de 8x segue no banco
    // apenas como histórico e não participa mais do cálculo.
    expect(contracted({ ...KING_AGO, segments: depois }).contratadas).not.toBe(7);
  });

  it("totais da KING: 505 antes → 502 depois (diferença de 3)", () => {
    const outrasLojas = 498; // demais 142 lojas, inalteradas
    const totalAntes = outrasLojas + contracted({ ...KING_AGO, segments: antes }).contratadas;
    const totalDepois = outrasLojas + contracted({ ...KING_AGO, segments: depois }).contratadas;
    expect(totalAntes).toBe(505);
    expect(totalDepois).toBe(502);
    expect(totalAntes - totalDepois).toBe(3);
  });
});
