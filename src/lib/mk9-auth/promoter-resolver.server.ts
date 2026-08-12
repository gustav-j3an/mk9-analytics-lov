import { requireMk9Role } from "./require-role.server";

export type PromoterInfo = {
  id: string;
  name: string;
  employee_number: string | null;
};

export async function getCurrentPromoter(): Promise<PromoterInfo> {
  const ctx = await requireMk9Role(["PROMOTOR", "ADMIN", "SUPERVISOR"]);
  
  if (!ctx.userId) {
    throw new Error("Sessão inválida.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: promoter, error } = await supabaseAdmin
    .from("mk9_promoters")
    .select("id, name, employee_number")
    .eq("user_id", ctx.userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[MK9-PORTAL] Erro ao buscar promotor vinculado:", error);
    throw new Error("Falha ao carregar perfil de promotor.");
  }

  if (!promoter) {
    // Retorna erro controlado para ser capturado pela UI
    throw new Error("PROMOTER_NOT_LINKED");
  }

  return promoter;
}
