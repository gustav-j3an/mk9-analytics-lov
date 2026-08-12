import { describe, it, expect, vi } from "vitest";
import { processVisitEvidenceLogic } from "./validation.server";

// Mock Supabase
const mockSingle = vi.fn(() => Promise.resolve({ 
  data: { 
    id: "ev-123", 
    status: "PENDING", 
    industry_id: "ind-123", 
    store_id: "store-123", 
    promoter_id: "prom-123",
    captured_at: "2026-08-10T12:00:00Z",
    planned_route: { operation_month: 8, operation_year: 2026 }
  }, 
  error: null as any
}));

const mockInsert = vi.fn(() => Promise.resolve({ error: null as any }));
const mockUpdate = vi.fn(() => ({ 
  eq: vi.fn(() => ({ 
    eq: vi.fn(() => Promise.resolve({ error: null as any })) 
  })) 
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mockSingle
          }))
        }))
      })),
      update: mockUpdate,
      insert: mockInsert
    }))
  }
}));

// Mock Auth
vi.mock("@/lib/mk9-auth/require-role.server", () => ({
  requireMk9Role: vi.fn(() => Promise.resolve({ userId: "user-123", roles: ["ADMIN"] }))
}));

describe("MK9 Validation Center - Server Logic (Missão 5)", () => {
  it("TESTE B - ADMIN aprova evidência e cria actual_visit", async () => {
    mockInsert.mockClear();
    mockSingle.mockClear();
    mockInsert.mockReturnValue(Promise.resolve({ error: null }));
    const result = await processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "APPROVE" 
    });
    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("TESTE C - REJEITAR exige motivo", async () => {
    mockInsert.mockClear();
    await expect(processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "REJECT" 
    })).rejects.toThrow("MOTIVO_REJEICAO_OBRIGATORIO");
  });

  it("TESTE D - Idempotência (Visita já existente não quebra aprovação)", async () => {
    mockInsert.mockClear();
    mockInsert.mockReturnValue(Promise.resolve({ error: { code: '23505', message: 'Unique constraint violation' } }));
    const result = await processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "APPROVE" 
    });
    expect(result.success).toBe(true);
  });

  it("TESTE 10/08/2026 - Data deve ser persistida sem deslocamento UTC", async () => {
    mockInsert.mockClear();
    mockInsert.mockReturnValue(Promise.resolve({ error: null }));
    await processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "APPROVE" 
    });
    // @ts-ignore
    const callArgs = mockInsert.mock.calls[0][0];
    expect(callArgs.scheduled_date).toBe("2026-08-10");
  });
});
