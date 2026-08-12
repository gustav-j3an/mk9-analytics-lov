import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";

export async function generatePresenceVisualExport({
  items,
  stats,
  date,
  teamLabel,
  supervisorLabel,
}: {
  items: any[];
  stats: any;
  date: string;
  teamLabel: string;
  supervisorLabel: string;
}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("PRESENÇA");

  // Colors
  const COLORS = {
    NAVY: "FF1A2A47",
    WHITE: "FFFFFFFF",
    GRAY_LIGHT: "FFD1D5DB",
    GRAY_TEXT: "FF6B7280",
    BORDER: "FFE5E7EB",
    STRIPE: "FFF9FAFB",
    PURPLE_LIGHT: "FFF5F3FF",
    PURPLE_TEXT: "FF7C3AED",
    // Status colors
    GREEN_BG: "FFDCFCE7",
    GREEN_TEXT: "FF166534",
    RED_BG: "FFFEE2E2",
    RED_TEXT: "FF991B1B",
    ORANGE_BG: "FFFFF7ED",
    ORANGE_TEXT: "FF9A3412",
    CYAN_BG: "FFECFEFF",
    CYAN_TEXT: "FF0E7490",
    // KPI Colors (soft)
    KPI_BLUE_BG: "FFF0F9FF",
    KPI_BLUE_TEXT: "FF075985",
    KPI_GREEN_BG: "FFF0FDF4",
    KPI_GREEN_TEXT: "FF166534",
    KPI_RED_BG: "FFFEF2F2",
    KPI_RED_TEXT: "FF991B1B",
    KPI_ORANGE_BG: "FFFFFAF2",
    KPI_ORANGE_TEXT: "FF9A3412",
    KPI_PURPLE_BG: "FFF5F3FF",
    KPI_PURPLE_TEXT: "FF7C3AED",
  };

  // Set column widths
  worksheet.columns = [
    { header: "MATRÍCULA", key: "registration", width: 12 },
    { header: "NOME", key: "name", width: 45 },
    { header: "UF", key: "uf", width: 8 },
    { header: "STATUS", key: "status", width: 18 },
    { header: "OBSERVAÇÃO", key: "observation", width: 40 },
    { header: "EQUIPE", key: "team", width: 25 },
    { header: "SUPERVISOR", key: "supervisor", width: 25 },
    { header: "DATA", key: "date", width: 15 },
  ];

  // 1. Header Main
  worksheet.mergeCells("A1:H2");
  const mainHeader = worksheet.getCell("A1");
  mainHeader.value = {
    richText: [
      { text: "MK9 TRADE • CONTROLE DE PRESENÇA\n", font: { bold: true, size: 14, color: { argb: "FFFFFFFF" } } },
      { text: "Relatório diário de presença da equipe", font: { size: 10, color: { argb: "FFD1D5DB" } } },
    ],
  };
  mainHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.NAVY },
  };
  mainHeader.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  worksheet.getRow(1).height = 25;
  worksheet.getRow(2).height = 25;

  // 2. Report info
  worksheet.addRow([]); // Spacer
  
  const addInfoRow = (label: string, value: string, rowIdx: number) => {
    worksheet.getCell(`A${rowIdx}`).value = label;
    worksheet.getCell(`A${rowIdx}`).font = { bold: true, size: 9, color: { argb: COLORS.GRAY_TEXT } };
    worksheet.getCell(`B${rowIdx}`).value = value;
    worksheet.getCell(`B${rowIdx}`).font = { bold: true, size: 10 };
    worksheet.getRow(rowIdx).height = 20;
  };

  addInfoRow("EQUIPE", teamLabel.toUpperCase(), 4);
  addInfoRow("SUPERVISOR", supervisorLabel.toUpperCase(), 5);
  addInfoRow("DATA", format(parseISO(date), "dd/MM/yyyy"), 6);

  // 3. KPIs
  worksheet.addRow([]); // Spacer
  const kpiRowIdx = 8;
  worksheet.getRow(kpiRowIdx).height = 35;

  const kpis = [
    { label: "TOTAL", value: stats.total, bg: COLORS.KPI_BLUE_BG, text: COLORS.KPI_BLUE_TEXT },
    { label: "PRESENTES", value: stats.present, bg: COLORS.KPI_GREEN_BG, text: COLORS.KPI_GREEN_TEXT },
    { label: "FALTAS", value: stats.absent, bg: COLORS.KPI_RED_BG, text: COLORS.KPI_RED_TEXT },
    { label: "ATESTADOS", value: stats.medical, bg: COLORS.KPI_ORANGE_BG, text: COLORS.KPI_ORANGE_TEXT },
    { label: "FÉRIAS", value: stats.vacation, bg: COLORS.KPI_PURPLE_BG, text: COLORS.KPI_PURPLE_TEXT },
  ];

  if (stats.unmarked > 0) {
    kpis.push({ label: "NÃO MARCADOS", value: stats.unmarked, bg: "FFF9FAFB", text: "FF374151" });
  }

  kpis.forEach((kpi, idx) => {
    const colLetter = String.fromCharCode(65 + idx); // A, B, C...
    const cell = worksheet.getCell(`${colLetter}${kpiRowIdx}`);
    cell.value = {
      richText: [
        { text: `${kpi.label}\n`, font: { size: 8, bold: true, color: { argb: kpi.text } } },
        { text: `${kpi.value}`, font: { size: 14, bold: true, color: { argb: kpi.text } } },
      ],
    };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: kpi.bg } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: COLORS.BORDER } },
      left: { style: "thin", color: { argb: COLORS.BORDER } },
      bottom: { style: "thin", color: { argb: COLORS.BORDER } },
      right: { style: "thin", color: { argb: COLORS.BORDER } },
    };
  });

  // 4. List Title
  worksheet.addRow([]); // Spacer
  const listTitleRowIdx = 10;
  worksheet.mergeCells(`A${listTitleRowIdx}:H${listTitleRowIdx}`);
  const listTitleCell = worksheet.getCell(`A${listTitleRowIdx}`);
  listTitleCell.value = "LISTA DE PRESENÇA";
  listTitleCell.font = { bold: true, color: { argb: COLORS.PURPLE_TEXT }, size: 10 };
  listTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PURPLE_LIGHT } };
  listTitleCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(listTitleRowIdx).height = 20;

  // 5. Table Header
  const tableHeaderRowIdx = 11;
  const tableHeaderRow = worksheet.getRow(tableHeaderRowIdx);
  tableHeaderRow.values = ["MATRÍCULA", "NOME", "UF", "STATUS", "OBSERVAÇÃO", "EQUIPE", "SUPERVISOR", "DATA"];
  tableHeaderRow.height = 25;
  
  tableHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.WHITE }, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  // Nome e Obs alinhados à esquerda
  worksheet.getCell(`B${tableHeaderRowIdx}`).alignment = { vertical: "middle", horizontal: "left" };
  worksheet.getCell(`E${tableHeaderRowIdx}`).alignment = { vertical: "middle", horizontal: "left" };

  // 6. Data Rows
  items.forEach((item, idx) => {
    const rowIdx = tableHeaderRowIdx + 1 + idx;
    const row = worksheet.getRow(rowIdx);
    
    let statusLabel = "NÃO MARCADO";
    let statusColors = { bg: COLORS.WHITE, text: COLORS.GRAY_TEXT };

    if (item.status === 'PRESENT') {
      statusLabel = "PRESENTE";
      statusColors = { bg: COLORS.GREEN_BG, text: COLORS.GREEN_TEXT };
    } else if (item.status === 'ABSENT') {
      statusLabel = "FALTA";
      statusColors = { bg: COLORS.RED_BG, text: COLORS.RED_TEXT };
    } else if (item.status === 'MEDICAL_CERTIFICATE') {
      statusLabel = "ATESTADO";
      statusColors = { bg: COLORS.ORANGE_BG, text: COLORS.ORANGE_TEXT };
    } else if (item.status === 'VACATION') {
      statusLabel = "FÉRIAS";
      statusColors = { bg: COLORS.CYAN_BG, text: COLORS.CYAN_TEXT };
    }

    row.values = [
      item.registration_number || "-",
      item.name.toUpperCase(),
      item.uf || "-",
      statusLabel,
      item.observation || "-",
      item.teamName,
      item.supervisorName,
      format(parseISO(date), "dd/MM/yyyy")
    ];

    row.height = 22;

    // Zebra styling
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.STRIPE } };
      });
    }

    // Individual cell formatting
    const cells = {
      reg: row.getCell(1),
      name: row.getCell(2),
      uf: row.getCell(3),
      status: row.getCell(4),
      obs: row.getCell(5),
      team: row.getCell(6),
      supervisor: row.getCell(7),
      date: row.getCell(8)
    };

    cells.reg.alignment = { horizontal: "center", vertical: "middle" };
    cells.name.font = { bold: true, size: 10 };
    cells.uf.alignment = { horizontal: "center", vertical: "middle" };
    
    cells.status.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusColors.bg } };
    cells.status.font = { bold: true, color: { argb: statusColors.text }, size: 9 };
    cells.status.alignment = { horizontal: "center", vertical: "middle" };
    
    cells.obs.alignment = { wrapText: true, vertical: "middle" };
    cells.team.alignment = { horizontal: "center", vertical: "middle" };
    cells.supervisor.alignment = { horizontal: "center", vertical: "middle" };
    cells.date.alignment = { horizontal: "center", vertical: "middle" };

    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: COLORS.BORDER } }
      };
    });
  });

  // Freeze Header
  worksheet.views = [
    { state: "frozen", xSplit: 0, ySplit: tableHeaderRowIdx }
  ];

  // AutoFilter
  worksheet.autoFilter = `A${tableHeaderRowIdx}:H${tableHeaderRowIdx}`;

  // Legend/Footer
  const footerRowIdx = tableHeaderRowIdx + items.length + 3;
  worksheet.getCell(`A${footerRowIdx}`).value = "LEGENDA:";
  worksheet.getCell(`A${footerRowIdx}`).font = { bold: true, size: 8 };
  
  worksheet.getCell(`B${footerRowIdx}`).value = "PRESENTE | FALTA | ATESTADO | FÉRIAS";
  worksheet.getCell(`B${footerRowIdx}`).font = { size: 8, italic: true };
  
  worksheet.mergeCells(`A${footerRowIdx + 1}:H${footerRowIdx + 1}`);
  const genCell = worksheet.getCell(`A${footerRowIdx + 1}`);
  genCell.value = `Relatório gerado pelo MK9 Command Center em ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
  genCell.font = { size: 8, color: { argb: COLORS.GRAY_TEXT } };

  // Write file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  
  const fileName = `PRESENCA - ${teamLabel} - ${format(parseISO(date), "dd-MM-yyyy")}.xlsx`;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
}
