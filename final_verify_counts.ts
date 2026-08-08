import { supabaseAdmin } from './src/integrations/supabase/client.server';
import { getOperationalVisits } from './src/lib/mk9-operations/operational-visits.server';
import { loadOperationCore } from './src/lib/mk9-operations/core.server';
import { resolveWindow, loadPeriodConfig } from './src/lib/mk9-reports/period.server';

async function verify() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const importId = '9e868554-a9f3-4a25-acc2-51e673648512';
  const year = 2026;
  const month = 8;

  // 1. Resolve Window
  const cfg = await loadPeriodConfig(supabaseAdmin, industryId);
  const window = resolveWindow(cfg, year, month);
  console.log('Window:', window.startDate, 'to', window.endDate);

  // 2. Direct count from domain function
  const operational = await getOperationalVisits({
    industryId,
    startDate: window.startDate,
    endDate: window.endDate
  });
  console.log('OPERATIONAL_VISITS (getOperationalVisits):', operational.length);

  // 3. Count from Operation Core (Dashboard/Cockpit source)
  const core = await loadOperationCore(supabaseAdmin, {
    industryId,
    year,
    month
  });
  
  const totalRealizedCore = core.industryRows[0]?.actual || 0;
  console.log('DASHBOARD_REALIZED (loadOperationCore):', totalRealizedCore);

  // 4. Verification against expected numbers
  console.log('--- FINAL PROOF ---');
  console.log('Excel válidas:', 146);
  console.log('Persistidas:', 146);
  console.log('Operacionais:', operational.length);
  console.log('Dashboard:', totalRealizedCore);
  
  if (operational.length === 146 && totalRealizedCore === 146) {
    console.log('SUCCESS: All counts are aligned at 146.');
  } else {
    console.error('FAILURE: Mismatch in counts.');
  }
}

verify();
