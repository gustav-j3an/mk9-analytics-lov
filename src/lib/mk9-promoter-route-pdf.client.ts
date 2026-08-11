
import { jsPDF } from "jspdf";
import "jspdf-autotable";

interface MatrixRow {
  industryName: string;
  storeName: string;
  storeChain: string | null;
  uf: string | null;
  days: Set<number>;
}

interface ExportPdfParams {
  promoterName: string;
  referenceDate: string;
  totalVisits: number;
  matrix: MatrixRow[];
}

export const generatePromoterRoutePdf = async ({
  promoterName,
  referenceDate,
  totalVisits,
  matrix,
}: ExportPdfParams) => {
  if (typeof window === "undefined") return;

  // 1. Initialize jsPDF in landscape
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const primaryColor = [59, 130, 246]; // RGB for #3b82f6 (Approximate primary)
  const textColor = [31, 41, 55]; // RGB for text-foreground
  const mutedTextColor = [107, 114, 128]; // RGB for text-muted-foreground

  // 2. Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("MK9 COMMAND CENTER", 14, 20);

  doc.setFontSize(14);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text("ROTA INDIVIDUAL", 14, 28);

  // Divider
  doc.setDrawColor(229, 231, 235);
  doc.line(14, 32, 283, 32);

  // Statistics
  doc.setFontSize(8);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text("PROMOTOR", 14, 40);
  doc.text("REFERÊNCIA", 100, 40);
  doc.text("TOTAL DE VISITAS", 186, 40);

  doc.setFontSize(10);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(promoterName.toUpperCase(), 14, 45);
  doc.text(referenceDate.split("-").reverse().join("/"), 100, 45);
  
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont("helvetica", "bold");
  doc.text(totalVisits.toString(), 186, 45);

  // 3. Matrix Table
  const tableData = matrix.map((row) => [
    row.industryName.toUpperCase(),
    `${row.storeChain ? row.storeChain + " · " : ""}${row.storeName.toUpperCase()}`,
    row.uf || "—",
    row.days.has(1) ? "✓" : "",
    row.days.has(2) ? "✓" : "",
    row.days.has(3) ? "✓" : "",
    row.days.has(4) ? "✓" : "",
    row.days.has(5) ? "✓" : "",
    row.days.has(6) ? "✓" : "",
    row.days.has(0) ? "✓" : "",
  ]);

  (doc as any).autoTable({
    startY: 55,
    head: [["INDÚSTRIA", "LOJA", "UF", "SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [243, 244, 246], // gray-100
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      lineWidth: 0.1,
      lineColor: [209, 213, 219],
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      lineColor: [209, 213, 219],
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 45, halign: "left", fontStyle: "bold" },
      1: { cellWidth: 90, halign: "left" },
      2: { cellWidth: 10, halign: "center" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 12, halign: "center" },
      6: { cellWidth: 12, halign: "center" },
      7: { cellWidth: 12, halign: "center" },
      8: { cellWidth: 12, halign: "center" },
      9: { cellWidth: 12, halign: "center" },
    },
    didDrawCell: (data: any) => {
      // Colorize the checkmark
      if (data.section === "body" && data.column.index >= 3 && data.cell.text[0] === "✓") {
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont("helvetica", "bold");
      }
    },
    margin: { top: 20, right: 14, bottom: 20, left: 14 },
    showHead: "everyPage",
  });

  // 4. Footer with page numbering
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
    
    // Timestamp
    const now = new Date().toLocaleString("pt-BR");
    doc.text(`Gerado em: ${now}`, 14, doc.internal.pageSize.getHeight() - 10);
  }

  // 5. Download
  const filename = `ROTA - ${promoterName.replace(/[/\\?%*:|"<>]/g, "-")} - ${referenceDate.split("-").reverse().join("-")}.pdf`;
  doc.save(filename);
};
