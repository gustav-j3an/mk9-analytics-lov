import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireMk9Role, logAudit } from "@/lib/mk9-auth/require-role.server";

export const listDailies = createServerFn({ method: "GET" })
  .inputValidator(z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    freelancerId: z.string().uuid().optional(),
    supervisorId: z.string().uuid().optional(),
    status: z.string().optional(),
  }).optional())
  .handler(async ({ data }) => {
    const admin = supabaseAdmin as any;
    let query = admin
      .from('mk9_freelancer_dailies')
      .select(`
        *,
        freelancer:mk9_freelancers(*),
        supervisor:mk9_supervisors(*),
        items:mk9_freelancer_daily_items(
          *,
          store:mk9_stores(*),
          industry:mk9_industries(*)
        )
      `)
      .order('date', { ascending: false });

    if (data?.startDate) query = query.gte('date', data.startDate);
    if (data?.endDate) query = query.lte('date', data.endDate);
    if (data?.freelancerId) query = query.eq('freelancer_id', data.freelancerId);
    if (data?.supervisorId) query = query.eq('supervisor_id', data.supervisorId);
    if (data?.status) query = query.eq('status', data.status);

    const { data: dailies, error } = await query;
    if (error) throw error;
    return dailies as any[];
  });

export const createDaily = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    freelancerId: z.string().uuid(),
    date: z.string(),
    amount: z.number(),
    status: z.enum(['PLANEJADA', 'REALIZADA', 'CANCELADA']).optional().default('PLANEJADA'),
    supervisorId: z.string().uuid().optional().nullable(),
    notes: z.string().optional().nullable(),
    items: z.array(z.object({
      storeId: z.string().uuid(),
      industryIds: z.array(z.string().uuid())
    }))
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN', 'SUPERVISOR']);
    const admin = supabaseAdmin as any;

    // Start a simple "transaction" by inserting the daily first
    const { data: daily, error: dailyErr } = await admin
      .from('mk9_freelancer_dailies')
      .insert({
        freelancer_id: data.freelancerId,
        date: data.date,
        amount: data.amount,
        status: data.status,
        supervisor_id: data.supervisorId,
        notes: data.notes
      })
      .select()
      .single();

    if (dailyErr) throw dailyErr;

    // Prepare items
    const itemsToInsert: any[] = [];
    data.items.forEach(item => {
      item.industryIds.forEach(indId => {
        itemsToInsert.push({
          daily_id: daily.id,
          store_id: item.storeId,
          industry_id: indId
        });
      });
    });

    if (itemsToInsert.length > 0) {
      const { error: itemsErr } = await admin
        .from('mk9_freelancer_daily_items')
        .insert(itemsToInsert);
      
      if (itemsErr) {
        // Simple cleanup on failure
        await admin.from('mk9_freelancer_dailies').delete().eq('id', daily.id);
        throw itemsErr;
      }
    }

    await logAudit(ctx, 'DAILY_RATE_CREATED', 'mk9_freelancer_dailies', daily.id, data);
    return daily as any;
  });

export const updateDaily = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string().uuid(),
    freelancerId: z.string().uuid(),
    date: z.string(),
    amount: z.number(),
    status: z.enum(['PLANEJADA', 'REALIZADA', 'CANCELADA']),
    supervisorId: z.string().uuid().optional().nullable(),
    notes: z.string().optional().nullable(),
    items: z.array(z.object({
      storeId: z.string().uuid(),
      industryIds: z.array(z.string().uuid())
    }))
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN', 'SUPERVISOR']);
    const admin = supabaseAdmin as any;

    const { data: daily, error: dailyErr } = await admin
      .from('mk9_freelancer_dailies')
      .update({
        freelancer_id: data.freelancerId,
        date: data.date,
        amount: data.amount,
        status: data.status,
        supervisor_id: data.supervisorId,
        notes: data.notes
      })
      .eq('id', data.id)
      .select()
      .single();

    if (dailyErr) throw dailyErr;

    // Replace items: Delete old and insert new
    const { error: delErr } = await admin
      .from('mk9_freelancer_daily_items')
      .delete()
      .eq('daily_id', data.id);
    
    if (delErr) throw delErr;

    const itemsToInsert: any[] = [];
    data.items.forEach(item => {
      item.industryIds.forEach(indId => {
        itemsToInsert.push({
          daily_id: daily.id,
          store_id: item.storeId,
          industry_id: indId
        });
      });
    });

    if (itemsToInsert.length > 0) {
      const { error: itemsErr } = await admin
        .from('mk9_freelancer_daily_items')
        .insert(itemsToInsert);
      
      if (itemsErr) throw itemsErr;
    }

    await logAudit(ctx, 'DAILY_RATE_UPDATED', 'mk9_freelancer_dailies', data.id, data);
    return daily as any;
  });

