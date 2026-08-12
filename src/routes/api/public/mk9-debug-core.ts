import { createFileRoute } from '@tanstack/react-router';
import { loadOperationCore } from '@/lib/mk9-operations/core.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const Route = createFileRoute('/api/public/mk9-debug-core')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { year, month, industryId } = body;
          
          const core = await loadOperationCore(supabaseAdmin, {
            year,
            month,
            industryId,
            access: {
              allowedIndustryIds: null,
              allowedUfs: null,
              allowedStoreIds: null,
              allowedPromoterIds: null,
              canViewPersonalData: true
            }
          });

          const industryRow = core.industryRows.find(r => r.industryId === industryId);
          const storesWithVisits = core.storeRows.filter(s => s.realizadas > 0);
          
          return new Response(JSON.stringify({
            monitoredIndustries: core.monitoredIndustriesCount,
            industryFound: !!industryRow,
            industryData: industryRow,
            totalStoreRows: core.storeRows.length,
            storesWithVisits: storesWithVisits.length,
            firstStore: core.storeRows[0],
            importIds: Array.from((core as any).importIdByIndustry?.entries() || [])
          }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
      }
    }
  }
});
