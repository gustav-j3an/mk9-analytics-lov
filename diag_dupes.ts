import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function diag() {
  console.log("--- BUSCANDO LOJAS DUPLICADAS POR NOME ---");
  const { data: allStores } = await supabaseAdmin.from("mk9_stores").select("name, uf, id");
  const counts = new Map();
  allStores?.forEach(s => {
    counts.set(s.name, (counts.get(s.name) || 0) + 1);
  });
  const realDupes = allStores?.filter(s => counts.get(s.name) > 1);
  console.log("Duplicatas encontradas:", JSON.stringify(realDupes, null, 2));

  console.log("\n--- VERIFICANDO FLAG is_operational_current KING AGOSTO/2026 ---");
  const { data: ind } = await supabaseAdmin.from("mk9_industries").select("id").ilike("name", "%KING%").maybeSingle();
  const kingId = ind?.id;
  console.log("ID da KING identificado:", kingId);

  if (kingId) {
    const { data: imports } = await supabaseAdmin
      .from("mk9_checklist_imports")
      .select("id, status, is_operational_current, operation_month, operation_year")
      .eq("industry_id", kingId)
      .eq("operation_month", 8)
      .eq("operation_year", 2026);
    
    console.log("Importações KING Ago/26:", JSON.stringify(imports, null, 2));
  }
}

diag();
