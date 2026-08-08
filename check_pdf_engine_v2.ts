import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function checkPDFEngine() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const importId = '9e868554-a9f3-4a25-acc2-51e673648512';

  // 1. Get PERSISTED_VISITS
  const { count: persistedVisits } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('*', { count: 'exact', head: true })
    .eq('source_import_id', importId);
  
  console.log('PERSISTED_VISITS:', persistedVisits);

  // 2. Breakdown by date
  const { data: visits } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('scheduled_date, store_id')
    .eq('source_import_id', importId);

  if (!visits) return;

  const julVisits = visits.filter(v => v.scheduled_date.startsWith('2026-07'));
  const augVisits = visits.filter(v => v.scheduled_date.startsWith('2026-08'));
  
  console.log('July visits:', julVisits.length);
  console.log('August visits:', augVisits.length);

  // 3. Check is_operational_current flag
  const { data: importData } = await supabaseAdmin
    .from('mk9_checklist_imports')
    .select('is_operational_current')
    .eq('id', importId)
    .single();
  
  console.log('Is Operational Current:', importData?.is_operational_current);

  // 4. Distinct (Store + Date)
  const distinctAug = new Set(augVisits.map(v => `${v.store_id}_${v.scheduled_date}`));
  const distinctJul = new Set(julVisits.map(v => `${v.store_id}_${v.scheduled_date}`));
  
  console.log('DISTINCT_AUGUST_VISITS:', distinctAug.size);
  console.log('DISTINCT_JULY_VISITS:', distinctJul.size);

  // 5. Check if another import is overriding it for August 2026
  const { data: otherImports } = await supabaseAdmin
    .from('mk9_checklist_imports')
    .select('id, filename, is_operational_current')
    .eq('industry_id', industryId)
    .eq('operation_month', 8)
    .eq('operation_year', 2026);
  
  console.log('All imports for KING Aug 2026:', JSON.stringify(otherImports, null, 2));
}

checkPDFEngine();
