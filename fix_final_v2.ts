import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function run() {
  const kingId = "6f36bb9d-e679-4538-9b58-e6adeb6638e2";
  const targetImportId = "2d7aa544-a44d-48fa-af4b-da243890ecd6";

  console.log("--- IDENTIFICANDO COLUNAS ---");
  const { data: cols } = await supabaseAdmin.from("mk9_checklist_imports").select("*").limit(1);
  const isOpCol = cols && cols[0] && 'is_operational_current' in cols[0] ? 'is_operational_current' : 'is_operational';
  
  const clearPayload: any = {}; clearPayload[isOpCol] = false;
  const setPayload: any = {}; setPayload[isOpCol] = true;

  await supabaseAdmin.from("mk9_checklist_imports").update(clearPayload).eq("industry_id", kingId).eq("operation_month", 8).eq("operation_year", 2026);
  await supabaseAdmin.from("mk9_checklist_imports").update(setPayload).eq("id", targetImportId);

  // BUSCA NOMES E UFS DAS LOJAS VINCULADAS ÀS VISITAS
  // Usamos inner join manual via select estruturado
  const { data: visits } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("store_id, mk9_stores!inner(name, uf)")
    .eq("source_import_id", targetImportId);

  const formosa = visits?.filter((v: any) => v.mk9_stores.name === "DIA A DIA - FORMOSA");
  
  console.log(`\nVisitas na loja DIA A DIA - FORMOSA vinculadas na importação: ${formosa?.length}`);
  if (formosa && formosa.length > 0) {
    console.log("UF vinculada:", formosa[0].mk9_stores.uf);
  }

  // Lista todas as visitas agrupadas por UF da loja vinculada
  const ufSummary = new Map();
  visits?.forEach((v: any) => {
    const uf = v.mk9_stores.uf;
    ufSummary.set(uf, (ufSummary.get(uf) || 0) + 1);
  });
  console.log("\nResumo UF das visitas (via mk9_stores):", JSON.stringify(Object.fromEntries(ufSummary), null, 2));
}

run();
