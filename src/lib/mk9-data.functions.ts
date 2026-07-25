// Leitura de dados MK9 para consumo pelas telas.
// Server functions públicas (uso interno do painel — sem auth por design).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const monthYearSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

export const mk9ListIndustries = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("mk9_industries")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    name: r.name as string,
    monthlyContractedFrequency: r.monthly_contracted_frequency as number | null,
    monthlyEstimatedFrequency: r.monthly_estimated_frequency as number | null,
    frequencyDifference: r.frequency_difference as number | null,
    frequencyStatus: r.frequency_status as string | null,
    weeksCount: r.weeks_count as number | null,
    updatedAt: r.updated_at as string,
  }));
});

export const mk9ListStores = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("mk9_stores")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    chain: (r.chain as string | null) ?? null,
    name: r.name as string,
    uf: (r.uf as string | null) ?? null,
    updatedAt: r.updated_at as string,
  }));
});

export const mk9ListPromoters = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("mk9_promoters")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    externalId: (r.external_id as string | null) ?? null,
    name: r.name as string,
    city: (r.city as string | null) ?? null,
    contact: (r.contact as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    updatedAt: r.updated_at as string,
  }));
});

export const mk9ListRoutesDetailed = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => monthYearSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select(
        "id, weekday, operation_month, operation_year, source_sheet, promoter:mk9_promoters(id,name,city), store:mk9_stores(id,name,chain,uf), industry:mk9_industries(id,name)",
      )
      .eq("operation_month", data.month)
      .eq("operation_year", data.year);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      weekday: r.weekday as number,
      sourceSheet: (r.source_sheet as string | null) ?? null,
      promoterId: r.promoter?.id ?? null,
      promoterName: r.promoter?.name ?? "—",
      promoterCity: r.promoter?.city ?? null,
      storeId: r.store?.id ?? null,
      storeName: r.store?.name ?? "—",
      storeChain: r.store?.chain ?? null,
      storeUf: r.store?.uf ?? null,
      industryId: r.industry?.id ?? null,
      industryName: r.industry?.name ?? "—",
    }));
  });

export const mk9ListVisitsDetailed = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => monthYearSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const first = new Date(Date.UTC(data.year, data.month - 1, 1)).toISOString().slice(0, 10);
    const last = new Date(Date.UTC(data.year, data.month, 0)).toISOString().slice(0, 10);
    const { data: rows, error } = await supabaseAdmin
      .from("mk9_planned_visits")
      .select(
        "id, scheduled_date, status, source_sheet, promoter:mk9_promoters(id,name), store:mk9_stores(id,name,chain,uf), industry:mk9_industries(id,name)",
      )
      .gte("scheduled_date", first)
      .lte("scheduled_date", last)
      .order("scheduled_date", { ascending: true })
      .limit(5000);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      scheduledDate: r.scheduled_date as string,
      status: r.status as string,
      sourceSheet: (r.source_sheet as string | null) ?? null,
      promoterName: r.promoter?.name ?? "—",
      storeName: r.store?.name ?? "—",
      storeChain: r.store?.chain ?? null,
      storeUf: r.store?.uf ?? null,
      industryName: r.industry?.name ?? "—",
    }));
  });

export const mk9DashboardContractMetrics = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => monthYearSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const first = new Date(Date.UTC(data.year, data.month - 1, 1)).toISOString().slice(0, 10);
    const last = new Date(Date.UTC(data.year, data.month, 0)).toISOString().slice(0, 10);

    const [{ data: freqs, error: freqError }, { data: actuals, error: actualError }] = await Promise.all([
      supabaseAdmin
        .from("mk9_industry_store_frequency")
        .select("industry_id, store_id, monthly_frequency, weekly_frequency")
        .limit(20000),
      supabaseAdmin
        .from("mk9_actual_visits")
        .select("industry_id, store_id, scheduled_date")
        .gte("scheduled_date", first)
        .lte("scheduled_date", last)
        .limit(20000),
    ]);
    if (freqError) throw new Error(freqError.message);
    if (actualError) throw new Error(actualError.message);

    const perStore = new Map<string, { contratadas: number; executadas: number }>();
    for (const f of freqs ?? []) {
      const key = `${f.industry_id}|${f.store_id}`;
      const monthly = Number(f.monthly_frequency ?? 0);
      const weekly = Number(f.weekly_frequency ?? 0);
      perStore.set(key, {
        contratadas: monthly > 0 ? Math.round(monthly) : Math.round(weekly * 4),
        executadas: 0,
      });
    }
    for (const a of actuals ?? []) {
      const key = `${a.industry_id}|${a.store_id}`;
      const cur = perStore.get(key) ?? { contratadas: 0, executadas: 0 };
      cur.executadas += 1;
      perStore.set(key, cur);
    }

    let contratadas = 0;
    let executadas = 0;
    let validas = 0;
    let extras = 0;
    let pendencias = 0;
    for (const s of perStore.values()) {
      contratadas += s.contratadas;
      executadas += s.executadas;
      const v = Math.min(s.contratadas, s.executadas);
      validas += v;
      extras += Math.max(0, s.executadas - s.contratadas);
      pendencias += Math.max(0, s.contratadas - v);
    }
    const coverage = contratadas > 0 ? Math.round((validas / contratadas) * 100) : 0;
    return { contratadas, executadas, validas, extras, pendencias, coverage };
  });
