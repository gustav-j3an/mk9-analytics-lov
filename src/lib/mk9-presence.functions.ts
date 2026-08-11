import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PresenceStatusSchema = z.enum(['PRESENT', 'ABSENT', 'MEDICAL_CERTIFICATE', 'VACATION']);

export const getPresenceList = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ 
    date: z.string(),
    filters: z.object({
      search: z.string().optional(),
      uf: z.string().optional(),
      status: z.string().optional(),
      teamId: z.string().optional(),
      supervisorId: z.string().optional(),
    }).optional()
  }).parse(data))
  .handler(async ({ data }) => {
    // 1. Fetch active promoters
    let promotersQuery = supabaseAdmin
      .from('mk9_promoters' as any)
      .select('id, name, employee_number, uf, presence_team_id, mk9_supervisor_id' as any)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (data.filters?.search) {
      promotersQuery = promotersQuery.or(`name.ilike.%${data.filters.search}%,employee_number.ilike.%${data.filters.search}%`);
    }
    if (data.filters?.uf && data.filters.uf !== '__ALL__') {
      promotersQuery = promotersQuery.eq('uf', data.filters.uf);
    }

    // Apply Team Filter
    if (data.filters?.teamId === 'NONE') {
      promotersQuery = promotersQuery.is('presence_team_id', null);
    } else if (data.filters?.teamId && data.filters.teamId !== 'ALL') {
      promotersQuery = promotersQuery.eq('presence_team_id', data.filters.teamId);
    }

    // Apply Supervisor Filter
    if (data.filters?.supervisorId === 'NONE') {
      promotersQuery = promotersQuery.is('mk9_supervisor_id', null);
    } else if (data.filters?.supervisorId && data.filters.supervisorId !== 'ALL') {
      promotersQuery = promotersQuery.eq('mk9_supervisor_id', data.filters.supervisorId);
    }

    const { data: promoters, error: pError } = await promotersQuery;
    if (pError) throw pError;

    // 2. Fetch presence for the date
    const { data: presence, error: prError } = await supabaseAdmin
      .from('mk9_promoter_presence' as any)
      .select('*')
      .eq('date', data.date);
    
    if (prError) throw prError;

    // Merge
    return (promoters || []).map(p => {
      const pData = (presence as any[])?.find(pr => pr.promoter_id === (p as any).id);
      return {
        id: (p as any).id,
        name: (p as any).name,
        registration_number: (p as any).employee_number,
        uf: (p as any).uf,
        teamId: (p as any).presence_team_id,
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
  .inputValidator((data) => z.object({ 
    date: z.string(),
    teamId: z.string().optional(),
    supervisorId: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    // 1. Filter Promoters first
    let promotersQuery = supabaseAdmin
      .from('mk9_promoters' as any)
      .select('id', { count: 'exact' })
      .eq('is_active', true);

    if (data.teamId === 'NONE') {
      promotersQuery = promotersQuery.is('presence_team_id', null);
    } else if (data.teamId && data.teamId !== 'ALL') {
      promotersQuery = promotersQuery.eq('presence_team_id', data.teamId);
    }

    if (data.supervisorId === 'NONE') {
      promotersQuery = promotersQuery.is('mk9_supervisor_id', null);
    } else if (data.supervisorId && data.supervisorId !== 'ALL') {
      promotersQuery = promotersQuery.eq('mk9_supervisor_id', data.supervisorId);
    }

    const { count: total, data: teamPromoters } = await promotersQuery;
    const teamIds = (teamPromoters as any[])?.map(p => p.id) || [];

    // 2. Fetch presence only for these promoters
    let presenceQuery = supabaseAdmin
      .from('mk9_promoter_presence' as any)
      .select('status, promoter_id')
      .eq('date', data.date);
    
    if (teamIds.length > 0) {
      presenceQuery = presenceQuery.in('promoter_id', teamIds);
    } else if (data.teamId && data.teamId !== 'ALL') {
      return { total: 0, present: 0, absent: 0, medical: 0, vacation: 0, unmarked: 0 };
    }

    const { data: presence } = await presenceQuery;

    const stats = {
      total: total || 0,
      present: 0,
      absent: 0,
      medical: 0,
      vacation: 0,
      unmarked: 0
    };

    (presence as any[])?.forEach(p => {
      if (p.status === 'PRESENT') stats.present++;
      else if (p.status === 'ABSENT') stats.absent++;
      else if (p.status === 'MEDICAL_CERTIFICATE') stats.medical++;
      else if (p.status === 'VACATION') stats.vacation++;
    });

    stats.unmarked = Math.max(0, stats.total - (presence?.length || 0));

    return stats;
  });
