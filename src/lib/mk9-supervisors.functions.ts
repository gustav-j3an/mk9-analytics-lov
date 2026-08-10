import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireMk9Role, logAudit } from "@/lib/mk9-auth/require-role.server";

export const listSupervisors = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from('mk9_supervisors')
      .select('*')
      .eq('active', true)
      .order('name');
    
    if (error) throw error;
    return data;
  });

export const createSupervisor = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    name: z.string().min(2).max(120),
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN']);
    const { data: row, error } = await supabaseAdmin
      .from('mk9_supervisors')
      .insert({ name: data.name })
      .select()
      .single();
    
    if (error) throw error;
    await logAudit(ctx, 'SUPERVISOR_CREATED', 'mk9_supervisors', row.id, data);
    return row;
  });

export const updateSupervisor = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string().uuid(),
    name: z.string().min(2).max(120),
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN']);
    const { data: row, error } = await supabaseAdmin
      .from('mk9_supervisors')
      .update({ name: data.name })
      .eq('id', data.id)
      .select()
      .single();
    
    if (error) throw error;
    await logAudit(ctx, 'SUPERVISOR_UPDATED', 'mk9_supervisors', data.id, data);
    return row;
  });

export const archiveSupervisor = createServerFn({ method: "POST" })
  .inputValidator(z.string().uuid())
  .handler(async ({ data: id }) => {
    const ctx = await requireMk9Role(['ADMIN']);
    const { error } = await supabaseAdmin
      .from('mk9_supervisors')
      .update({ active: false })
      .eq('id', id);
    
    if (error) throw error;
    await logAudit(ctx, 'SUPERVISOR_ARCHIVED', 'mk9_supervisors', id);
    return { success: true };
  });

export const getSupervisorDetails = createServerFn({ method: "GET" })
  .inputValidator(z.string().uuid())
  .handler(async ({ data: id }) => {
    const { data: supervisor, error: sErr } = await supabaseAdmin
      .from('mk9_supervisors')
      .select('*')
      .eq('id', id)
      .single();
    
    if (sErr) throw sErr;

    const { data: members, error: mErr } = await supabaseAdmin
      .from('mk9_promoters')
      .select('id, name, employee_number, uf')
      .eq('mk9_supervisor_id', id)
      .eq('is_active', true)
      .order('name');
    
    if (mErr) throw mErr;

    return { ...supervisor, members: members || [] };
  });

export const assignPromotersToSupervisor = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    supervisorId: z.string().uuid().nullable(),
    promoterIds: z.array(z.string().uuid())
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN']);
    const { error } = await supabaseAdmin
      .from('mk9_promoters')
      .update({ mk9_supervisor_id: data.supervisorId })
      .in('id', data.promoterIds);
    
    if (error) throw error;
    await logAudit(ctx, 'PROMOTERS_ASSIGNED_TO_SUPERVISOR', 'mk9_supervisors', data.supervisorId, { promoterIds: data.promoterIds });
    return { success: true };
  });
