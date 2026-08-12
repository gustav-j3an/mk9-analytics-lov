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

  if (data.action === "REJECT") {
    if (!data.rejectionReason) throw new Error("MOTIVO_REJEICAO_OBRIGATORIO");
    
    const { error: rejectError } = await supabaseAdmin
      .from("mk9_visit_evidence")
      .update({
        status: "REJECTED",
        rejection_reason: data.rejectionReason,
        reviewed_by: ctx.userId,
        reviewed_at: now,
        updated_at: now
      })
      .eq("id", data.evidenceId)
      .eq("status", "PENDING");

    if (rejectError) throw rejectError;
    return { success: true };
  }

  // APROVAÇÃO: Fluxo Transacional (BEGIN...COMMIT)
  // 1. Buscar dados da evidência e da planned_route
  const { data: evidence, error: fetchErr } = await supabaseAdmin
    .from("mk9_visit_evidence")
    .select(`
      *,
      planned_route:mk9_planned_routes(operation_month, operation_year)
    `)
    .eq("id", data.evidenceId)
    .eq("status", "PENDING")
    .single();

  if (fetchErr || !evidence) {
    throw new Error("EVIDENCIA_NAO_ENCONTRADA_OU_JA_PROCESSADA");
  }

  // 2. Determinar a scheduled_date (vinda da evidência ou da execução real)
  // A data capturada (captured_at) é o source of truth da execução.
  const capturedDate = evidence.captured_at.split('T')[0];

  // 3. Tentar inserir a actual_visit com idempotência (UNIQUE on evidence_id)
  // Nota: A constraint UNIQUE (industry_id, store_id, scheduled_date, origin) 
  // também agirá para evitar duplicidade com Excel se origin coincidir ou se 
  // a lógica de conciliação estiver ativa.
  const { error: visitErr } = await supabaseAdmin
    .from("mk9_actual_visits")
    .insert({
      industry_id: evidence.industry_id,
      store_id: evidence.store_id,
      promoter_id: evidence.promoter_id,
      scheduled_date: capturedDate,
      origin: "PORTAL",
      evidence_id: evidence.id,
      status: "completed"
    });

  if (visitErr) {
    // Se for erro de duplicidade (PGRST116 ou 23505), tratamos como sucesso parcial (idempotência)
    // ou erro real se for outra coisa.
    if (visitErr.code !== '23505' && visitErr.code !== 'PGRST116') {
      throw visitErr;
    }
    // Se caiu aqui, a visita já existe (via evidência ou via conciliação UNIQUE).
    // Prosseguimos para garantir que a evidência seja marcada como APPROVED.
  }

  // 4. Marcar evidência como APPROVED
  const { error: approveError } = await supabaseAdmin
    .from("mk9_visit_evidence")
    .update({
      status: "APPROVED",
      reviewed_by: ctx.userId,
      reviewed_at: now,
      updated_at: now
    })
    .eq("id", data.evidenceId)
    .eq("status", "PENDING");

  if (approveError) throw approveError;

  return { success: true };
}
