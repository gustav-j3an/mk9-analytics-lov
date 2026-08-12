import { describe, it, expect, vi } from "vitest";
import { processVisitEvidenceLogic } from "./validation.server";

// Mocks
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

const mockRpc = vi.fn(() => Promise.resolve({ data: { success: true }, error: null as any }));

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
    })),
    rpc: mockRpc
  }
}));

// Mock Auth
vi.mock("@/lib/mk9-auth/require-role.server", () => ({
  requireMk9Role: vi.fn(() => Promise.resolve({ userId: "user-123", roles: ["ADMIN"] }))
}));

describe("MK9 Validation Center - Server Logic (Missão 5.1)", () => {
  it("TESTE B - ADMIN aprova evidência via RPC", async () => {
    mockRpc.mockClear();
    const result = await processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "APPROVE" 
    });
    expect(result.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('mk9_approve_visit_evidence', expect.objectContaining({
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
    mockRpc.mockReturnValueOnce(Promise.resolve({ data: null, error: { message: "EVIDENCIA_NAO_ENCONTRADA" } as any }));
    await expect(processVisitEvidenceLogic({ 
      evidenceId: "ev-123", action: "APPROVE" 
    })).rejects.toThrow("EVIDENCIA_NAO_ENCONTRADA_OU_JA_PROCESSADA");
  });
});
