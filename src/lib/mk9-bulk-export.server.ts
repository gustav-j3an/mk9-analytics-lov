import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveWindow, loadPeriodConfig } from "./mk9-reports/period.server";
import { buildIndustryReport, type IndustryReport } from "./mk9-reports/industry-report.server";
import { generateUnattendedPdf } from "./reports/unattended-pdf.server";
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
  try {
    // 1. Update status to CALCULATING
    await supabaseAdmin
      .from("mk9_bulk_export_items")
      .update({ status: "CALCULATING" })
      .eq("id", itemId);

    const config = await loadPeriodConfig(supabaseAdmin, industryId);
    const window = resolveWindow(config, year, month);
    
    const report = await buildIndustryReport(supabaseAdmin, {
      industryId,
      month,
      year,
      uf: filters?.uf,
      access,
    }, window);

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
        period_end: window.endDate
      })
      .eq("id", itemId);

    if (unattendedCount === 0) {
      return { pdfBuffer: null, industryName: report.industry.name, report };
    }

    // 3. Generate PDF
    const pdfBytes = await generateUnattendedPdf(report);
    const pdfBuffer = Buffer.from(pdfBytes);

    // 4. Update status to COMPLETED
    await supabaseAdmin
      .from("mk9_bulk_export_items")
      .update({ status: "COMPLETED" })
      .eq("id", itemId);

    return { pdfBuffer, industryName: report.industry.name, report };
  } catch (err: any) {
    console.error(`Error processing bulk item ${itemId}:`, err);
    await supabaseAdmin
      .from("mk9_bulk_export_items")
      .update({ status: "ERROR", error_details: err.message })
      .eq("id", itemId);
    return { pdfBuffer: null, industryName: "Erro", report: null };
  }
}

export async function generateBulkZip(
  exportRecord: any,
  results: Array<{ pdfBuffer: Buffer | null; industryName: string }>
): Promise<Buffer> {
  const zip = new JSZip();
  const monthLabel = [
    "JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
  ][exportRecord.competence_month - 1];
  
  for (const res of results) {
    if (res.pdfBuffer) {
      const filename = `LOJAS_NAO_ATENDIDAS_${res.industryName.replace(/\s+/g, "_").toUpperCase()}_${monthLabel}_${exportRecord.competence_year}.pdf`;
      zip.file(filename, res.pdfBuffer);
    }
  }

  return await zip.generateAsync({ type: "nodebuffer" });
}

export async function generateBulkConsolidatedPdf(
  exportRecord: any,
  results: Array<{ pdfBuffer: Buffer | null; industryName: string; report: IndustryReport | null }>
): Promise<Buffer> {
  // For now, I'll implement a basic version using pdf-lib to merge or create a new one.
  // The requirement asks for a cover, summary, and sections.
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

  // Merge PDFs or generate sections
  // Merging is easier for consistency.
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
