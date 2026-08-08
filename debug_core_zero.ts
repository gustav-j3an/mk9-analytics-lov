import { supabaseAdmin } from './src/integrations/supabase/client.server';
import { loadOperationCore } from './src/lib/mk9-operations/core.server';
import { getOperationalVisits } from './src/lib/mk9-operations/operational-visits.server';

async function debug() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const year = 2026;
  const month = 8;

  console.log('--- DEBUG START ---');
  
  // 1. Testar a função de domínio diretamente novamente
  const ops = await getOperationalVisits({
    industryId,
    startDate: '2026-07-23',
    endDate: '2026-08-22'
  });
  console.log('getOperationalVisits direct count:', ops.length);

  // 2. Rodar o core com logs internos (simulado)
  const core = await loadOperationCore(supabaseAdmin, {
    industryId,
    year,
    month
  });

  console.log('Core IndustryRows length:', core.industryRows.length);
  if (core.industryRows.length > 0) {
    console.log('IndustryRow[0] details:', JSON.stringify(core.industryRows[0], null, 2));
  } else {
    console.log('No industry rows found in core.');
  }

  // Verificar se a indústria existe no ctxById
  console.log('CtxById has industry:', core.ctxById.has(industryId));
  const ctx = core.ctxById.get(industryId);
  if (ctx) {
    console.log('Ctx Window:', ctx.win.startDate, 'to', ctx.win.endDate);
    console.log('Ctx Buckets size:', ctx.buckets.size);
    
    let totalVisitsInBuckets = 0;
    ctx.buckets.forEach(b => totalVisitsInBuckets += b.visits.length);
    console.log('Total visits in buckets:', totalVisitsInBuckets);
  }
}

debug();
