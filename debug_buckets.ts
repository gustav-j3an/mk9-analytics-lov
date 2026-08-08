import { supabaseAdmin } from './src/integrations/supabase/client.server';
import { loadOperationCore } from './src/lib/mk9-operations/core.server';

async function debug() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2';
  const year = 2026;
  const month = 8;

  const core = await loadOperationCore(supabaseAdmin, { industryId, year, month });
  const ctx = core.ctxById.get(industryId);
  
  console.log('--- BUCKET DEBUG ---');
  console.log('Buckets size:', ctx?.buckets.size);
  
  if (ctx && ctx.buckets.size > 0) {
    const firstBucketKey = Array.from(ctx.buckets.keys())[0];
    const firstBucket = ctx.buckets.get(firstBucketKey);
    console.log('First Bucket Sample:', {
      storeId: firstBucket?.storeId,
      storeName: firstBucket?.storeName,
      visitsCount: firstBucket?.visits.length,
      segmentsCount: firstBucket?.segments.length
    });
    
    // Check why buildIndustryRows might be returning 0
    console.log('IndustryRows count:', core.industryRows.length);
    if (core.industryRows.length > 0) {
      console.log('IndustryRow[0] actual:', core.industryRows[0].realizadas);
    }
  } else {
    console.log('ERROR: No buckets created in IndustryContext.');
  }
}
debug();
