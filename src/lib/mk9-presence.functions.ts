import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PresenceStatusSchema = z.enum(['PRESENT', 'ABSENT', 'MEDICAL_CERTIFICATE']);

export const getPresenceList = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ 
    date: z.string(),
    filters: z.object({
      search: z.string().optional(),
      uf: z.string().optional(),
      status: z.string().optional(),
    }).optional()
  }).parse(data))
  .handler(async ({ data }) => {
    // 1. Fetch active promoters using the correct column 'is_active'
    let promotersQuery = supabaseAdmin
      .from('mk9_promoters')
      .select('id, name, employee_number, uf, supervisor_id')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (data.filters?.search) {
      promotersQuery = promotersQuery.or(`name.ilike.%${data.filters.search}%,employee_number.ilike.%${data.filters.search}%`);
    }
    if (data.filters?.uf && data.filters.uf !== '__ALL__') {
      promotersQuery = promotersQuery.eq('uf', data.filters.uf);
    }

    const { data: promoters, error: pError } = await promotersQuery;
    if (pError) throw pError;

    // 2. Fetch presence for the date using type casting to bypass TS issues with newly created tables
    const { data: presence, error: prError } = await supabaseAdmin
      .from('mk9_promoter_presence' as any)
      .select('*')
      .eq('date', data.date);
    
    if (prError) throw prError;

    // Merge
    return promoters.map(p => {
      const pData = (presence as any[])?.find(pr => pr.promoter_id === p.id);
      return {
        id: p.id,
        name: p.name,
        registration_number: p.employee_number,
        uf: p.uf,
        supervisor_id: p.supervisor_id,
        presenceId: pData?.id || null,
        status: (pData?.status as z.infer<typeof PresenceStatusSchema>) || null,
        observation: pData?.observation || ''
      };
    });
  });

export const savePresenceBulk = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    date: z.string(),
    items: z.array(z.object({
      promoterId: z.string(),
      status: PresenceStatusSchema,
      observation: z.string().optional()
    }))
  }).parse(data))
  .handler(async ({ data }) => {
    const records = data.items.map(item => ({
      date: data.date,
      promoter_id: item.promoterId,
      status: item.status,
      observation: item.observation || null
    }));

    const { error } = await supabaseAdmin
      .from('mk9_promoter_presence' as any)
      .upsert(records, { onConflict: 'date,promoter_id' });

    if (error) throw error;
    return { success: true };
  });

export const getPresenceStats = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ date: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { count: total } = await supabaseAdmin
      .from('mk9_promoters')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { data: presence } = await supabaseAdmin
      .from('mk9_promoter_presence' as any)
      .select('status')
      .eq('date', data.date);

    const stats = {
      total: total || 0,
      present: 0,
      absent: 0,
      medical: 0,
      unmarked: 0
    };

    (presence as any[])?.forEach(p => {
      if (p.status === 'PRESENT') stats.present++;
      else if (p.status === 'ABSENT') stats.absent++;
      else if (p.status === 'MEDICAL_CERTIFICATE') stats.medical++;
    });

    stats.unmarked = stats.total - (presence?.length || 0);

    return stats;
  });
