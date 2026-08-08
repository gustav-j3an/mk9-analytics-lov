import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function diagAndFix() {
  console.log("--- INVESTIGANDO COLUNAS DE mk9_checklist_imports ---");
  // Pegamos uma linha para ver as chaves reais
  const { data: sample } = await supabaseAdmin.from("mk9_checklist_imports").select("*").limit(1);
  if (sample && sample[0]) {
    console.log("Colunas disponíveis:", Object.keys(sample[0]).join(", "));
  }

  const kingId = "6f36bb9d-e679-4538-9b58-e6adeb6638e2";
  const targetImportId = "2d7aa544-a44d-48fa-af4b-da243890ecd6";
  
  // Se a coluna for is_operational (sem o _current)
  const isOpColumn = sample && sample[0] && 'is_operational' in sample[0] ? 'is_operational' : 'is_operational_current';
  console.log(`Usando coluna: ${isOpColumn}`);

  const updatePayload: any = {};
  updatePayload[isOpColumn] = false;

  await supabaseAdmin
    .from("mk9_checklist_imports")
    .update(updatePayload)
    .eq("industry_id", kingId)
    .eq("operation_month", 8)
    .eq("operation_year", 2026);
  
  updatePayload[isOpColumn] = true;
  const { error: setErr } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .update(updatePayload)
    .eq("id", targetImportId);

  if (setErr) console.error("Erro ao ativar flag:", setErr);
  else console.log("Flag ativada com sucesso!");

  // Prova final: Contagem de visitas e lojas para o PDF
  const { data: visits } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("id")
    .eq("source_import_id", targetImportId);
  
  const { data: freqs } = await supabaseAdmin
    .from("mk9_industry_store_frequency_versions")
    .select("store_id")
    .eq("source_import_id", targetImportId);

  console.log(`\nRESULTADO FINAL (Import 2d7aa544):`);
  console.log(`- Visitas Realizadas: ${visits?.length || 0}`);
  console.log(`- Lojas com Frequência: ${new Set(freqs?.map(f => f.store_id)).size || 0}`);
}

diagAndFix();
