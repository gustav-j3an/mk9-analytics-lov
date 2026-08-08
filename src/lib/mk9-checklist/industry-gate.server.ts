/**
 * MK9 — Validação servidora da classificação "exige checklist".
 * Aplicada antes da prévia e antes do commit: manipular industry_id no navegador
 * não permite importar checklist para indústria não habilitada.
 */
import { checklistIndustryDisabledError, isChecklistIndustryAllowed } from "./industry-gate";

export async function assertIndustryRequiresChecklist(industryId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("mk9_industries")
    .select("id, name, requires_checklist")
    .eq("id", industryId)
    .maybeSingle();
  if (error) throw checklistIndustryDisabledError();
  const allowed = isChecklistIndustryAllowed(
    data
      ? {
          id: data.id as string,
          name: data.name as string,
          requiresChecklist: (data as any).requires_checklist === true,
        }
      : null,
  );
  if (!allowed) throw checklistIndustryDisabledError();
}
