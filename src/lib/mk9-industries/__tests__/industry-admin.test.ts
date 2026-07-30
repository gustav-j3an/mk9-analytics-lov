import { describe, expect, it } from "vitest";

import {
  archiveIndustrySchema,
  createIndustrySchema,
  industryRpcMessage,
  matchesStatusFilter,
  updateIndustrySchema,
} from "../admin";

describe("cadastro manual de indústria", () => {
  it("exige nome com pelo menos 2 caracteres", () => {
    expect(() => createIndustrySchema.parse({ name: "A" })).toThrow();
  });

  it("normaliza textos opcionais vazios para nulo", () => {
    const out = createIndustrySchema.parse({ name: "  Nova Indústria ", displayName: "   ", notes: "" });
    expect(out.name).toBe("Nova Indústria");
    expect(out.displayName).toBeNull();
    expect(out.notes).toBeNull();
    expect(out.requiresChecklist).toBe(false);
    expect(out.periodType).toBe("CALENDAR_MONTH");
  });

  it("exige dia inicial e final no período personalizado", () => {
    expect(() => createIndustrySchema.parse({ name: "Teste", periodType: "CUSTOM_CYCLE" })).toThrow();
    const ok = createIndustrySchema.parse({
      name: "Teste",
      periodType: "CUSTOM_CYCLE",
      startDay: 21,
      endDay: 20,
    });
    expect(ok.startDay).toBe(21);
  });
});

describe("edição — payload estrito", () => {
  const base = {
    industryId: "11111111-1111-1111-1111-111111111111",
    expectedUpdatedAt: "2026-07-30T00:00:00Z",
    name: "Indústria X",
  };

  it("aceita apenas campos cadastrais", () => {
    const out = updateIndustrySchema.parse(base);
    expect(out.name).toBe("Indústria X");
  });

  it("recusa metadados administrativos no payload", () => {
    for (const extra of ["created_by", "updated_by", "archived_by", "archived_at", "source_type", "id"]) {
      expect(() => updateIndustrySchema.parse({ ...base, [extra]: "x" })).toThrow();
    }
  });

  it("exige expected_updated_at para concorrência otimista", () => {
    expect(() => updateIndustrySchema.parse({ ...base, expectedUpdatedAt: "" })).toThrow();
    expect(() => archiveIndustrySchema.parse({ industryId: base.industryId })).toThrow();
  });

  it("limita o tamanho da observação operacional", () => {
    expect(() => updateIndustrySchema.parse({ ...base, notes: "x".repeat(1001) })).toThrow();
  });
});

describe("mensagens seguras das RPCs", () => {
  it("traduz códigos técnicos", () => {
    expect(industryRpcMessage("erro: MK9_DUPLICATE_INDUSTRY", "fallback")).toMatch(/já existe/i);
    expect(industryRpcMessage("MK9_CONCURRENT_UPDATE", "fallback")).toMatch(/alterado por outra pessoa/i);
    expect(industryRpcMessage("MK9_INDUSTRY_NOT_FOUND", "fallback")).toMatch(/não encontrada/i);
  });

  it("usa o texto genérico quando o erro é desconhecido", () => {
    expect(industryRpcMessage('relation "mk9_industries" violates policy', "Falhou.")).toBe("Falhou.");
  });
});

describe("filtro de status", () => {
  const ativa = { archivedAt: null };
  const arquivada = { archivedAt: "2026-07-01T00:00:00Z" };

  it("separa ativas de arquivadas", () => {
    expect(matchesStatusFilter(ativa, "active")).toBe(true);
    expect(matchesStatusFilter(ativa, "archived")).toBe(false);
    expect(matchesStatusFilter(arquivada, "archived")).toBe(true);
    expect(matchesStatusFilter(arquivada, "all")).toBe(true);
  });
});
