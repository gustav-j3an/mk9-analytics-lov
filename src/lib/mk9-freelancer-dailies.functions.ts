import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getNormalizedChain } from "./mk9/chain-normalization";

import { requireMk9Role, logAudit } from "@/lib/mk9-auth/require-role.server";

export function calculateFinancialTotal(daily: any) {
  const industryCount = daily.items?.length || 0;
  const unitRate = Number(daily.amount) || 0;
  return unitRate * industryCount;
}

export const listDailies = createServerFn({ method: "GET" })
  .inputValidator(z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    freelancerId: z.string().uuid().optional(),
    supervisorId: z.string().uuid().optional(),
    status: z.string().optional(),
    paymentStatus: z.string().optional(),
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
          industry:mk9_industries(id,name)
        )
      `)
      .order('date', { ascending: false });

    if (data?.startDate) query = query.gte('date', data.startDate);
    if (data?.endDate) query = query.lte('date', data.endDate);
    if (data?.freelancerId) query = query.eq('freelancer_id', data.freelancerId);
    if (data?.supervisorId) query = query.eq('supervisor_id', data.supervisorId);
    if (data?.status) query = query.eq('status', data.status);
    if (data?.paymentStatus) query = query.eq('payment_status', data.paymentStatus);

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
    paymentStatus: z.enum(['A PAGAR', 'PAGO']).optional().default('A PAGAR'),
    supervisorId: z.string().uuid().optional().nullable(),
    notes: z.string().optional().nullable(),
    items: z.array(z.object({
      storeId: z.string().uuid(),
      industryIds: z.array(z.string().uuid())
    })).optional().default([])
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
        payment_status: data.paymentStatus,
        supervisor_id: data.supervisorId,
        notes: data.notes
      })
      .select()
      .single();

    if (dailyErr) throw dailyErr;
    await logAudit(ctx, 'DAILY_RATE_CREATED', 'mk9_freelancer_dailies', daily.id, data);

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
    paymentStatus: z.enum(['A PAGAR', 'PAGO']).optional(),
    paymentDate: z.string().optional().nullable(),
    supervisorId: z.string().uuid().optional().nullable(),
    notes: z.string().optional().nullable(),
    items: z.array(z.object({
      storeId: z.string().uuid(),
      industryIds: z.array(z.string().uuid())
    })).optional().default([])
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
        payment_status: data.paymentStatus,
        payment_date: data.paymentDate,
        supervisor_id: data.supervisorId,
        notes: data.notes
      })
      .eq('id', data.id)
      .select()
      .single();

    if (dailyErr) throw dailyErr;
    await logAudit(ctx, 'DAILY_RATE_UPDATED', 'mk9_freelancer_dailies', data.id, data);

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

export const markAsPaid = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    dailyIds: z.array(z.string().uuid()),
    paymentDate: z.string()
  }))
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(['ADMIN', 'SUPERVISOR']);
    const admin = supabaseAdmin as any;
    const { error } = await admin
      .from('mk9_freelancer_dailies')
      .update({ 
        payment_status: 'PAGO',
        payment_date: data.paymentDate
      })
      .in('id', data.dailyIds);
    
    if (error) throw error;
    await logAudit(ctx, 'DAILY_RATE_MARKED_PAID', 'mk9_freelancer_dailies', data.dailyIds.join(','), data);
    return { success: true };
  });

export const getDailiesExportData = createServerFn({ method: "GET" })
  .inputValidator(z.object({
    startDate: z.string(),
    endDate: z.string(),
    freelancerId: z.string().uuid().optional(),
    supervisorId: z.string().uuid().optional(),
    status: z.string().optional(),
    paymentStatus: z.string().optional(),
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
          industry:mk9_industries(id,name)
        )
      `)
      .gte('date', data.startDate)
      .lte('date', data.endDate)
      .order('date', { ascending: true });

    if (data.freelancerId) query = query.eq('freelancer_id', data.freelancerId);
    if (data.supervisorId) query = query.eq('supervisor_id', data.supervisorId);
    if (data.status) query = query.eq('status', data.status);
    if (data.paymentStatus) query = query.eq('payment_status', data.paymentStatus);

    const { data: dailies, error } = await query;
    if (error) throw error;

    // Atendimentos (v2.7.0: Single-Sheet Operational Export)
    const itemsList = dailies.flatMap((d: any) => d.items.map((it: any) => ({
      DATA: d.date ? new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR') : "-",
      FREELANCER: d.freelancer?.name || "-",
      CPF: d.freelancer?.cpf || "-",
      TELEFONE: d.freelancer?.phone || "-",
      LOJA: it.store?.name || "-",
      REDE: it.store ? getNormalizedChain(it.store) : "-",
      CIDADE: it.store?.city || "-",
      UF: it.store?.uf || "-",
      INDÚSTRIA: it.industry?.name || "-",
      "VALOR DO ATENDIMENTO": Number(d.amount),
      STATUS: d.status,
      "STATUS FINANCEIRO": d.payment_status,
      "DATA DE PAGAMENTO": d.payment_date ? new Date(d.payment_date + 'T12:00:00').toLocaleDateString('pt-BR') : "-",
      OBSERVAÇÃO: d.notes || "-"
    })));

    // Validação de paridade (Dev-Only Check)
    const totalByAtendimentos = itemsList.reduce((acc, it) => acc + it["VALOR DO ATENDIMENTO"], 0);
    const totalByDailies = dailies.reduce((acc, d) => acc + calculateFinancialTotal(d), 0);
    
    if (Math.abs(totalByAtendimentos - totalByDailies) > 0.01) {
      console.error(`[MK9 CONSISTENCY ERROR] Export parity failed: Atendimentos=${totalByAtendimentos} vs Dailies=${totalByDailies}`);
    }

    return { itemsList };

    return { itemsList };
  });

