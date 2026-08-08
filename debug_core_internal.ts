import { supabaseAdmin } from './src/integrations/supabase/client.server';
import { loadOperationCore } from './src/lib/mk9-operations/core.server';
import { getOperationalVisits } from './src/lib/mk9-operations/operational-visits.server';

async function debug() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const year = 2026;
  const month = 8;

  const core = await loadOperationCore(supabaseAdmin, { industryId, year, month });
  const ctx = core.ctxById.get(industryId);
  
  console.log('--- INTERNAL STATE ---');
  console.log('Ctx Industry:', ctx?.name);
  console.log('Window:', ctx?.win.startDate, 'to', ctx?.win.endDate);
  
  // Verify what getOperationalVisits is returning INSIDE core context
  const visits = await getOperationalVisits({ industryId, startDate: ctx!.win.startDate, endDate: ctx!.win.endDate });
  console.log('Visits fetched:', visits.length);
  
  if (visits.length > 0) {
    const v = visits[0];
    console.log('First visit sample:', {
      industry_id: v.industry_id,
      store_id: v.store_id,
      scheduled_date: v.scheduled_date,
      store_uf: v.store?.uf
    });
    
    // Check passesUf logic (simulated)
    const uf = v.store?.uf;
    console.log('Passes UF check:', !!uf);
  }
}
debug();
