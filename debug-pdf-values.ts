import { supabaseAdmin } from './src/integrations/supabase/client.server';
import { buildIndustryReport } from './src/lib/mk9-reports/industry-report.server';
import { resolveWindow, loadPeriodConfig } from './src/lib/mk9-reports/period.server';

async function debug() {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2'; // KING
  const year = 2026;
  const month = 8;

  const cfg = await loadPeriodConfig(supabaseAdmin, industryId);
  const window = resolveWindow(cfg, year, month);

  console.log('Window:', window);

  const report = await buildIndustryReport(supabaseAdmin, {
    industryId,
    year,
    month,
    access: null
  }, window);

  console.log('Total Contratadas:', report.totals.contracted);
  console.log('Total Stores:', report.totals.totalStores);

  const samples = report.stores.filter(s => 
    s.storeName.includes('ACRISUL') || 
    s.storeName.includes('BRASÍLIA NORTE') || 
    s.storeName.includes('TAGUATINGA QNL') ||
    s.storeName.includes('VIA LAGO')
  );

  samples.forEach(s => {
    console.log(`Store: ${s.storeName}`);
    console.log(`  Freq: ${s.frequencyLabel}`);
    console.log(`  Monthly: ${s.monthlyFrequency}`);
    console.log(`  Contracted (expected): ${s.expected}`);
    
    // We need to look deeper into where buildIndustryReport calls contractedVisitsForFrequencySegments
  });

  // Let's manually check for one store
  const storeId = samples[0].storeId;
  const { loadFrequencyVersionsForPeriod } = await import('./src/lib/mk9-frequency/versions.server');
  const freqVersions = await loadFrequencyVersionsForPeriod(supabaseAdmin, {
    industryIds: [industryId],
    storeIds: [storeId],
    periodStart: window.startDate,
    periodEnd: window.endDate,
  });

  const segs = freqVersions.get(`${industryId}|${storeId}`);
  console.log('Segments for sample store:', JSON.stringify(segs, null, 2));

}

debug().catch(console.error);
