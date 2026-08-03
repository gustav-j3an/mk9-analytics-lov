import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildIndustryReport } from "./mk9-reports/industry-report.server";
import { loadPeriodConfig, resolveWindow } from "./mk9-reports/period.server";

export interface BulkExportFilters {
  uf?: string | null;
  supervisorId?: string | null;
  promoterId?: string | null;
  requiresChecklistOnly?: boolean;
  activeOnly?: boolean;
  withVigenteRouteOnly?: boolean;
}

export interface BulkExportPreview {
  selectedCount: number;
  withPendingCount: number;
  totalUnattendedStores: number;
  totalContractedVisits: number;
  pdfCount: number;
  items: Array<{
    industryId: string;
    industryName: string;
    periodLabel: string;
    contractedStores: number;
    attendedStores: number;
    unattendedStores: number;
    contractedVisitsUnattended: number;
    status: "READY" | "EMPTY" | "ERROR";
  }>;
}

const previewInput = z.object({
  industryIds: z.array(z.string()),
  month: z.number(),
  year: z.number(),
  filters: z.custom<BulkExportFilters>().optional(),
});

export const getBulkExportPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => previewInput.parse(data))
  .handler(async ({ data, context }) => {
    const { industryIds, month, year, filters } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveMk9AccessScope } = await import("@/lib/mk9-auth/access-scope.server");
    
    // Auth context for the resolver
    const authContext = {
      userId: context.userId,
      roles: (context as any).claims?.user_roles || [],
      devBypass: false
    };
    
    const access = await resolveMk9AccessScope(authContext as any);

    const results: BulkExportPreview["items"] = [];
    let totalUnattended = 0;
    let totalContractedVisits = 0;

    // Fetch industries to get names and verify access
    const { data: industries, error: eInd } = await supabaseAdmin
      .from("mk9_industries")
      .select("id, name, requires_checklist")
      .in("id", industryIds);

    if (eInd) throw new Error(eInd.message);

    for (const industry of industries || []) {
      try {
        const config = await loadPeriodConfig(supabaseAdmin, industry.id);
        const window = resolveWindow(config, year, month);
        
        const report = await buildIndustryReport(supabaseAdmin, {
          industryId: industry.id,
          month,
          year,
          uf: filters?.uf,
          access,
        }, window);

        // Filter only unattended stores (contracted > 0 AND actual === 0)
        const unattended = report.stores.filter(s => s.expected > 0 && s.actual === 0);
        const unattendedCount = unattended.length;
        const contractedSum = unattended.reduce((sum, s) => sum + s.expected, 0);

        totalUnattended += unattendedCount;
        totalContractedVisits += contractedSum;

        results.push({
          industryId: industry.id,
          industryName: industry.name,
          periodLabel: `${window.startDate} a ${window.endDate}`,
          contractedStores: report.stores.filter(s => s.expected > 0).length,
          attendedStores: report.stores.filter(s => s.actual > 0).length,
          unattendedStores: unattendedCount,
          contractedVisitsUnattended: contractedSum,
          status: unattendedCount > 0 ? "READY" : "EMPTY",
        });
      } catch (err) {
        console.error(`Error calculating preview for ${industry.name}:`, err);
        results.push({
          industryId: industry.id,
          industryName: industry.name,
          periodLabel: "Erro ao calcular",
          contractedStores: 0,
          attendedStores: 0,
          unattendedStores: 0,
          contractedVisitsUnattended: 0,
          status: "ERROR",
        });
      }
    }

    return {
      selectedCount: industryIds.length,
      withPendingCount: results.filter(r => r.unattendedStores > 0).length,
      totalUnattendedStores: totalUnattended,
      totalContractedVisits,
      pdfCount: results.filter(r => r.unattendedStores > 0).length,
      items: results,
    };
  });

export const startBulkExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    industryIds: z.array(z.string()),
    month: z.number(),
    year: z.number(),
    format: z.enum(["zip", "pdf"]),
    filters: z.custom<BulkExportFilters>().optional(),
    includeEmpty: z.boolean().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Create export record
    const { data: exportRecord, error: eExp } = await supabaseAdmin
      .from("mk9_bulk_exports")
      .insert({
        user_id: context.userId,
        competence_month: data.month,
        competence_year: data.year,
        format: data.format,
        filters: data.filters as any,
        selected_industries_count: data.industryIds.length,
        status: "QUEUED",
        progress_total: data.industryIds.length,
      })
      .select()
      .single();

    if (eExp) throw new Error(eExp.message);

    // 2. Create items
    const items = data.industryIds.map(id => ({
      export_id: exportRecord.id,
      industry_id: id,
      status: "QUEUED",
    }));

    const { error: eItems } = await supabaseAdmin
      .from("mk9_bulk_export_items")
      .insert(items);

    if (eItems) throw new Error(eItems.message);

    return { exportId: exportRecord.id };
  });

export const getBulkExportStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ exportId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: exportRecord, error: eExp } = await supabaseAdmin
      .from("mk9_bulk_exports")
      .select(`
        *,
        items:mk9_bulk_export_items(
          id,
          industry_id,
          industry:mk9_industries(name),
          status,
          unattended_stores_count,
          error_details
        )
      `)
      .eq("id", data.exportId)
      .single();

    if (eExp) throw new Error(eExp.message);

    return exportRecord;
  });
