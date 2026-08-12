import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getPresenceExportData = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ 
    date: z.string(),
    filters: z.object({
      search: z.string().optional(),
      uf: z.string().optional(),
      teamId: z.string().optional(),
      supervisorId: z.string().optional(),
    }).optional()
  }).parse(data))
  .handler(async ({ data }) => {
    // 1. Fetch filtered promoters with related team and supervisor names
    let promotersQuery = supabaseAdmin
      .from('mk9_promoters' as any)
      .select(`
        id, 
        name, 
        employee_number, 
        uf, 
        presence_team_id, 
        mk9_supervisor_id,
        team:mk9_presence_teams(name),
        supervisor:mk9_supervisors(name)
      ` as any)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (data.filters?.search) {
      promotersQuery = promotersQuery.or(`name.ilike.%${data.filters.search}%,employee_number.ilike.%${data.filters.search}%`);
    }
    if (data.filters?.uf && data.filters.uf !== '__ALL__') {
      promotersQuery = promotersQuery.eq('uf', data.filters.uf);
    }
    if (data.filters?.teamId === 'NONE') {
      promotersQuery = promotersQuery.is('presence_team_id', null);
    } else if (data.filters?.teamId && data.filters.teamId !== 'ALL') {
      promotersQuery = promotersQuery.eq('presence_team_id', data.filters.teamId);
    }
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

    // Merge data
    const items = (promoters || []).map(p => {
      const pData = (presence as any[])?.find(pr => pr.promoter_id === (p as any).id);
      return {
        id: (p as any).id,
        name: (p as any).name,
        registration_number: (p as any).employee_number,
        uf: (p as any).uf,
        teamName: (p as any).team?.name || 'SEM EQUIPE',
        supervisorName: (p as any).supervisor?.name || 'SEM SUPERVISOR',
        status: pData?.status || null,
        observation: pData?.observation || ''
      };
    });

    return items;
  });
