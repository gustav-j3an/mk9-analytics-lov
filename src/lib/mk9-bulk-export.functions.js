import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildIndustryReport } from "./mk9-reports/industry-report.server";
import { loadPeriodConfig, resolveWindow } from "./mk9-reports/period.server";
const previewInput = z.object({
    industryIds: z.array(z.string()),
    month: z.number(),
    year: z.number(),
    filters: z.custom().optional(),
});
export const getBulkExportPreview = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .validator((data) => previewInput.parse(data))
    .handler(async ({ data, context }) => {
    const { industryIds, month, year, filters } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveMk9AccessScope } = await import("@/lib/mk9-auth/access-scope.server");
    // Auth context for the resolver
    const authContext = {
        userId: context.userId,
        roles: context.claims?.user_roles || [],
        devBypass: false
    };
    const access = await resolveMk9AccessScope(authContext);
    const results = [];
    let totalUnattended = 0;
    let totalContractedVisits = 0;
    // Fetch industries to get names and verify access
    const { data: industries, error: eInd } = await supabaseAdmin
        .from("mk9_industries")
        .select("id, name, requires_checklist")
        .in("id", industryIds);
    if (eInd)
        throw new Error(eInd.message);
    for (const industry of industries || []) {
        const startTime = Date.now();
        try {
            console.log(`[UNVISITED INDUSTRY START] industryId=${industry.id} name=${industry.name}`);
            console.log(`[UNVISITED REPORT LOAD] industryId=${industry.id}`);
            const config = await loadPeriodConfig(supabaseAdmin, industry.id);
            const window = resolveWindow(config, year, month);
            const report = await buildIndustryReport(supabaseAdmin, {
                industryId: industry.id,
                month,
                year,
                uf: filters?.uf,
                access,
            }, window);
            console.log(`[UNVISITED REPORT SUCCESS] industryId=${industry.id} duration=${Date.now() - startTime}ms`);
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
        }
        catch (err) {
            const duration = Date.now() - startTime;
            const errorCode = err.name === "Mk9ScopeError" ? "FORBIDDEN" : (err.code || "REPORT_ENGINE_FAILED");
            const httpStatus = err.statusCode || (err.name === "Mk9ScopeError" ? 403 : 500);
            console.error(`[UNVISITED INDUSTRY FAILED] industryId=${industry.id} code=${errorCode} status=${httpStatus} duration=${duration}ms error=${err.message}`);
            results.push({
                industryId: industry.id,
                industryName: industry.name,
                periodLabel: "Erro no cálculo",
                contractedStores: 0,
                attendedStores: 0,
                unattendedStores: 0,
                contractedVisitsUnattended: 0,
                status: "ERROR",
                errorCode,
                errorMessage: err.message,
                httpStatus,
                errorStage: "BUILD_REPORT"
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
    .validator((data) => z.object({
    industryIds: z.array(z.string()),
    month: z.number(),
    year: z.number(),
    format: z.enum(["zip", "pdf"]),
    filters: z.custom().optional(),
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
        filters: data.filters,
        selected_industries_count: data.industryIds.length,
        status: "QUEUED",
        progress_total: data.industryIds.length,
    })
        .select()
        .single();
    if (eExp)
        throw new Error(eExp.message);
    // 2. Create items
    const items = data.industryIds.map(id => ({
        export_id: exportRecord.id,
        industry_id: id,
        status: "QUEUED",
    }));
    const { error: eItems } = await supabaseAdmin
        .from("mk9_bulk_export_items")
        .insert(items);
    if (eItems)
        throw new Error(eItems.message);
    return { exportId: exportRecord.id };
});
export const getBulkExportStatus = createServerFn({ method: "GET" })
    .middleware([requireSupabaseAuth])
    .validator((data) => z.object({ exportId: z.string() }).parse(data))
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
    if (eExp)
        throw new Error(eExp.message);
    return exportRecord;
});
export const processBulkExport = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .validator((data) => z.object({ exportId: z.string() }).parse(data))
    .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveMk9AccessScope } = await import("@/lib/mk9-auth/access-scope.server");
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
    if (eExp)
        throw new Error(eExp.message);
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
        userId: context.userId,
        roles: context.claims?.user_roles || [],
        devBypass: false
    };
    const access = await resolveMk9AccessScope(authContext);
    // 4. Process items with concurrency limit (e.g. 3)
    const items = exportRecord.items || [];
    const results = [];
    const CONCURRENCY = 3;
    for (let i = 0; i < items.length; i += CONCURRENCY) {
        const chunk = items.slice(i, i + CONCURRENCY);
        const chunkResults = await Promise.all(chunk.map(item => processBulkExportItem(exportRecord.id, item.id, item.industry_id, exportRecord.competence_month, exportRecord.competence_year, exportRecord.filters, access)));
        results.push(...chunkResults);
        // Update progress
        await supabaseAdmin
            .from("mk9_bulk_exports")
            .update({ progress_current: Math.min(i + CONCURRENCY, items.length) })
            .eq("id", data.exportId);
    }
    // 5. Aggregate metrics
    const unattendedTotal = results.reduce((sum, r) => sum + (r.report?.stores.filter((s) => s.expected > 0 && s.actual === 0).length || 0), 0);
    const contractedTotal = results.reduce((sum, r) => sum + (r.report?.stores.filter((s) => s.expected > 0 && s.actual === 0).reduce((s2, s) => s2 + s.expected, 0) || 0), 0);
    const withPendingCount = results.filter(r => (r.report?.stores.filter((s) => s.expected > 0 && s.actual === 0).length || 0) > 0).length;
    // 6. Generate final file
    let finalBuffer;
    if (exportRecord.format === "zip") {
        finalBuffer = await generateBulkZip(exportRecord, results);
    }
    else {
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
