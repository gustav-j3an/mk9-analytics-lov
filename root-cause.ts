
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function rootCause() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const importId = 'b8171372-b968-4881-8200-e320bacfecc4';
  const startDate = '2026-08-01';
  const endDate = '2026-08-31';

  console.log("--- BUSCA DE CAUSA RAIZ ---");

  // 1. Verificar se a query do PDF (loadFrequencyVersionsForPeriod) encontraria as lojas
  const { data: freqs, error: err } = await supabaseAdmin
    .from("mk9_industry_store_frequency_versions")
    .select("industry_id, store_id, weekly_frequency, monthly_frequency, valid_from, valid_until, store:mk9_stores(id,name,uf)")
    .eq("industry_id", industryId)
    .is("archived_at", null)
    .lte("valid_from", endDate)
    .or(`valid_until.is.null,valid_until.gte.${startDate}`);
  
  if (err) console.error(err);
  console.log(`Lojas encontradas pela query do PDF: ${freqs?.length}`);
  
  const totalMonthly = freqs?.reduce((acc: number, f: any) => acc + (Number(f.monthly_frequency) || 0), 0);
  console.log(`Total mensal (contratadas) detectado: ${totalMonthly}`);

  // 2. Verificar as visitas reais pela mesma query do PDF
  const { data: visits } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select("id, source_import_id")
    .eq("industry_id", industryId)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate);
  
  console.log(`Visitas no período: ${visits?.length}`);
  const importsFound = [...new Set(visits?.map((v: any) => v.source_import_id))];
  console.log(`Import IDs nas visitas:`, importsFound);
}

rootCause().catch(console.error);
