import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMk9Role } from "@/lib/mk9-auth/require-role.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listVisitEvidences = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => 
    z.object({
      status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
      promoterId: z.string().uuid().optional(),
      industryId: z.string().uuid().optional(),
      storeId: z.string().uuid().optional(),
      page: z.number().default(0),
      limit: z.number().default(20),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN", "SUPERVISOR"]);
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
    
    // Filtro de Escopo Supervisor (reutiliza lógica do portal/dashboard)
    if (!ctx.roles.includes("ADMIN")) {
      // Nota: implementar filtro de escopo real aqui se necessário no futuro, 
      // por enquanto, vamos restringir ao básico.
    }

    query = query.order("captured_at", { ascending: data.status === "PENDING" });
    query = query.range(offset, offset + pageSize - 1);

    const { data: evidences, error, count } = await query;
    if (error) throw error;

    return { evidences, count };
  });

export const processVisitEvidence = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      evidenceId: z.string().uuid(),
      action: z.enum(["APPROVE", "REJECT"]),
      rejectionReason: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN", "SUPERVISOR"]);
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
      .eq("status", "PENDING") // Concorrência
      .select("id")
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw new Error("EVIDENCIA_NAO_ENCONTRADA_OU_JA_PROCESSADA");
      throw error;
    }

    return { success: true };
  });
