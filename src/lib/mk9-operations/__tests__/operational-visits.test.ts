import { describe, it, expect, vi } from "vitest";

// Fábrica do mock injetada diretamente no vi.mock para evitar hoist/ReferenceError
vi.mock("@/integrations/supabase/client.server", () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  return { supabaseAdmin: mockSupabase };
});

// Importar depois do mock para garantir que pegue a versão mockada
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOperationalVisits } from "../operational-visits.server";

const mockSupabase = supabaseAdmin as any;

describe("getOperationalVisits", () => {
  it("deve usar .or() com source_import_id.is.null quando houver importações vigentes", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "mk9_checklist_imports") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => Promise.resolve({ data: [{ id: "imp-123" }], error: null }),
              }),
            }),
          }),
        } as any;
      }
      return mockSupabase;
    });

    mockSupabase.limit.mockResolvedValue({ data: [], error: null });

    await getOperationalVisits({
      industryId: "ind-1",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });

    // Verificação exata da string com as aspas duplas escapadas corretamente pelo PostgREST/Supabase-js
    expect(mockSupabase.or).toHaveBeenCalledWith(
      expect.stringContaining('source_import_id.is.null,source_import_id.in.("imp-123")'),
    );
  });

  it("deve usar .is('source_import_id', null) quando não houver importações vigentes", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "mk9_checklist_imports") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        } as any;
      }
      return mockSupabase;
    });

    mockSupabase.limit.mockResolvedValue({ data: [], error: null });

    await getOperationalVisits({
      industryId: "ind-1",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });

    expect(mockSupabase.is).toHaveBeenCalledWith("source_import_id", null);
  });

  it("deve filtrar por um sourceImportId específico se fornecido", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "mk9_checklist_imports") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => Promise.resolve({ data: [{ id: "outra-imp" }], error: null }),
              }),
            }),
          }),
        } as any;
      }
      return mockSupabase;
    });

    await getOperationalVisits({
      industryId: "ind-1",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      sourceImportId: "target-imp",
    });

    expect(mockSupabase.eq).toHaveBeenCalledWith("source_import_id", "target-imp");
  });
});
