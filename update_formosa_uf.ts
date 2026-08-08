import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function run() {
  const kingId = "6f36bb9d-e679-4538-9b58-e6adeb6638e2";
  const targetImportId = "2d7aa544-a44d-48fa-af4b-da243890ecd6";

  console.log("--- CORRIGINDO VÍNCULO DIA A DIA - FORMOSA (DF -> GO) ---");

  // 1. Localizar a loja correta em GO
  const { data: storeGo } = await supabaseAdmin
    .from("mk9_stores")
    .select("id")
    .eq("name", "DIA A DIA - FORMOSA")
    .eq("uf", "GO")
    .single();

  // 2. Localizar a loja errada em DF
  const { data: storeDf } = await supabaseAdmin
    .from("mk9_stores")
    .select("id")
    .eq("name", "DIA A DIA - FORMOSA")
    .eq("uf", "DF")
    .single();

  if (storeGo && storeDf) {
    console.log(`GO ID: ${storeGo.id}, DF ID: ${storeDf.id}`);

    // Atualiza a visita na tabela de realizadas
    const { error: visitErr } = await supabaseAdmin
      .from("mk9_actual_visits")
      .update({ store_id: storeGo.id })
      .eq("source_import_id", targetImportId)
      .eq("store_id", storeDf.id);

    if (visitErr) console.error("Erro ao atualizar visita:", visitErr);
    else console.log("Visita atualizada para GO.");

    // Atualiza a frequência na tabela de versões
    const { error: freqErr } = await supabaseAdmin
      .from("mk9_industry_store_frequency_versions")
      .update({ store_id: storeGo.id })
      .eq("source_import_id", targetImportId)
      .eq("store_id", storeDf.id);

    if (freqErr) console.error("Erro ao atualizar frequência:", freqErr);
    else console.log("Frequência atualizada para GO.");
  }
}

run();
