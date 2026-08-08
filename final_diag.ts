import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function finalDiag() {
  const kingId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  
  // 1. Check if is_operational_current column exists in mk9_checklist_imports
  const { data: cols } = await supabaseAdmin.from('mk9_checklist_imports').select('*').limit(1);
  console.log('mk9_checklist_imports columns:', Object.keys(cols?.[0] || {}));

  // 2. Check period config for KING
  const { data: periodConfig } = await supabaseAdmin
    .from('mk9_industry_period_config')
    .select('*')
    .eq('industry_id', kingId)
    .single();
  
  console.log('KING Period Config:', JSON.stringify(periodConfig, null, 2));

  // 3. Count ALL visits for KING in Aug 2026 regardless of import_id
  const { count: totalAug } = await supabaseAdmin
    .from('mk9_actual_visits')
    .select('*', { count: 'exact', head: true })
    .eq('industry_id', kingId)
    .gte('scheduled_date', '2026-08-01')
    .lte('scheduled_date', '2026-08-31');
  
  console.log('TOTAL_KING_VISITS_AUG_2026 (Database):', totalAug);

  // 4. Check if there are ANY records in mk9_industry_store_frequency_versions for this import
  const { count: freqCount } = await supabaseAdmin
    .from('mk9_industry_store_frequency_versions')
    .select('*', { count: 'exact', head: true })
    .eq('source_import_id', '9e868554-a9f3-4a25-acc2-51e673648512');
  
  console.log('FREQUENCY_VERSIONS_COUNT:', freqCount);
}

finalDiag();
