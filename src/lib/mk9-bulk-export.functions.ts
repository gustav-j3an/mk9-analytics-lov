import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
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

export interface BulkExportPreviewItem {
  industryId: string;
  industryName: string;
  periodLabel: string;
  contractedStores: number | null;
  attendedStores: number | null;
  unattendedStores: number | null;
  contractedVisitsUnattended: number | null;
  status: "READY" | "EMPTY" | "FAILED";
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number;
  errorStage?: string;
}

export interface BulkExportPreview {
  selectedCount: number;
  withPendingCount: number;
  totalUnattendedStores: number;
  totalContractedVisits: number;
  pdfCount: number;
  items: BulkExportPreviewItem[];
}

const previewInput = z.object({
  industryIds: z.array(z.string()),
  month: z.number(),
  year: z.number(),
  filters: z.custom<BulkExportFilters>().optional(),
});

/**
 * Motor compartilhado para cálculo de relatório de indústria.
 * Evita importações circulares e fetch interno.
 */
async function computeSingleIndustryResult(
  supabase: any,
  params: {
    industryId: string;
    industryName: string;
    month: number;
    year: number;
    uf?: string | null;
    access: any;
  }
): Promise<BulkExportPreviewItem> {
  const startTime = Date.now();
  const { industryId, industryName, month, year, uf, access } = params;

  try {
    const config = await loadPeriodConfig(supabase, industryId);
    const window = resolveWindow(config, year, month);
    
    const report = await buildIndustryReport(supabase, {
      industryId,
      month,
      year,
      uf,
      access,
    }, window);

    const unattended = report.stores.filter(s => s.expected > 0 && s.actual === 0);
    const unattendedCount = unattended.length;
    const contractedSum = unattended.reduce((sum, s) => sum + s.expected, 0);

    return {
      industryId,
      industryName,
      periodLabel: `${window.startDate} a ${window.endDate}`,
      contractedStores: report.stores.filter(s => s.expected > 0).length,
      attendedStores: report.stores.filter(s => s.actual > 0).length,
      unattendedStores: unattendedCount,
      contractedVisitsUnattended: contractedSum,
      status: unattendedCount > 0 ? "READY" : "EMPTY",
    };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    const errorCode = err.name === "Mk9ScopeError" ? "FORBIDDEN" : (err.code || "REPORT_ENGINE_FAILED");
    const httpStatus = err.statusCode || (err.name === "Mk9ScopeError" ? 403 : 500);
    
    console.error(`[UNVISITED INDUSTRY FAILED] industryId=${industryId} code=${errorCode} status=${httpStatus} duration=${duration}ms error=${err.message}`);

    return {
      industryId,
      industryName,
      periodLabel: "Erro no cálculo",
      contractedStores: null,
      attendedStores: null,
      unattendedStores: null,
      contractedVisitsUnattended: null,
      status: "FAILED",
      errorCode,
      errorMessage: err.message,
      httpStatus,
      errorStage: "BUILD_REPORT"
    };
  }
}

