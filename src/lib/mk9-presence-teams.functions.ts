import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireMk9Role, logAudit } from "@/lib/mk9-auth/require-role.server";

export const listPresenceTeams = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from('mk9_presence_teams')
      .select('*, supervisor:mk9_profiles(id, full_name)')
      .eq('active', true)
      .order('name');
    
    if (error) throw error;
    return data;
  });

export const getPresenceTeamDetails = createServerFn({ method: "GET" })
  .inputValidator(z.string().uuid())
  .handler(async ({ data: id }) => {
    const { data: team, error: tErr } = await supabaseAdmin
      .from('mk9_presence_teams')
      .select('*, supervisor:mk9_profiles(id, full_name)')
      .eq('id', id)
      .single();
    
    if (tErr) throw tErr;

    const { data: members, error: mErr } = await supabaseAdmin
      .from('mk9_promoters')
      .select('id, name, employee_number, uf')
      .eq('presence_team_id', id)
      .eq('is_active', true)
      .order('name');
    
    if (mErr) throw mErr;

    return { ...team, members };
  });

export const createPresenceTeam = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    name: z.string().min(3),
    supervisorId: z.string().uuid().nullable()
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN']);
    const { data: team, error } = await supabaseAdmin
      .from('mk9_presence_teams')
      .insert({
        name: data.name,
        supervisor_id: data.supervisorId
      })
      .select()
      .single();
    
    if (error) throw error;
    await logAudit(ctx, 'PRESENCE_TEAM_CREATED', 'mk9_presence_teams', team.id, data);
    return team;
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
      .from('mk9_presence_teams')
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
    return team;
  });

export const addPromotersToTeam = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    teamId: z.string().uuid(),
    promoterIds: z.array(z.string().uuid())
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN']);
    const { error } = await supabaseAdmin
      .from('mk9_promoters')
      .update({ presence_team_id: data.teamId })
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
      .from('mk9_promoters')
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
      .from('mk9_promoters')
      .update({ presence_team_id: null })
      .eq('presence_team_id', id);

    const { error } = await supabaseAdmin
      .from('mk9_presence_teams')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw error;
    await logAudit(ctx, 'PRESENCE_TEAM_ARCHIVED', 'mk9_presence_teams', id);
    return { success: true };
  });

export const listPotentialMembers = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from('mk9_promoters')
      .select('id, name, employee_number, uf, presence_team_id')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return data;
  });
