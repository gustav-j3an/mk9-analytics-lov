import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function fixBananaCorrenteJuly() {
  const industryId = "3bd4093f-4e47-4b26-b029-38c63c945051";
  const importId = "691c3ba6-3eb7-423a-aa81-3bbdbe2b770c";
  const month = 7;
  const year = 2026;

  console.log("[FIX] Iniciando correção forçada para BANANA CORRENTE Julho/2026...");

  // 1. Garantir que a importação correta seja a vigente
  const { error: err1 } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .update({ is_operational_current: true } as any)
    .eq("id", importId);
  if (err1) {
    console.error("[FIX] Erro ao ativar importação:", err1);
    return { success: false, error: err1.message };
  }

  const { error: err2 } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .update({ is_operational_current: false } as any)
    .eq("industry_id", industryId)
    .eq("operation_month", month)
    .eq("operation_year", year)
    .neq("id", importId);
  if (err2) {
    console.error("[FIX] Erro ao desativar importações antigas:", err2);
    return { success: false, error: err2.message };
  }

  // 2. Localizar as frequências versionadas que foram criadas para esta indústria nesta competência
  const { data: freqs, error: err3 } = await supabaseAdmin
    .from("mk9_industry_store_frequency_versions")
    .select("id, valid_from")
    .eq("industry_id", industryId)
    .is("archived_at", null);
  
  if (err3) {
    console.error("[FIX] Erro ao buscar frequências:", err3);
    return { success: false, error: err3.message };
  }

  let updatedFreqs = 0;
  if (freqs && freqs.length > 0) {
    console.log(`[FIX] Encontradas ${freqs.length} frequências. Atualizando source_import_id...`);
    const { error: err4 } = await supabaseAdmin
      .from("mk9_industry_store_frequency_versions")
      .update({ source_import_id: importId } as any)
      .in("id", freqs.map(f => f.id));
    if (err4) {
      console.error("[FIX] Erro ao atualizar source_import_id nas frequências:", err4);
      return { success: false, error: err4.message };
    }
    updatedFreqs = freqs.length;
  }

  console.log("[FIX] Correção concluída com sucesso.");
  return { 
    success: true, 
    importId, 
    industryId, 
    updatedFreqs 
  };
}
