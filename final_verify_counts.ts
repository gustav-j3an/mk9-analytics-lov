import { supabaseAdmin } from './src/integrations/supabase/client.server';
import { getOperationalVisits } from './src/lib/mk9-operations/operational-visits.server';
import { loadOperationCore } from './src/lib/mk9-operations/core.server';
import { resolveWindow, loadPeriodConfig } from './src/lib/mk9-reports/period.server';

async function verify() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const importId = '9e868554-a9f3-4a25-acc2-51e673648512';
  const year = 2026;
  const month = 8;

  const cfg = await loadPeriodConfig(supabaseAdmin, industryId);
  const window = resolveWindow(cfg, year, month);

  const operational = await getOperationalVisits({
    industryId,
    startDate: window.startDate,
    endDate: window.endDate
  });

  const core = await loadOperationCore(supabaseAdmin, {
    industryId,
    year,
    month
  });
  
  const totalRealizedCore = core.industryRows[0]?.realizadas || 0;

  console.log('--- FINAL PROOF ---');
  console.log('Excel válidas:  146');
  console.log('Banco (Operac): ' + operational.length);
  console.log('Dashboard:      ' + totalRealizedCore);
  
  if (operational.length === 146 && totalRealizedCore === 146) {
    console.log('\x1b[32m%s\x1b[0m', 'SUCCESS: All counts are aligned at 146.');
  } else {
    console.log('\x1b[31m%s\x1b[0m', 'FAILURE: Mismatch in counts.');
    process.exit(1);
  }
}

verify();
