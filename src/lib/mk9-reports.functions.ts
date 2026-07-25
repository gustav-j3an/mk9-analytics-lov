// Server functions da Central de Relatórios.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const scopeSchema = z.object({
  industryId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  uf: z.string().nullish(),
  storeId: z.string().uuid().nullish(),
  sourceImportId: z.string().uuid().nullish(),
});

export const reportIndustry = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => scopeSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPeriodConfig, resolveWindow } = await import("./mk9-reports/period.server");
    const { buildIndustryReport } = await import("./mk9-reports/industry-report.server");
    const cfg = await loadPeriodConfig(supabaseAdmin, data.industryId);
    const window = resolveWindow(cfg, data.year, data.month);
    return buildIndustryReport(supabaseAdmin, {
      industryId: data.industryId,
      year: data.year,
      month: data.month,
      uf: data.uf ?? null,
      storeId: data.storeId ?? null,
      sourceImportId: data.sourceImportId ?? null,
    }, window);
  });

export const reportIndustryPeriodConfig = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ industryId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPeriodConfig } = await import("./mk9-reports/period.server");
    return loadPeriodConfig(supabaseAdmin, data.industryId);
  });

const upsertConfigSchema = z.object({
  industryId: z.string().uuid(),
  periodType: z.enum(["CALENDAR_MONTH", "CUSTOM_CYCLE"]),
  startDay: z.number().int().min(1).max(31),
  endDay: z.number().int().min(1).max(31),
  usesPreviousMonth: z.boolean(),
  weekGrouping: z.enum(["CALENDAR_WEEK", "CYCLE_WEEK"]),
  active: z.boolean().default(true),
  notes: z.string().nullish(),
});

export const reportUpsertPeriodConfig = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => upsertConfigSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9Role, logAudit } = await import("./mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("mk9_industry_period_config")
      .upsert(
        {
          industry_id: data.industryId,
          period_type: data.periodType,
          start_day: data.startDay,
          end_day: data.endDay,
          uses_previous_month: data.usesPreviousMonth,
          week_grouping: data.weekGrouping,
          active: data.active,
          notes: data.notes ?? null,
        },
        { onConflict: "industry_id" },
      );
    if (error) throw new Error(error.message);
    await logAudit(ctx, "mk9.report.upsertPeriodConfig", "mk9_industry_period_config", data.industryId, {
      periodType: data.periodType,
    });
    return { ok: true };
  });


export const reportListChecklistImports = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      industryId: z.string().uuid(),
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("mk9_checklist_imports")
      .select("id, filename, status, started_at, counters")
      .eq("industry_id", data.industryId)
      .eq("operation_year", data.year)
      .eq("operation_month", data.month)
      .in("status", ["done", "committing"])
      .order("started_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
