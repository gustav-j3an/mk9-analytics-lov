import { describe, it, expect, vi } from "vitest";
import { processVisitEvidenceLogic } from "./validation.server";

// Mock Supabase
const mockSingle = vi.fn(() => Promise.resolve({ data: { id: "123" }, error: null }));
const mockInsert = vi.fn(() => ({ error: null }));
const mockUpdate = vi.fn(() => ({ 
  eq: vi.fn(() => ({ 
    eq: vi.fn(() => ({ error: null })) 
  })) 
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn((table) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => {
              if (table === "mk9_visit_evidence") {
                return Promise.resolve({ 
                  data: { 
                    id: "ev-123", 
                    status: "PENDING", 
                    industry_id: "ind-123", 
                    store_id: "store-123", 
                    promoter_id: "prom-123",
                    captured_at: "2026-08-10T12:00:00Z" 
                  }, 
                  error: null 
                });
              }
              return mockSingle();
            })
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
    const result = await processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "APPROVE" 
    });
    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("TESTE C - REJEITAR exige motivo e não cria visita", async () => {
    mockInsert.mockClear();
    await expect(processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "REJECT" 
    })).rejects.toThrow("MOTIVO_REJEICAO_OBRIGATORIO");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("TESTE D - Idempotência (Visita já existente não quebra aprovação)", async () => {
    mockInsert.mockReturnValue({ error: { code: '23505', message: 'Unique constraint violation' } });
    const result = await processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "APPROVE" 
    });
    expect(result.success).toBe(true);
  });

  it("TESTE 10/08/2026 - Data deve ser persistida sem deslocamento UTC", async () => {
    mockInsert.mockClear();
    await processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "APPROVE" 
    });
    const callArgs = mockInsert.mock.calls[0][0];
    expect(callArgs.scheduled_date).toBe("2026-08-10");
  });
});

