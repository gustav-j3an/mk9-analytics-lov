import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function checkPDFEngine() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const importId = '9e868554-a9f3-4a25-acc2-51e673648512';
  const month = 8;
  const year = 2026;

  // 1. Get PERSISTED_VISITS again
  const { count: persistedVisits } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('*', { count: 'exact', head: true })
    .eq('source_import_id', importId);
  
  console.log('PERSISTED_VISITS:', persistedVisits);

  // 2. Check visits inside period (Aug 2026) - EXACT DATES FROM PREVIEW
  // Let's look at the dates in the preview items. They seem to be late July and August.
  // The report engine likely filters by month/year based on visit_date OR uses the period config.
  
  const { data: visits } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('visit_date')
    .eq('source_import_id', importId);

  const julVisits = visits?.filter(v => v.visit_date.startsWith('2026-07')) || [];
  const augVisits = visits?.filter(v => v.visit_date.startsWith('2026-08')) || [];
  
  console.log('July visits:', julVisits.length);
  console.log('August visits:', augVisits.length);

  // 3. Locate and simulate PDF engine query
  // Based on context: src/lib/mk9-operations/operational-visits.server.ts
  // uses is_operational_current: true in mk9_checklist_imports
  
  const { data: currentImport } = await supabaseAdmin
    .from('mk9_checklist_imports')
    .select('id, is_operational_current')
    .eq('id', importId)
    .single();
  
  console.log('Is Current Operational:', currentImport?.is_operational_current);

  // 4. Count distinct (Store + Date) for July and August
  const { data: allVisits } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('store_id, visit_date')
    .eq('industry_id', industryId)
    .eq('source_import_id', importId);

  const distinctAug = new Set(augVisits.map(v => `${v.store_id}_${v.visit_date}`));
  console.log('DISTINCT_AUGUST_VISITS:', distinctAug.size);
  
  const distinctJul = new Set(julVisits.map(v => `${v.store_id}_${v.visit_date}`));
  console.log('DISTINCT_JULY_VISITS:', distinctJul.size);
}

checkPDFEngine();
