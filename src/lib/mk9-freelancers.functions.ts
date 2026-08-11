import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireMk9Role, logAudit } from "@/lib/mk9-auth/require-role.server";

export const listFreelancers = createServerFn({ method: "GET" })
  .inputValidator(z.object({
    includeInactive: z.boolean().optional().default(false)
  }).optional())
  .handler(async ({ data }) => {
    const admin = supabaseAdmin as any;
    let query = admin
      .from('mk9_freelancers')
      .select('*')
      .order('active', { ascending: false })
      .order('name');
    
    if (!data?.includeInactive) {
      query = query.eq('active', true);
    }

    const { data: freelancers, error } = await query;
    if (error) throw error;
    return freelancers as any[];
  });

export const createFreelancer = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    name: z.string().min(2),
    phone: z.string().optional().nullable(),
    cpf: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    uf: z.string().optional().nullable(),
    default_daily_rate: z.number().optional().nullable(),
    notes: z.string().optional().nullable(),
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN', 'SUPERVISOR']);
    const admin = supabaseAdmin as any;
    const { data: row, error } = await admin
      .from('mk9_freelancers')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    await logAudit(ctx, 'FREELANCER_CREATED', 'mk9_freelancers', row.id, data);
    return row as any;
  });

export const updateFreelancer = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string().uuid(),
    name: z.string().min(2),
    phone: z.string().optional().nullable(),
    cpf: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    uf: z.string().optional().nullable(),
    default_daily_rate: z.number().optional().nullable(),
    notes: z.string().optional().nullable(),
    active: z.boolean().optional(),
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN', 'SUPERVISOR']);
    const { id, ...updates } = data;
    const admin = supabaseAdmin as any;
    const { data: row, error } = await admin
      .from('mk9_freelancers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    await logAudit(ctx, 'FREELANCER_UPDATED', 'mk9_freelancers', id, data);
    return row as any;
  });

export const toggleFreelancerStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string().uuid(),
    active: z.boolean()
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN', 'SUPERVISOR']);
    const admin = supabaseAdmin as any;
    const { error } = await admin
      .from('mk9_freelancers')
      .update({ active: data.active })
      .eq('id', data.id);
    
    if (error) throw error;
    await logAudit(ctx, data.active ? 'FREELANCER_ACTIVATED' : 'FREELANCER_INACTIVATED', 'mk9_freelancers', data.id);
    return { success: true };
  });

