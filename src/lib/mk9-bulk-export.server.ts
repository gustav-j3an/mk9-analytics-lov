import { supabaseAdmin } from "../integrations/supabase/client.server";
import { resolveWindow, loadPeriodConfig } from "./mk9-reports/period.server";
import { buildIndustryReport, type IndustryReport } from "./mk9-reports/industry-report.server";
import { renderUnattendedPdf } from "./reports/unattended-pdf.server";
import JSZip from "jszip";

export async function processBulkExportItem(
  exportId: string,
  itemId: string,
  industryId: string,
  month: number,
  year: number,
  filters: any,
  access: any
): Promise<{ pdfBuffer: Buffer | null; industryName: string; report: IndustryReport | null }> {
  const startTime = Date.now();
  let industryName = "Indústria";
  try {
    console.log(`[UNVISITED INDUSTRY START] industryId=${industryId} itemId=${itemId}`);

    // Fetch industry name first for logs/results
    const { data: industryData } = await supabaseAdmin
      .from("mk9_industries")
      .select("name")
      .eq("id", industryId)
      .maybeSingle();
    
    if (industryData) industryName = industryData.name;

    // 1. Update status to CALCULATING
    await supabaseAdmin
      .from("mk9_bulk_export_items")
      .update({ status: "CALCULATING" })
      .eq("id", itemId);

    console.log(`[UNVISITED REPORT LOAD] industryId=${industryId} name=${industryName}`);
    const config = await loadPeriodConfig(supabaseAdmin, industryId);
    const window = resolveWindow(config, year, month);
    
    const report = await buildIndustryReport(supabaseAdmin, {
      industryId,
      month,
      year,
      uf: filters?.uf,
      access,
    }, window);

    console.log(`[UNVISITED REPORT SUCCESS] industryId=${industryId} duration=${Date.now() - startTime}ms`);

    const unattended = report.stores.filter(s => s.expected > 0 && s.actual === 0);
    const unattendedCount = unattended.length;
    const contractedSum = unattended.reduce((sum, s) => sum + s.expected, 0);

    // 2. Update status to GENERATING
    await supabaseAdmin
      .from("mk9_bulk_export_items")
      .update({ 
        status: unattendedCount > 0 ? "GENERATING" : "SKIPPED",
        unattended_stores_count: unattendedCount,
        contracted_visits_sum: contractedSum,
        period_start: window.startDate,
        period_end: window.endDate,
        error_details: null // Clear previous errors
      })
      .eq("id", itemId);

    if (unattendedCount === 0) {
      return { pdfBuffer: null, industryName, report };
    }

    // 3. Generate PDF
    const pdfBytes = await renderUnattendedPdf(report, year, month);
    const pdfBuffer = Buffer.from(pdfBytes);

    // 4. Update status to COMPLETED
    await supabaseAdmin
      .from("mk9_bulk_export_items")
      .update({ status: "COMPLETED" })
      .eq("id", itemId);

    return { pdfBuffer, industryName, report };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    const errorCode = err.name === "Mk9ScopeError" ? "FORBIDDEN" : (err.code || "REPORT_ENGINE_FAILED");
    const httpStatus = err.statusCode || (err.name === "Mk9ScopeError" ? 403 : 500);
    
    console.error(`[UNVISITED INDUSTRY FAILED] industryId=${industryId} code=${errorCode} status=${httpStatus} duration=${duration}ms error=${err.message}`);

    await supabaseAdmin
      .from("mk9_bulk_export_items")
      .update({ 
        status: "ERROR", 
        error_details: JSON.stringify({
          code: errorCode,
          message: err.message,
          status: httpStatus,
          stage: "PROCESS_ITEM"
        })
      })
      .eq("id", itemId);
    return { pdfBuffer: null, industryName, report: null };
  }
}

export async function generateBulkZip(
  exportRecord: any,
  results: Array<{ pdfBuffer: Buffer | null; industryName: string }>
): Promise<Buffer> {
  const zip = new (JSZip as any)();
  const monthLabel = [
    "JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
  ][exportRecord.competence_month - 1];
  
  for (const res of results) {
    if (res.pdfBuffer) {
      const name = res.industryName
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toUpperCase().replace(/[^A-Z0-9]+/g, "_");
      const filename = `LOJAS_NAO_ATENDIDAS_${name}_${monthLabel}_${exportRecord.competence_year}.pdf`;
      zip.file(filename, res.pdfBuffer);
    }
  }

  return await zip.generateAsync({ type: "nodebuffer" });
}

export async function generateBulkConsolidatedPdf(
  exportRecord: any,
  results: Array<{ pdfBuffer: Buffer | null; industryName: string; report: IndustryReport | null }>
): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  // Cover page
  const page = doc.addPage([595.28, 841.89]);
  page.drawText("MK9 Analytics", { x: 50, y: 750, size: 24, font: fontBold, color: rgb(0.07, 0.24, 0.52) });
  page.drawText("Relatório de Lojas Não Atendidas - Consolidado", { x: 50, y: 710, size: 18, font: fontBold });
  
  const monthLabel = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ][exportRecord.competence_month - 1];
  
  page.drawText(`Competência: ${monthLabel} / ${exportRecord.competence_year}`, { x: 50, y: 680, size: 12, font: fontRegular });
  page.drawText(`Data de emissão: ${new Date().toLocaleDateString("pt-BR")}`, { x: 50, y: 660, size: 12, font: fontRegular });
  
  const validResults = results.filter(r => r.report && r.report.stores.some(s => s.expected > 0 && s.actual === 0));
  page.drawText(`Indústrias analisadas: ${results.length}`, { x: 50, y: 630, size: 12, font: fontRegular });
  page.drawText(`Indústrias com pendência: ${validResults.length}`, { x: 50, y: 610, size: 12, font: fontRegular });
  
  const totalStores = validResults.reduce((sum, r) => sum + (r.report?.stores.filter(s => s.expected > 0 && s.actual === 0).length || 0), 0);
  page.drawText(`Total de lojas com zero visitas: ${totalStores}`, { x: 50, y: 590, size: 12, font: fontRegular });

  // Merge PDFs
  for (const res of validResults) {
    if (res.pdfBuffer) {
      const externalDoc = await PDFDocument.load(res.pdfBuffer);
      const copiedPages = await doc.copyPages(externalDoc, externalDoc.getPageIndices());
      copiedPages.forEach((p) => doc.addPage(p));
    }
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
