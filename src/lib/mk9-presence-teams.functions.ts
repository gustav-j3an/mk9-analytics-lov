import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireMk9Role, logAudit } from "@/lib/mk9-auth/require-role.server";

export const listPresenceTeams = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from('mk9_presence_teams' as any)
      .select('*, supervisor:mk9_supervisors(id, name)')
      .eq('active', true)
      .order('name');
    
    if (error) throw error;
    return data as any[];
  });

export const getPresenceTeamDetails = createServerFn({ method: "GET" })
  .inputValidator(z.string().uuid())
  .handler(async ({ data: id }) => {
    const { data: team, error: tErr } = await supabaseAdmin
      .from('mk9_presence_teams' as any)
      .select('*, supervisor:mk9_supervisors(id, name)')
      .eq('id', id)
      .single();
    
    if (tErr) throw tErr;

    const { data: members, error: mErr } = await supabaseAdmin
      .from('mk9_promoters' as any)
      .select('id, name, employee_number, uf')
      .eq('presence_team_id', id)
      .eq('is_active', true)
      .order('name');
    
    if (mErr) throw mErr;

    const teamData = team as any;
    return { ...teamData, members: members as any[] };
  });

export const createPresenceTeam = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    name: z.string().min(3),
    supervisorId: z.string().uuid().nullable()
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN']);
    const { data: team, error } = await supabaseAdmin
      .from('mk9_presence_teams' as any)
      .insert({
        name: data.name,
        supervisor_id: data.supervisorId
      })
      .select()
      .single();
    
    if (error) throw error;
    await logAudit(ctx, 'PRESENCE_TEAM_CREATED', 'mk9_presence_teams', (team as any).id, data);
    return team as any;
  });

export const updatePresenceTeam = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string().uuid(),
    name: z.string().min(3),
    supervisorId: z.string().uuid().nullable()
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN']);
    const { data: team, error } = await supabaseAdmin
      .from('mk9_presence_teams' as any)
      .update({
        name: data.name,
        supervisor_id: data.supervisorId,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.id)
      .select()
      .single();
    
    if (error) throw error;
    await logAudit(ctx, 'PRESENCE_TEAM_UPDATED', 'mk9_presence_teams', data.id, data);
    return team as any;
  });

export const addPromotersToTeam = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    teamId: z.string().uuid(),
    promoterIds: z.array(z.string().uuid())
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN']);
    
    // 1. Get team details to sync supervisor
    const { data: team, error: tErr } = await supabaseAdmin
      .from('mk9_presence_teams' as any)
      .select('supervisor_id')
      .eq('id', data.teamId)
      .single();
    
    if (tErr) throw tErr;

    // 2. Update promoters (team_id AND supervisor_id)
    const { error } = await supabaseAdmin
      .from('mk9_promoters' as any)
      .update({ 
        presence_team_id: data.teamId,
        mk9_supervisor_id: (team as any).supervisor_id
      })
      .in('id', data.promoterIds);
    
    if (error) throw error;
    await logAudit(ctx, 'PROMOTERS_ADDED_TO_TEAM', 'mk9_presence_teams', data.teamId, { promoterIds: data.promoterIds });
    return { success: true };
  });

export const removePromoterFromTeam = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    promoterId: z.string().uuid()
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN']);
    const { error } = await supabaseAdmin
      .from('mk9_promoters' as any)
      .update({ presence_team_id: null })
      .eq('id', data.promoterId);
    
    if (error) throw error;
    await logAudit(ctx, 'PROMOTER_REMOVED_FROM_TEAM', 'mk9_promoters', data.promoterId);
    return { success: true };
  });

export const archivePresenceTeam = createServerFn({ method: "POST" })
  .inputValidator(z.string().uuid())
  .handler(async ({ data: id }) => {
    const ctx = await requireMk9Role(['ADMIN']);
    
    // First remove all members
    await supabaseAdmin
      .from('mk9_promoters' as any)
      .update({ presence_team_id: null })
      .eq('presence_team_id', id);

    const { error } = await supabaseAdmin
      .from('mk9_presence_teams' as any)
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw error;
    await logAudit(ctx, 'PRESENCE_TEAM_ARCHIVED', 'mk9_presence_teams', id);
    return { success: true };
  });

export const listPotentialMembers = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from('mk9_promoters' as any)
      .select('id, name, employee_number, uf, presence_team_id')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    // Map backend snake_case to frontend camelCase if needed, though component uses snake_case here
    return data as any[];
  });

export const listSupervisors = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from('mk9_supervisors')
      .select('id, name')
      .eq('active', true)
      .order('name');
    
    if (error) throw error;
    // Keep full_name for backward compatibility if components use it
    return data.map(s => ({ ...s, full_name: s.name }));
  });
