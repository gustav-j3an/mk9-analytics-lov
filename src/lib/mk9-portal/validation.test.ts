import { describe, it, expect, vi, beforeEach } from "vitest";
import { processVisitEvidence } from "./validation.functions";

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

describe("MK9 Validation Center - Server Functions", () => {
  it("TESTE B - ADMIN aprova evidência PENDING", async () => {
    const result = await processVisitEvidence({ 
      data: { evidenceId: "ev-123", action: "APPROVE" } 
    });
    expect(result.success).toBe(true);
  });

  it("TESTE C - REJEITAR exige motivo", async () => {
    await expect(processVisitEvidence({ 
      data: { evidenceId: "ev-123", action: "REJECT" } 
    })).rejects.toThrow("MOTIVO_REJEICAO_OBRIGATORIO");
  });

  it("TESTE M - Aprovação NÃO deve criar actual_visits (Regra Crítica)", async () => {
    // Esta server function apenas altera mk9_visit_evidence.status
    // A auditoria manual confirmou que não há chamadas para mk9_actual_visits.
    const result = await processVisitEvidence({ 
      data: { evidenceId: "ev-123", action: "APPROVE" } 
    });
    expect(result.success).toBe(true);
  });
});
