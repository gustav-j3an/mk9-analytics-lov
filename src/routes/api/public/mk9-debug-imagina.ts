import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { loadOperationCore } from '@/lib/mk9-operations/core.server'

export const Route = createFileRoute('/api/public/mk9-debug-imagina')({
  server: {
    handlers: {
      GET: async () => {
        const industryId = '6760a0c9-7582-4f14-aa00-3d760a6d6f78';
        const core = await loadOperationCore(supabaseAdmin, {
          year: 2026,
          month: 8,
          industryId,
        });
        
        const industryRow = core.industryRows.find(r => r.id === industryId);
        
        return new Response(JSON.stringify({
          globalStart: core.globalStart,
          globalEnd: core.globalEnd,
          industryRow,
          ctx: core.ctxById.get(industryId),
          visitsCount: core.storeRows.reduce((acc, row) => acc + (row.industryRealized.get(industryId) || 0), 0)
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
})
