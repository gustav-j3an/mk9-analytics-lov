import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export interface ExportData {
  promoterName: string;
  referenceDate: string;
  days: number;
  stops: number;
  items: number;
  groupedByDay: Array<{
    weekday: number;
    weekdayLabel: string;
    stops: Array<{
      storeName: string;
      storeChain: string | null;
      uf: string | null;
      industries: string[];
    }>;
  }>;
}

export async function exportToPdf(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error("Element not found for PDF export");
  }

  // Esperar fontes e imagens
  await document.fonts.ready;
  
  const canvas = await html2canvas(element, {
    scale: 2, // Melhor qualidade
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error("Canvas render failed (empty)");
  }

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF("p", "mm", "a4");
  
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  
  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
  const finalWidth = imgWidth * ratio;
  const finalHeight = imgHeight * ratio;
  
  // Centralizar na página A4
  const marginX = (pdfWidth - finalWidth) / 2;
  const marginY = 10; // Margem superior

  pdf.addImage(imgData, "JPEG", marginX, marginY, finalWidth, finalHeight);
  pdf.save(filename);
}
