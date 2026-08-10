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
      supervisor: z.string().optional(), // Added supervisor filter
    }).optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const supervisorAId = '3765698f-3d6b-4d75-a6a4-ddc48686318c';

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

    // Apply Supervisor Filter
    if (data.filters?.supervisor === 'SUPERVISOR_A') {
      promotersQuery = promotersQuery.eq('supervisor_id', supervisorAId);
    } else if (data.filters?.supervisor === 'SUPERVISOR_B') {
      // B = All actives that are NOT A
      promotersQuery = promotersQuery.or(`supervisor_id.is.null,supervisor_id.neq.${supervisorAId}`);
    }

    const { data: promoters, error: pError } = await promotersQuery;
    if (pError) throw pError;

    // 2. Fetch presence for the date
    const { data: presence, error: prError } = await supabaseAdmin
      .from('mk9_promoter_presence')
      .select('*')
      .eq('date', data.date);
    
    if (prError) throw prError;

    // Merge
    return (promoters || []).map(p => {
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
      .from('mk9_promoter_presence')
      .upsert(records, { onConflict: 'date,promoter_id' });

    if (error) throw error;
    return { success: true };
  });

export const getPresenceStats = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ 
    date: z.string(),
    supervisor: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const supervisorAId = '3765698f-3d6b-4d75-a6a4-ddc48686318c';

    // 1. Filter Promoters first to get the correct total count for the team
    let promotersQuery = supabaseAdmin
      .from('mk9_promoters')
      .select('id', { count: 'exact' })
      .eq('is_active', true);

    if (data.supervisor === 'SUPERVISOR_A') {
      promotersQuery = promotersQuery.eq('supervisor_id', supervisorAId);
    } else if (data.supervisor === 'SUPERVISOR_B') {
      promotersQuery = promotersQuery.or(`supervisor_id.is.null,supervisor_id.neq.${supervisorAId}`);
    }

    const { count: total, data: teamPromoters } = await promotersQuery;
    const teamIds = teamPromoters?.map(p => p.id) || [];

    // 2. Fetch presence only for these promoters
    let presenceQuery = supabaseAdmin
      .from('mk9_promoter_presence')
      .select('status, promoter_id')
      .eq('date', data.date);
    
    if (teamIds.length > 0) {
      presenceQuery = presenceQuery.in('promoter_id', teamIds);
    } else if (data.supervisor) {
      // If team is empty and filtering by supervisor, stats should be zero
      return { total: 0, present: 0, absent: 0, medical: 0, unmarked: 0 };
    }

    const { data: presence } = await presenceQuery;

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

    stats.unmarked = Math.max(0, stats.total - (presence?.length || 0));

    return stats;
  });
