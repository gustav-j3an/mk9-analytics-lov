import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib/dist/pdf-lib.esm.js";
import type { OperationCore } from "@/lib/mk9-operations/types";

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAY_PT = [
  "DOMINGO",
  "SEGUNDA-FEIRA",
  "TERÇA-FEIRA",
  "QUARTA-FEIRA",
  "QUINTA-FEIRA",
  "SEXTA-FEIRA",
  "SÁBADO",
];

const PAGE = { w: 595.28, h: 841.89 }; // A4 portrait
const MARGIN = 40;
const CONTENT_W = PAGE.w - MARGIN * 2;
const BOTTOM_LIMIT = 50;

const COLOR_BRAND = rgb(0.07, 0.24, 0.52);
const COLOR_TEXT = rgb(0.1, 0.12, 0.16);
const COLOR_MUTED = rgb(0.4, 0.45, 0.52);
const COLOR_LINE = rgb(0.84, 0.87, 0.91);
const COLOR_HEADER_BG = rgb(0.93, 0.96, 1.0);

function sanitizePdfText(s: string): string {
  return (s ?? "").replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
}

interface PdfCtx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  fontB: PDFFont;
  core: OperationCore;
  promoterId: string;
  promoterName: string;
  promoterEmployeeNumber: string | null;
  year: number;
  month: number;
}

function drawHeader(ctx: PdfCtx) {
  ctx.page.drawText("MK9 Analytics", {
    x: MARGIN,
    y: PAGE.h - 30,
    size: 10,
    font: ctx.fontB,
    color: COLOR_BRAND,
  });
  ctx.page.drawText("ROTEIRO DO PROMOTOR", {
    x: PAGE.w - MARGIN - ctx.font.widthOfTextAtSize("ROTEIRO DO PROMOTOR", 10),
    y: PAGE.h - 30,
    size: 10,
    font: ctx.font,
    color: COLOR_MUTED,
  });
  ctx.page.drawLine({
    start: { x: MARGIN, y: PAGE.h - 40 },
    end: { x: PAGE.w - MARGIN, y: PAGE.h - 40 },
    thickness: 0.5,
    color: COLOR_LINE,
  });
}

