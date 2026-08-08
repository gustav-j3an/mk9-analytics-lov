
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function fastDiagnosis() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const importId = 'b8171372-b968-4881-8200-e320bacfecc4';
  const startDate = '2026-08-01';
  const endDate = '2026-08-31';

  const { data: freqs } = await supabaseAdmin
    .from("mk9_industry_store_frequency_versions")
    .select("store_id, monthly_frequency, valid_from, valid_until, import_id")
    .eq("industry_id", industryId);
  
  console.log("Total de frequências da KING:", freqs?.length);
  const active = freqs?.filter(f => f.import_id === importId);
  console.log("Frequências da importação b8171372:", active?.length);
  const sum = active?.reduce((acc, f) => acc + (Number(f.monthly_frequency) || 0), 0);
  console.log("Soma contratadas (b8171372):", sum);

  const { data: visits } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("id, source_import_id")
    .eq("industry_id", industryId)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate);
  
  console.log("Total visitas KING Ago/26:", visits?.length);
  console.log("Distribuição de Import IDs nas visitas:", visits?.reduce((acc: any, v: any) => {
    acc[v.source_import_id || 'null'] = (acc[v.source_import_id || 'null'] || 0) + 1;
    return acc;
  }, {}));
}

fastDiagnosis().catch(console.error);
