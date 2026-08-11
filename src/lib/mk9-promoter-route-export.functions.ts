import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { mk9RoutesListVersioned } from "./mk9-routes.functions";
import { mk9ListPromoters } from "./mk9-data.functions";

export const exportPromoterRouteExcel = createServerFn({ method: "POST" })
  .inputValidator((d) => 
    z.object({
      promoterId: z.string(),
      referenceDate: z.string(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { promoterId, referenceDate } = data;

    // 1. Get Data (Same source)
    const routes = await mk9RoutesListVersioned({ data: { promoterId, referenceDate } });
    const promoters = await mk9ListPromoters();
    const promoter = promoters.find((p: any) => p.id === promoterId);

    if (!promoter) {
      throw new Error("Promotor não encontrado");
    }

    // Attempt to get supervisor name if possible (would require another join, but using what's available)
    const supervisorName = "—";

    // 2. Consolidate (Same logic as screen)
    const rowsMap = new Map<string, {
      industryName: string;
      storeName: string;
      storeChain: string | null;
      uf: string | null;
      days: Set<number>;
    }>();

    for (const r of routes) {
      const key = `${r.industryId}|${r.storeId}`;
      if (!rowsMap.has(key)) {
        rowsMap.set(key, {
          industryName: r.industryName,
          storeName: r.storeName,
          storeChain: r.storeChain,
          uf: r.storeUf,
          days: new Set(),
        });
      }
      rowsMap.get(key)!.days.add(r.weekday);
    }

    const sortedRows = Array.from(rowsMap.values()).sort((a, b) => {
      const indComp = a.industryName.localeCompare(b.industryName, "pt-BR");
      if (indComp !== 0) return indComp;
      return a.storeName.localeCompare(b.storeName, "pt-BR");
    });

    const totalVisits = sortedRows.reduce((acc, row) => acc + row.days.size, 0);

    // 3. Generate Workbook
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("ROTA");

    // Styling helpers
    const headerFill: any = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9D5FF' } }; // Purple 100
    const borderStyle: any = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    };

    // Header Info
    sheet.addRow(["PROMOTOR:", promoter.name.toUpperCase()]);
    sheet.addRow(["REFERÊNCIA:", referenceDate]);
    sheet.addRow(["TOTAL DE VISITAS:", totalVisits]);
    sheet.addRow(["SUPERVISOR:", supervisorName]);
    sheet.addRow([]); // Spacer

    // Matrix Header
    const matrixHeader = ["INDÚSTRIA", "LOJA", "UF", "SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
    const headerRow = sheet.addRow(matrixHeader);
    
    headerRow.eachCell((cell: any) => {
      cell.fill = headerFill;
      cell.font = { bold: true, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = borderStyle;
    });
    // Left align Industry/Store headers
    headerRow.getCell(1).alignment = { horizontal: 'left' };
    headerRow.getCell(2).alignment = { horizontal: 'left' };

    // Rows
    for (const row of sortedRows) {
      const excelRow = sheet.addRow([
        row.industryName.toUpperCase(),
        (row.storeChain ? `${row.storeChain} · ` : "") + row.storeName.toUpperCase(),
        row.uf || "—",
        row.days.has(1) ? "✓" : "",
        row.days.has(2) ? "✓" : "",
        row.days.has(3) ? "✓" : "",
        row.days.has(4) ? "✓" : "",
        row.days.has(5) ? "✓" : "",
        row.days.has(6) ? "✓" : "",
        row.days.has(0) ? "✓" : "",
      ]);

      excelRow.eachCell((cell: any, colNumber: number) => {
        cell.font = { size: 9 };
        cell.border = borderStyle;
        if (colNumber >= 3) {
          cell.alignment = { horizontal: 'center' };
        }
        if (colNumber > 3 && cell.value === "✓") {
          cell.font = { bold: true, color: { argb: 'FF7C3AED' } }; // MK9 Purple
        }
      });
    }

    // Adjust column widths
    sheet.getColumn(1).width = 30;
    sheet.getColumn(2).width = 45;
    sheet.getColumn(3).width = 8;
    for (let i = 4; i <= 10; i++) {
      sheet.getColumn(i).width = 6;
    }

    // Freeze header
    sheet.views = [{ state: 'frozen', ySplit: 6 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      base64: Buffer.from(buffer).toString("base64"),
      filename: `ROTA - ${promoter.name.replace(/[/\\?%*:|"<>]/g, '-')} - ${referenceDate.split('-').reverse().join('-')}.xlsx`
    };
  });
