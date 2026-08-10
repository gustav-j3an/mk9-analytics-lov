import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib/dist/pdf-lib.esm.js";
import type { OperationCore, OperationStoreRow } from "@/lib/mk9-operations/types";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const WEEKDAY_PT = [
  "DOMINGO", "SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO"
];

const PAGE = { w: 595.28, h: 841.89 };
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
}

function drawHeader(ctx: PdfCtx) {
  ctx.page.drawText("MK9 TRADE", {
    x: MARGIN,
    y: PAGE.h - 30,
    size: 10,
    font: ctx.fontB,
    color: COLOR_BRAND,
  });
  ctx.page.drawText("ROTEIRO SEMANAL DO PROMOTOR", {
    x: PAGE.w - MARGIN - ctx.font.widthOfTextAtSize("ROTEIRO SEMANAL DO PROMOTOR", 8),
    y: PAGE.h - 30,
    size: 8,
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
  const dateStr = `Gerado em ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
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
  const { core, promoterId, promoterName, year, month } = input;
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
  };

  drawHeader(ctx);

  // 1. DADOS DO PROMOTOR & TOTAIS
  const rows = core.storeRows.filter((r) => r.promoterId === promoterId);
  const totalVisits = Math.round(rows.reduce((sum, r) => sum + r.contratadas, 0));
  const uniqueStores = new Set(rows.map((r) => r.storeId)).size;
  const uniqueIndustries = new Set(rows.map((r) => r.industryId)).size;

  ctx.page.drawText(sanitizePdfText(`Promotor: ${promoterName}`), {
    x: MARGIN,
    y: ctx.y,
    size: 11,
    font: fontB,
    color: COLOR_TEXT,
  });
  ctx.y -= 15;

  ctx.page.drawText(`Competência: ${MONTHS_PT[month - 1]} / ${year}`, {
    x: MARGIN,
    y: ctx.y,
    size: 9,
    font: font,
    color: COLOR_MUTED,
  });
  ctx.y -= 25;

  // Grid de Totais
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 40,
    width: CONTENT_W,
    height: 40,
    color: COLOR_HEADER_BG,
    borderColor: COLOR_LINE,
    borderWidth: 0.5,
  });

  const totals = [
    { label: "TOTAL DE LOJAS", value: uniqueStores },
    { label: "TOTAL DE INDÚSTRIAS", value: uniqueIndustries },
    { label: "TOTAL DE ATENDIMENTOS", value: totalVisits },
  ];

  let tx = MARGIN + 20;
  for (const t of totals) {
    ctx.page.drawText(t.label, { x: tx, y: ctx.y - 15, size: 7, font: fontB, color: COLOR_MUTED });
    ctx.page.drawText(String(t.value), { x: tx, y: ctx.y - 30, size: 12, font: fontB, color: COLOR_BRAND });
    tx += 160;
  }
  ctx.y -= 60;

  // 2. AGRUPAMENTO POR DIA DA SEMANA
  const weekdayMap = new Map<number, Map<string, { name: string; chain: string | null; uf: string | null; industries: string[] }>>();

  for (const row of rows) {
    const routeInfo = core.routeByKey.get(`${row.industryId}|${row.storeId}`);
    if (routeInfo) {
      for (const wd of routeInfo.weekdays) {
        if (!weekdayMap.has(wd)) weekdayMap.set(wd, new Map());
        const dayStores = weekdayMap.get(wd)!;
        if (!dayStores.has(row.storeId)) {
          dayStores.set(row.storeId, {
            name: row.storeName,
            chain: row.chain,
            uf: row.uf,
            industries: []
          });
        }
        dayStores.get(row.storeId)!.industries.push(row.industryName);
      }
    }
  }

  const daysToShow = [1, 2, 3, 4, 5, 6, 0];
  for (const wd of daysToShow) {
    const dayStores = weekdayMap.get(wd);
    if (!dayStores || dayStores.size === 0) continue;

    ensureSpace(ctx, 50);
    ctx.y -= 10;
    
    // Separador de Dia
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.y },
      end: { x: PAGE.w - MARGIN, y: ctx.y },
      thickness: 2,
      color: COLOR_BRAND,
    });
    ctx.y -= 15;
    ctx.page.drawText(WEEKDAY_PT[wd], { x: MARGIN, y: ctx.y, size: 10, font: fontB, color: COLOR_BRAND });
    ctx.y -= 10;
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.y },
      end: { x: PAGE.w - MARGIN, y: ctx.y },
      thickness: 2,
      color: COLOR_BRAND,
    });
    ctx.y -= 25;

    let storeIdx = 1;
    const sortedStores = Array.from(dayStores.values()).sort((a, b) => a.name.localeCompare(b.name));
    
    for (const s of sortedStores) {
      ensureSpace(ctx, 60);
      
      const storeTitle = sanitizePdfText(`${storeIdx}. ${s.chain ? `${s.chain} · ` : ""}${s.name} — ${s.uf ?? ""}`);
      ctx.page.drawText(storeTitle, { x: MARGIN, y: ctx.y, size: 9, font: fontB, color: COLOR_TEXT });
      ctx.y -= 15;

      ctx.page.drawText("Indústrias:", { x: MARGIN + 15, y: ctx.y, size: 8, font: fontB, color: COLOR_MUTED });
      ctx.y -= 12;

      for (const ind of s.industries) {
        ensureSpace(ctx, 15);
        ctx.page.drawText(`• ${sanitizePdfText(ind)}`, { x: MARGIN + 25, y: ctx.y, size: 8, font: font, color: COLOR_TEXT });
        ctx.y -= 12;
      }
      
      ctx.y -= 10;
      storeIdx++;
    }
    ctx.y -= 10;
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    ctx.page = p;
    drawFooter(ctx, i + 1, pages.length);
  });

  return pdf.save();
}

export function promoterPdfFileName(name: string, _year: number, _month: number): string {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  return `ROTEIRO_${clean}.pdf`;
}
