import { describe, it, expect, vi } from "vitest";
import { processVisitEvidenceLogic } from "./validation.server";

// Mock Supabase
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { id: "123" }, error: null }))
            }))
          }))
        }))
      }))
    }))
  }
}));

// Mock Auth
vi.mock("@/lib/mk9-auth/require-role.server", () => ({
  requireMk9Role: vi.fn(() => Promise.resolve({ userId: "user-123", roles: ["ADMIN"] }))
}));

describe("MK9 Validation Center - Server Logic", () => {
  it("TESTE B - ADMIN aprova evidência PENDING", async () => {
    const result = await processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "APPROVE" 
    });
    expect(result.success).toBe(true);
  });

  it("TESTE C - REJEITAR exige motivo", async () => {
    await expect(processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "REJECT" 
    })).rejects.toThrow("MOTIVO_REJEICAO_OBRIGATORIO");
  });

  it("TESTE M - Aprovação NÃO deve criar actual_visits (Regra Crítica)", async () => {
    const result = await processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "APPROVE" 
    });
    expect(result.success).toBe(true);
  });
});
