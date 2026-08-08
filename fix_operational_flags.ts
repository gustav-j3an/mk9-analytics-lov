import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function fix() {
  const kingId = "6f36bb9d-e679-4538-9b58-e6adeb6638e2";
  const targetImportId = "2d7aa544-a44d-48fa-af4b-da243890ecd6";

  console.log("--- LIMPANDO FLAGS OPERACIONAIS ANTIGAS (KING AGO/26) ---");
  const { error: clearErr } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .update({ is_operational_current: false })
    .eq("industry_id", kingId)
    .eq("operation_month", 8)
    .eq("operation_year", 2026);
  
  if (clearErr) console.error("Erro ao limpar flags:", clearErr);

  console.log("--- ATIVANDO FLAG OPERACIONAL PARA A IMPORTAÇÃO ALVO ---");
  const { error: setErr } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .update({ is_operational_current: true })
    .eq("id", targetImportId);

  if (setErr) console.error("Erro ao ativar flag:", setErr);
  else console.log("Flag ativada com sucesso para", targetImportId);

  console.log("--- LIMPANDO VISITAS ÓRFÃS DE OUTRAS IMPORTAÇÕES (OPCIONAL) ---");
  // Mantemos as visitas da 2d7aa544 e removemos o resto para evitar duplicidade de marcas se houver
  const { error: delErr } = await supabaseAdmin
    .from("mk9_actual_visits")
    .delete()
    .eq("industry_id", kingId)
    .neq("source_import_id", targetImportId)
    .eq("origin", "CHECKLIST");
  
  if (delErr) console.error("Erro ao limpar visitas:", delErr);
  else console.log("Visitas orfãs limpas.");
}

fix();