export const cancelDaily = createServerFn({ method: "POST" })
  .inputValidator(z.string().uuid())
  .handler(async ({ data: id }) => {
    const ctx = await requireMk9Role(['ADMIN', 'SUPERVISOR']);
    const admin = supabaseAdmin as any;
    const { error } = await admin
      .from('mk9_freelancer_dailies')
      .update({ status: 'CANCELADA' })
      .eq('id', id);
    
    if (error) throw error;
    await logAudit(ctx, 'DAILY_RATE_CANCELLED', 'mk9_freelancer_dailies', id);
    return { success: true };
  });

export const deleteDaily = createServerFn({ method: "POST" })
  .inputValidator(z.string().uuid())
  .handler(async ({ data: id }) => {
    const ctx = await requireMk9Role(['ADMIN']);
    const admin = supabaseAdmin as any;
    const { error } = await admin
      .from('mk9_freelancer_dailies')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    await logAudit(ctx, 'DAILY_RATE_DELETED', 'mk9_freelancer_dailies', id);
    return { success: true };
  });

export const getDailiesExportData = createServerFn({ method: "GET" })
  .inputValidator(z.object({
    startDate: z.string(),
    endDate: z.string(),
    freelancerId: z.string().uuid().optional(),
    supervisorId: z.string().uuid().optional(),
    status: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const admin = supabaseAdmin as any;
    let query = admin
      .from('mk9_freelancer_dailies')
      .select(`
        *,
        freelancer:mk9_freelancers(*),
        supervisor:mk9_supervisors(*),
        items:mk9_freelancer_daily_items(
          *,
          store:mk9_stores(*),
          industry:mk9_industries(*)
        )
      `)
      .gte('date', data.startDate)
      .lte('date', data.endDate)
      .order('date', { ascending: true });

    if (data.freelancerId) query = query.eq('freelancer_id', data.freelancerId);
    if (data.supervisorId) query = query.eq('supervisor_id', data.supervisorId);
    if (data.status) query = query.eq('status', data.status);

    const { data: dailies, error } = await query;
    if (error) throw error;

    // Resumo
    const totalDailies = dailies.length;
    const totalAmount = dailies
      .filter((d: any) => d.status === 'REALIZADA')
      .reduce((acc: number, d: any) => acc + Number(d.amount), 0);
    
    const uniqueFreelancers = new Set(dailies.map((d: any) => d.freelancer_id)).size;
    const uniqueStores = new Set(dailies.flatMap((d: any) => d.items.map((it: any) => it.store_id))).size;
    const uniqueIndustries = new Set(dailies.flatMap((d: any) => d.items.map((it: any) => it.industry_id))).size;

    const summary = [
      { campo: "Período", valor: `${data.startDate} a ${data.endDate}` },
      { campo: "Total de diárias", valor: totalDailies },
      { campo: "Total financeiro (REALIZADA)", valor: totalAmount },
      { campo: "Freelancers utilizados", valor: uniqueFreelancers },
      { campo: "Lojas atendidas", valor: uniqueStores },
      { campo: "Indústrias atendidas", valor: uniqueIndustries },
    ];

    // Diárias
    const dailiesList = dailies.map((d: any) => ({
      DATA: d.date,
      FREELANCER: d.freelancer?.name,
      SUPERVISOR: d.supervisor?.name || "-",
      VALOR: Number(d.amount),
      STATUS: d.status,
      "QTD LOJAS": new Set(d.items.map((it: any) => it.store_id)).size,
      "QTD INDÚSTRIAS": d.items.length,
      OBSERVAÇÃO: d.notes || "-"
    }));

    // Atendimentos
    const itemsList = dailies.flatMap((d: any) => d.items.map((it: any) => ({
      DATA: d.date,
      FREELANCER: d.freelancer?.name,
      LOJA: it.store?.name,
      REDE: it.store?.chain || "-",
      UF: it.store?.uf || "-",
      INDÚSTRIA: it.industry?.name,
      "VALOR DA DIÁRIA": Number(d.amount),
      STATUS: d.status
    })));

    return { summary, dailiesList, itemsList };
  });

