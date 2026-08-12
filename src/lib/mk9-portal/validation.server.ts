import { z } from "zod";
import { requireMk9Role } from "@/lib/mk9-auth/require-role.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Lógica pura separada do createServerFn para testabilidade
export async function listVisitEvidencesLogic(data: {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  promoterId?: string;
  industryId?: string;
  storeId?: string;
  page: number;
  limit: number;
}, request?: Request) {
  const ctx = await requireMk9Role(["ADMIN", "SUPERVISOR"], { request });
  const pageSize = Math.min(data.limit, 50);
  const offset = data.page * pageSize;

  let query = supabaseAdmin
    .from("mk9_visit_evidence")
    .select(`
      *,
      promoter:mk9_promoters(name),
      store:mk9_stores(name, chain),
      industry:mk9_industries(name)
    `, { count: 'exact' });

  if (data.status) query = query.eq("status", data.status);
  if (data.promoterId) query = query.eq("promoter_id", data.promoterId);
  if (data.industryId) query = query.eq("industry_id", data.industryId);
  if (data.storeId) query = query.eq("store_id", data.storeId);
  
  query = query.order("captured_at", { ascending: data.status === "PENDING" });
  query = query.range(offset, offset + pageSize - 1);

  const { data: evidences, error, count } = await query;
  if (error) throw error;

  return { evidences, count };
}

export async function processVisitEvidenceLogic(data: {
  evidenceId: string;
  action: "APPROVE" | "REJECT";
  rejectionReason?: string;
}, request?: Request) {
  const ctx = await requireMk9Role(["ADMIN", "SUPERVISOR"], { request });
  const now = new Date().toISOString();

  const updateData: any = {
    status: data.action === "APPROVE" ? "APPROVED" : "REJECTED",
    reviewed_by: ctx.userId,
    reviewed_at: now,
    updated_at: now
  };

  if (data.action === "REJECT") {
    if (!data.rejectionReason) throw new Error("MOTIVO_REJEICAO_OBRIGATORIO");
    updateData.rejection_reason = data.rejectionReason;
  }

  const { data: result, error } = await supabaseAdmin
    .from("mk9_visit_evidence")
    .update(updateData)
    .eq("id", data.evidenceId)
    .eq("status", "PENDING")
    .select("id")
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new Error("EVIDENCIA_NAO_ENCONTRADA_OU_JA_PROCESSADA");
    throw error;
  }

  return { success: true };
}
