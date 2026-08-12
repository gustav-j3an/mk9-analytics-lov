import { describe, it, expect, vi } from "vitest";
import { processVisitEvidenceLogic } from "./validation.server";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null as any }))
        }))
      })),
      insert: vi.fn()
    })),
    rpc: vi.fn(() => Promise.resolve({ data: { success: true, visit_id: "visit-123" }, error: null }))
  }
}));

vi.mock("@/lib/mk9-auth/require-role.server", () => ({
  requireMk9Role: vi.fn(() => Promise.resolve({ userId: "user-123", roles: ["ADMIN"] }))
}));

describe("MK9 Validation Center - Server Logic (Missão 5.1)", () => {
  it("TESTE B - ADMIN aprova evidência via RPC", async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    vi.mocked(supabaseAdmin.rpc).mockClear();
    
    const result = await processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "APPROVE" 
    });
    
    expect(result.success).toBe(true);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('mk9_approve_visit_evidence', expect.objectContaining({
      p_evidence_id: "ev-123",
      p_reviewer_id: "user-123"
    }));
  });

  it("TESTE C - REJEITAR exige motivo", async () => {
    await expect(processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "REJECT" 
    })).rejects.toThrow("MOTIVO_REJEICAO_OBRIGATORIO");
  });

  it("TESTE D - Erro na RPC deve ser propagado", async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    vi.mocked(supabaseAdmin.rpc).mockReturnValueOnce(Promise.resolve({ data: null, error: { message: "EVIDENCIA_NAO_ENCONTRADA" } as any }));
    
    await expect(processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "APPROVE" 
    })).rejects.toThrow("EVIDENCIA_NAO_ENCONTRADA_OU_JA_PROCESSADA");
  });
});