function drawFooter(ctx: PdfCtx, pageNum: number, total: number) {
  const y = 30;
  ctx.page.drawLine({
    start: { x: MARGIN, y: y + 10 },
    end: { x: PAGE.w - MARGIN, y: y + 10 },
    thickness: 0.5,
    color: COLOR_LINE,
  });
  const d = new Date();
  const dateStr = `Emitido em ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  ctx.page.drawText(sanitizePdfText(dateStr), {
    x: MARGIN,
    y,
    size: 7,
    font: ctx.font,
    color: COLOR_MUTED,
  });
  const pStr = `Página ${pageNum} de ${total}`;
  ctx.page.drawText(pStr, {
    x: PAGE.w - MARGIN - ctx.font.widthOfTextAtSize(pStr, 7),
    y,
    size: 7,
    font: ctx.font,
    color: COLOR_MUTED,
  });
}

function newPage(ctx: PdfCtx) {
  ctx.page = ctx.pdf.addPage([PAGE.w, PAGE.h]);
  ctx.y = PAGE.h - 60;
  drawHeader(ctx);
}

function ensureSpace(ctx: PdfCtx, needed: number) {
  if (ctx.y - needed < BOTTOM_LIMIT) newPage(ctx);
}

export async function renderPromoterRoutePdf(input: {
  core: OperationCore;
  promoterId: string;
  promoterName: string;
  promoterEmployeeNumber: string | null;
  year: number;
  month: number;
}): Promise<Uint8Array> {
  const { core, promoterId, promoterName, promoterEmployeeNumber, year, month } = input;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE.w, PAGE.h]);

  const ctx: PdfCtx = {
    pdf,
    page,
    y: PAGE.h - 60,
    font,
    fontB,
    core,
    promoterId,
    promoterName,
    promoterEmployeeNumber,
    year,
    month,
  };

  drawHeader(ctx);

  // 1. DADOS DO PROMOTOR & TOTAIS
  const rows = core.storeRows.filter((r) => r.promoterId === promoterId);
  const totalVisits = Math.round(rows.reduce((sum, r) => sum + r.contratadas, 0));
  const uniqueStores = new Set(rows.map((r) => r.storeId)).size;
  const uniqueIndustries = new Set(rows.map((r) => r.industryId)).size;

  ctx.page.drawText("RESUMO DO ROTEIRO", {
    x: MARGIN,
    y: ctx.y,
    size: 12,
    font: fontB,
    color: COLOR_BRAND,
  });
  ctx.y -= 25;

  const info = [
    ["Promotor:", promoterName],
    ...(promoterEmployeeNumber ? [["Matrícula:", promoterEmployeeNumber]] : []),
    ["Competência:", `${MONTHS_PT[month - 1]} / ${year}`],
    ["", ""],
    ["TOTAL DE VISITAS:", String(totalVisits)],
    ["LOJAS ÚNICAS:", String(uniqueStores)],
    ["INDÚSTRIAS:", String(uniqueIndustries)],
  ];

  for (const [label, val] of info) {
    if (!label) {
      ctx.y -= 10;
      continue;
    }
    ctx.page.drawText(label, { x: MARGIN, y: ctx.y, size: 9, font: fontB, color: COLOR_TEXT });
    ctx.page.drawText(sanitizePdfText(val), {
      x: MARGIN + 120,
      y: ctx.y,
      size: 9,
      font: font,
      color: COLOR_TEXT,
    });
    ctx.y -= 14;
  }

  ctx.y -= 20;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y + 10 },
    end: { x: PAGE.w - MARGIN, y: ctx.y + 10 },
    thickness: 0.5,
    color: COLOR_LINE,
  });

  // 2. AGRUPAMENTO POR DIA DA SEMANA
  const weekdayMap = new Map<number, any[]>();
  const weekdayTotalVisits = [0, 0, 0, 0, 0, 0, 0];

  for (const row of rows) {
    const routeInfo = core.routeByKey.get(`${row.industryId}|${row.storeId}`);
    if (routeInfo) {
      const daysCount = routeInfo.weekdays.size;
      const perDay = row.contratadas / daysCount;
      for (const wd of routeInfo.weekdays) {
        if (!weekdayMap.has(wd)) weekdayMap.set(wd, []);
        weekdayMap.get(wd)!.push({
          storeName: row.storeName,
          chain: row.chain,
          industryName: row.industryName,
          uf: row.uf,
        });
        weekdayTotalVisits[wd] += perDay;
      }
    }
  }

  // Renderiza cada dia
  for (let wd = 1; wd <= 6; wd++) {
    // Segunda a Sábado (padrão)
    const stores = weekdayMap.get(wd) || [];
    if (stores.length === 0 && wd > 5) continue; // Pula Sábado se vazio

    ensureSpace(ctx, 40);
    ctx.page.drawRectangle({
      x: MARGIN,
      y: ctx.y - 15,
      width: CONTENT_W,
      height: 15,
      color: COLOR_HEADER_BG,
    });
    const dayLabel = `${WEEKDAY_PT[wd]} (${Math.round(weekdayTotalVisits[wd])} visitas)`;
    ctx.page.drawText(dayLabel, {
      x: MARGIN + 5,
      y: ctx.y - 11,
      size: 9,
      font: fontB,
      color: COLOR_BRAND,
    });
    ctx.y -= 25;

    if (stores.length === 0) {
      ctx.page.drawText("Sem visitas programadas.", {
        x: MARGIN + 10,
        y: ctx.y,
        size: 8,
        font: font,
        color: COLOR_MUTED,
      });
      ctx.y -= 15;
    } else {
      // Ordena por Loja
      stores.sort((a, b) => a.storeName.localeCompare(b.storeName));
      for (const s of stores) {
        ensureSpace(ctx, 15);
        const storeLine = sanitizePdfText(
          `${s.chain ? `${s.chain} · ` : ""}${s.storeName} (${s.uf})`,
        );
        ctx.page.drawText("•", {
          x: MARGIN + 5,
          y: ctx.y,
          size: 8,
          font: fontB,
          color: COLOR_BRAND,
        });
        ctx.page.drawText(storeLine, {
          x: MARGIN + 15,
          y: ctx.y,
          size: 8,
          font: font,
          color: COLOR_TEXT,
        });
        const indW = font.widthOfTextAtSize(sanitizePdfText(s.industryName), 7);
        ctx.page.drawText(sanitizePdfText(s.industryName), {
          x: PAGE.w - MARGIN - indW,
          y: ctx.y,
          size: 7,
          font: font,
          color: COLOR_MUTED,
        });
        ctx.y -= 12;
      }
      ctx.y -= 5;
    }
  }

  // 3. RESUMO FINAL
  ensureSpace(ctx, 120);
  ctx.y -= 20;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 100,
    width: CONTENT_W,
    height: 100,
    color: rgb(0.98, 0.98, 0.98),
    borderColor: COLOR_LINE,
    borderWidth: 0.5,
  });

  let subY = ctx.y - 20;
  ctx.page.drawText("RESUMO POR DIA", {
    x: MARGIN + 20,
    y: subY,
    size: 9,
    font: fontB,
    color: COLOR_TEXT,
  });
  subY -= 20;

  const gridX = [MARGIN + 20, MARGIN + 120, MARGIN + 220, MARGIN + 320];
  const daysToShow = [1, 2, 3, 4, 5, 6, 0];

  daysToShow.forEach((wd, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = gridX[col];
    const y = subY - row * 15;
    const label = WEEKDAY_PT[wd].split("-")[0];
    ctx.page.drawText(`${label}: ${Math.round(weekdayTotalVisits[wd])}`, {
      x,
      y: y,
      size: 8,
      font: font,
      color: COLOR_TEXT,
    });
  });

  const totalStr = `TOTAL: ${totalVisits} visitas`;
  const totalW = fontB.widthOfTextAtSize(totalStr, 10);
  ctx.page.drawText(totalStr, {
    x: PAGE.w - MARGIN - 20 - totalW,
    y: subY - 15,
    size: 10,
    font: fontB,
    color: COLOR_BRAND,
  });

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    ctx.page = p;
    drawFooter(ctx, i + 1, pages.length);
  });

  return pdf.save();
}

export function promoterPdfFileName(name: string, year: number, month: number): string {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  const meses = [
    "JANEIRO",
    "FEVEREIRO",
    "MARCO",
    "ABRIL",
    "MAIO",
    "JUNHO",
    "JULHO",
    "AGOSTO",
    "SETEMBRO",
    "OUTUBRO",
    "NOVEMBRO",
    "DEZEMBRO",
  ];
  return `ROTEIRO_${clean}_${meses[month - 1]}_${year}.pdf`;
}