export const getBulkExportPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => previewInput.parse(data))
  .handler(async ({ data, context }) => {
    const { industryIds, month, year, filters } = data;
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    const { resolveMk9AccessScope } = await import("./mk9-auth/access-scope.server");
    
    console.log(`[UNVISITED MASS START] user=${context?.userId} industries=${industryIds.length}`);

    // Resolve escopo uma única vez
    const authContext = {
      userId: context?.userId ?? null,
      roles: (context as any)?.claims?.user_roles || [],
      devBypass: false
    };
    
    const access = await resolveMk9AccessScope(authContext as any);
    console.log(`[UNVISITED SCOPE RESOLVED] hash=${access.scopeHash}`);

    // Fetch nomes das indústrias
    const { data: industries, error: eInd } = await supabaseAdmin
      .from("mk9_industries")
      .select("id, name")
      .in("id", industryIds);

    if (eInd) {
      console.error(`[UNVISITED MASS DB ERROR] ${eInd.message}`);
      throw new Error(eInd.message);
    }

    // Processamento em fila (concorrência máxima 3)
    const results: BulkExportPreviewItem[] = [];
    const CONCURRENCY = 3;
    
    for (let i = 0; i < (industries || []).length; i += CONCURRENCY) {
      const chunk = (industries || []).slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(ind => computeSingleIndustryResult(supabaseAdmin, {
          industryId: ind.id,
          industryName: ind.name,
          month,
          year,
          uf: filters?.uf,
          access
        }))
      );
      results.push(...chunkResults);
    }

    const totalUnattended = results.reduce((sum, r) => sum + r.unattendedStores, 0);
    const totalContractedVisits = results.reduce((sum, r) => sum + r.contractedVisitsUnattended, 0);
    const withPendingCount = results.filter(r => r.unattendedStores > 0).length;

    console.log(`[UNVISITED MASS END] industries=${results.length} totalUnattended=${totalUnattended}`);

    return {
      selectedCount: industryIds.length,
      withPendingCount,
      totalUnattendedStores: totalUnattended,
      totalContractedVisits,
      pdfCount: withPendingCount,
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
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    
    // 1. Create export record
    const { data: exportRecord, error: eExp } = await supabaseAdmin
      .from("mk9_bulk_exports")
      .insert({
        user_id: context?.userId,
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
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    
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

export const processBulkExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ exportId: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    const { resolveMk9AccessScope } = await import("./mk9-auth/access-scope.server");
    const { processBulkExportItem, generateBulkZip, generateBulkConsolidatedPdf } = await import("./mk9-bulk-export.server");
    
    // 1. Get export record and items
    const { data: exportRecord, error: eExp } = await supabaseAdmin
      .from("mk9_bulk_exports")
      .select(`
        *,
        items:mk9_bulk_export_items(*)
      `)
      .eq("id", data.exportId)
      .single();

    if (eExp) throw new Error(eExp.message);
    if (exportRecord.status === "COMPLETED" || exportRecord.status === "FAILED") {
      return { status: exportRecord.status };
    }

    // 2. Update status to GENERATING
    await supabaseAdmin
      .from("mk9_bulk_exports")
      .update({ status: "GENERATING" })
      .eq("id", data.exportId);

    // 3. Resolve access scope
    const authContext = {
      userId: context?.userId ?? null,
      roles: (context as any)?.claims?.user_roles || [],
      devBypass: false
    };
    const access = await resolveMk9AccessScope(authContext as any);

    // 4. Process items with concurrency limit (e.g. 3)
    const items = exportRecord.items || [];
    const results: Array<{ pdfBuffer: Buffer | null; industryName: string; report: any }> = [];
    const CONCURRENCY = 3;
    
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const chunk = items.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(item => processBulkExportItem(
          exportRecord.id,
          item.id,
          item.industry_id,
          exportRecord.competence_month,
          exportRecord.competence_year,
          exportRecord.filters,
          access
        ))
      );
      results.push(...chunkResults);
      
      // Update progress
      await supabaseAdmin
        .from("mk9_bulk_exports")
        .update({ progress_current: Math.min(i + CONCURRENCY, items.length) })
        .eq("id", data.exportId);
    }

    // 5. Aggregate metrics
    const unattendedTotal = results.reduce((sum, r) => sum + (r.report?.stores.filter((s: any) => s.expected > 0 && s.actual === 0).length || 0), 0);
    const contractedTotal = results.reduce((sum, r) => sum + (r.report?.stores.filter((s: any) => s.expected > 0 && s.actual === 0).reduce((s2: number, s: any) => s2 + s.expected, 0) || 0), 0);
    const withPendingCount = results.filter(r => (r.report?.stores.filter((s: any) => s.expected > 0 && s.actual === 0).length || 0) > 0).length;

    // 6. Generate final file
    let finalBuffer: Buffer;
    if (exportRecord.format === "zip") {
      finalBuffer = await generateBulkZip(exportRecord, results);
    } else {
      finalBuffer = await generateBulkConsolidatedPdf(exportRecord, results);
    }

    // 7. Store in storage (using a temporary buffer table or just letting the client trigger download via a route that does the generation)
    // Actually, to avoid re-generating everything in the download route, I'll store the buffer in a temporary "reports" bucket if available.
    // If not, I'll implement the download route to RE-GENERATE efficiently (it's fast since reports are already built in the process).
    // Wait, the process function is where we build the reports. 
    // I'll just save the finalBuffer to Supabase Storage.
    
    const fileName = exportRecord.format === "zip" ? `bulk_${exportRecord.id}.zip` : `bulk_${exportRecord.id}.pdf`;
    const { data: uploadData, error: eUpload } = await supabaseAdmin.storage
      .from("reports")
      .upload(fileName, finalBuffer, {
        contentType: exportRecord.format === "zip" ? "application/zip" : "application/pdf",
        upsert: true
      });

    const downloadUrl = eUpload ? null : uploadData.path;

    await supabaseAdmin
      .from("mk9_bulk_exports")
      .update({
        status: "COMPLETED",
        industries_with_pending_count: withPendingCount,
        total_unattended_stores: unattendedTotal,
        total_contracted_visits: contractedTotal,
        progress_current: items.length,
        download_url: downloadUrl
      })
      .eq("id", data.exportId);

    return { 
      status: "COMPLETED",
      unattendedTotal,
      contractedTotal,
      withPendingCount,
      downloadUrl
    };
  });

