
import { jsPDF } from "jspdf";
import "jspdf-autotable";

interface MatrixRow {
  industryName: string;
  storeName: string;
  storeChain: string | null;
  uf: string | null;
  days: Set<number>;
}

interface GeneratePdfParams {
  promoterName: string;
  referenceDate: string;
  totalVisits: number;
  rows: MatrixRow[];
}

export async function generatePromoterRoutePdf({
  promoterName,
  referenceDate,
  totalVisits,
  rows
}: GeneratePdfParams) {
  try {
    console.log("[PDF_GEN] Inciando geração para:", promoterName);
    
    // 1. Instanciar o documento em A4 Paisagem (landscape)
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    const primaryColor = [59, 130, 246]; // RGB para o roxo/azul primary do sistema (#3b82f6)
    const textColor = [15, 23, 42];    // slate-950
    const lightTextColor = [100, 116, 139]; // slate-500

    // 2. Cabeçalho Principal
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text("MK9 COMMAND CENTER", 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(lightTextColor[0], lightTextColor[1], lightTextColor[2]);
    doc.text("ROTA INDIVIDUAL", 14, 28);

    // Linha divisória
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 32, 283, 32);

    // 3. Informações do Promotor e Resumo
    doc.setFontSize(8);
    doc.setTextColor(lightTextColor[0], lightTextColor[1], lightTextColor[2]);
    doc.text("PROMOTOR", 14, 42);
    doc.text("REFERÊNCIA", 100, 42);
    doc.text("TOTAL DE VISITAS", 186, 42);

    doc.setFontSize(12);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(promoterName.toUpperCase(), 14, 48);
    doc.text(referenceDate.split('-').reverse().join('/'), 100, 48);
    
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(16);
    doc.text(totalVisits.toString(), 186, 48);

    // 4. Preparar dados para a tabela
    // Colunas: Indústria, Loja, UF, SEG, TER, QUA, QUI, SEX, SAB, DOM
    const head = [["INDÚSTRIA", "LOJA", "UF", "SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"]];
    
    const body = rows.map(row => [
      row.industryName.toUpperCase(),
      `${row.storeName.toUpperCase()}${row.storeChain ? '\n' + row.storeChain.toUpperCase() : ''}`,
      row.uf || "—",
      row.days.has(1) ? "✓" : "•",
      row.days.has(2) ? "✓" : "•",
      row.days.has(3) ? "✓" : "•",
      row.days.has(4) ? "✓" : "•",
      row.days.has(5) ? "✓" : "•",
      row.days.has(6) ? "✓" : "•",
      row.days.has(0) ? "✓" : "•",
    ]);

    // 5. Gerar Tabela com autoTable
    (doc as any).autoTable({
      head,
      body,
      startY: 55,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        valign: 'middle',
        font: 'helvetica',
        lineColor: [226, 232, 240], // slate-200
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [241, 245, 249], // slate-100
        textColor: [71, 85, 105],   // slate-600
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 40 }, // Indústria
        1: { cellWidth: 80 }, // Loja
        2: { halign: 'center', cellWidth: 10 }, // UF
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
        7: { halign: 'center' },
        8: { halign: 'center' },
        9: { halign: 'center' },
      },
      didDrawCell: (data: any) => {
        // Estilizar o checkmark
        if (data.section === 'body' && data.column.index >= 3 && data.cell.text[0] === '✓') {
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.setFont("helvetica", "bold");
        } else if (data.section === 'body' && data.column.index >= 3 && data.cell.text[0] === '•') {
          doc.setTextColor(226, 232, 240); // slate-200
        }
      },
      margin: { top: 20, left: 14, right: 14, bottom: 20 },
      showHead: 'everyPage',
    });

    // 6. Rodapé com numeração de páginas
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(lightTextColor[0], lightTextColor[1], lightTextColor[2]);
      
      const pageText = `Página ${i} de ${pageCount}`;
      const footerY = doc.internal.pageSize.getHeight() - 10;
      
      doc.text(pageText, doc.internal.pageSize.getWidth() / 2, footerY, { align: 'center' });
      doc.text(`MK9 ANALYTICS • GERADO EM ${new Date().toLocaleString('pt-BR')}`, 14, footerY);
    }

    // 7. Download
    const cleanName = promoterName.replace(/[^a-z0-9]/gi, '_').toUpperCase();
    const cleanDate = referenceDate.split('-').reverse().join('-');
    const filename = `ROTA - ${promoterName.toUpperCase()} - ${cleanDate}.pdf`;
    
    console.log("[PDF_GEN] Finalizado. Iniciando download:", filename);
    doc.save(filename);
    
    return true;
  } catch (error: any) {
    console.error("[PDF_GEN_ERROR] Erro na geração do PDF:");
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);
    throw error;
  }
}
