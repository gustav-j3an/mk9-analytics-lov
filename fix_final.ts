import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function run() {
  const kingId = "6f36bb9d-e679-4538-9b58-e6adeb6638e2";
  const targetImportId = "2d7aa544-a44d-48fa-af4b-da243890ecd6";

  console.log("--- ATIVANDO FLAG OPERACIONAL VIA RPC/SQL DIRETO ---");
  // Como is_operational_current está no banco mas o cache do PostgREST pode estar desatualizado,
  // tentamos usar a coluna is_operational se falhar (embora o diag disse ser is_operational_current)
  
  const { error: err1 } = await supabaseAdmin.from("mk9_checklist_imports").update({ is_operational_current: false } as any).eq("industry_id", kingId).eq("operation_month", 8).eq("operation_year", 2026);
  const { error: err2 } = await supabaseAdmin.from("mk9_checklist_imports").update({ is_operational_current: true } as any).eq("id", targetImportId);

  if (err2) {
    console.log("Erro com is_operational_current, tentando is_operational...");
    await supabaseAdmin.from("mk9_checklist_imports").update({ is_operational: false } as any).eq("industry_id", kingId).eq("operation_month", 8).eq("operation_year", 2026);
    await supabaseAdmin.from("mk9_checklist_imports").update({ is_operational: true } as any).eq("id", targetImportId);
  } else {
    console.log("Flag is_operational_current atualizada com sucesso.");
  }

  // Verificar se as visitas estão vinculadas à UF correta
  // Buscamos as visitas da importação alvo e vemos a UF da loja vinculada
  const { data: report } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("store:mk9_stores(name, uf)")
    .eq("source_import_id", targetImportId);
  
  const ufCounts = new Map();
  report?.forEach(r => {
    const uf = (r.store as any)?.uf;
    ufCounts.set(uf, (ufCounts.get(uf) || 0) + 1);
  });

  console.log("\nDistribuição de UF nas visitas realizadas:");
  console.log(JSON.stringify(Object.fromEntries(ufCounts), null, 2));

  // Checar especificamente a loja duplicada "DIA A DIA - FORMOSA"
  const { data: formosaVisits } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("store:mk9_stores(name, uf)")
    .eq("source_import_id", targetImportId)
    .filter("store.name", "eq", "DIA A DIA - FORMOSA");
  
  console.log("\nVisitas na loja DIA A DIA - FORMOSA:");
  console.log(JSON.stringify(formosaVisits, null, 2));
}

run();
