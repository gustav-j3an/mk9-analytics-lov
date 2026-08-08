import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function checkPeriod() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const importId = '9e868554-a9f3-4a25-acc2-51e673648512';

  // 1. Check import status in DB
  const { data: importData } = await supabaseAdmin
    .from('mk9_checklist_imports')
    .select('*')
    .eq('id', importId)
    .single();
  
  console.log('Import record:', JSON.stringify(importData, null, 2));

  // 2. Check operational visits counts
  const { count: persistedVisits } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('*', { count: 'exact', head: true })
    .eq('source_import_id', importId);
  
  console.log('PERSISTED_VISITS:', persistedVisits);

  // 3. Check distinct operational visits (industry, store, date)
  const { data: distinctVisits } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('store_id, visit_date')
    .eq('industry_id', industryId)
    .eq('source_import_id', importId);
  
  const uniqueKeys = new Set(distinctVisits?.map(v => `${v.store_id}_${v.visit_date}`));
  console.log('DISTINCT_OPERATIONAL_VISITS:', uniqueKeys.size);

  // 4. Check visits inside period (Aug 2026)
  // Usually the period is defined in mk9_industry_period_config or dynamic
  const periodStart = '2026-08-01';
  const periodEnd = '2026-08-31';

  const { count: insidePeriod } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('*', { count: 'exact', head: true })
    .eq('industry_id', industryId)
    .eq('source_import_id', importId)
    .gte('visit_date', periodStart)
    .lte('visit_date', periodEnd);
  
  console.log('VISITS_INSIDE_PERIOD (Aug):', insidePeriod);

  // 5. Check source_import_id breakdown
  const { count: nullSource } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('*', { count: 'exact', head: true })
    .eq('industry_id', industryId)
    .is('source_import_id', null);
  
  console.log('NULL_SOURCE_VISITS:', nullSource);
}

checkPeriod();
