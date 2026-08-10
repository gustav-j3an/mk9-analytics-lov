import * as pdfLib from "pdf-lib";

const PDFDocument = (pdfLib as any).PDFDocument || pdfLib.PDFDocument;
const StandardFonts = (pdfLib as any).StandardFonts || pdfLib.StandardFonts;
const rgb = (pdfLib as any).rgb || pdfLib.rgb;

type PDFPage = any;
type PDFFont = any;
type PDFDocType = any;

const WEEKDAY_PT = [
  "DOMINGO", "SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO"
];

const PAGE = { w: 595.28, h: 841.89 };
const MARGIN = 40;
const CONTENT_W = PAGE.w - MARGIN * 2;
const BOTTOM_LIMIT = 50;

// Paleta MK9 Trade
const COLOR_BRAND = rgb(0.42, 0.21, 0.97); // Purple
const COLOR_BLUE = rgb(0.23, 0.51, 0.96);  // Blue
const COLOR_TEXT = rgb(0.06, 0.09, 0.16);
const COLOR_MUTED = rgb(0.39, 0.45, 0.55);
const COLOR_LINE = rgb(0.9, 0.92, 0.95);
const COLOR_SECTION_BG = rgb(0.98, 0.98, 1.0);

function sanitize(s: string): string {
  return (s ?? "").replace(/[^\x20-\x7E\xA0-\xFF]/g, " ").trim();
}

interface PdfCtx {
  pdf: PDFDocType;
  page: PDFPage;
  y: number;
  font: PDFFont;
  fontB: PDFFont;
  pageNum: number;
}

function drawHeader(ctx: PdfCtx, promoterName: string, refDate: string, stats: { days: number, stops: number, items: number }) {
  // Brand Top
  ctx.page.drawText("MK9 TRADE", { x: MARGIN, y: PAGE.h - 30, size: 9, font: ctx.fontB, color: COLOR_BRAND });
  ctx.page.drawText("ROTEIRO SEMANAL", { 
    x: PAGE.w - MARGIN - ctx.font.widthOfTextAtSize("ROTEIRO SEMANAL", 9), 
    y: PAGE.h - 30, 
    size: 9, 
    font: ctx.font, 
    color: COLOR_MUTED 
  });

  ctx.y = PAGE.h - 55;
  
  // Promoter
  ctx.page.drawText(sanitize(promoterName), { x: MARGIN, y: ctx.y, size: 14, font: ctx.fontB, color: COLOR_TEXT });
  
  const refStr = `Referência: ${refDate.split('-').reverse().join('/')}`;
  ctx.page.drawText(refStr, { 
    x: PAGE.w - MARGIN - ctx.font.widthOfTextAtSize(refStr, 9), 
    y: ctx.y, 
    size: 9, 
    font: ctx.font, 
    color: COLOR_MUTED 
  });
  
  ctx.y -= 20;

  // Stats Line - Formato solicitado: 5 DIAS | 9 PARADAS | 19 ITENS
  const statsStr = `${stats.days} DIAS | ${stats.stops} PARADAS | ${stats.items} ITENS`;
  ctx.page.drawText(statsStr, { x: MARGIN, y: ctx.y, size: 8, font: ctx.fontB, color: COLOR_BLUE });
  
  ctx.y -= 15;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE.w - MARGIN, y: ctx.y },
    thickness: 1,
    color: COLOR_LINE
  });
  ctx.y -= 25;
}

function drawFooter(ctx: PdfCtx, totalPages: number) {
  const y = 25;
  const d = new Date();
  const dateStr = `MK9 Trade • Gerado em ${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  ctx.page.drawText(sanitize(dateStr), { x: MARGIN, y, size: 7, font: ctx.font, color: COLOR_MUTED });
  
  const pStr = `Página ${ctx.pageNum} de ${totalPages}`;
  ctx.page.drawText(pStr, { 
    x: PAGE.w - MARGIN - ctx.font.widthOfTextAtSize(pStr, 7), 
    y, 
    size: 7, 
    font: ctx.font, 
    color: COLOR_MUTED 
  });
}

function startNewPage(ctx: PdfCtx, promoterName: string, refDate: string, stats: { days: number, stops: number, items: number }) {
  ctx.page = ctx.pdf.addPage([PAGE.w, PAGE.h]);
  ctx.pageNum++;
  ctx.y = PAGE.h - 60;
  drawHeader(ctx, promoterName, refDate, stats);
}

export async function renderPromoterRoutePdf(input: {
  routes: any[];
  promoterName: string;
  referenceDate: string;
}): Promise<Uint8Array> {
  const { routes, promoterName, referenceDate } = input;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  
  // Calculate stats
  const daysWithRoute = new Set(routes.map(r => r.weekday)).size;
  const itemsCount = routes.length;
  // Paradas = ocorrência única de (dia + loja)
  const stops = new Set(routes.map(r => `${r.weekday}-${r.storeId}`)).size;
  const stats = { days: daysWithRoute, stops, items: itemsCount };

  const ctx: PdfCtx = {
    pdf,
    page: null as any,
    y: 0,
    font,
    fontB,
    pageNum: 0
  };

  startNewPage(ctx, promoterName, referenceDate, stats);

  // Group by weekday -> store
  const grouped = new Map<number, Map<string, { store: any, industries: string[] }>>();
  for (const r of routes) {
    if (!grouped.has(r.weekday)) grouped.set(r.weekday, new Map());
    const dayMap = grouped.get(r.weekday)!;
    const storeKey = r.storeId || r.storeName;
    if (!dayMap.has(storeKey)) {
      dayMap.set(storeKey, { store: r, industries: [] });
    }
    dayMap.get(storeKey)!.industries.push(r.industryName);
  }

  const sortedDays = Array.from(grouped.keys()).sort((a, b) => {
    // Ordem: Seg(1) a Sáb(6), depois Dom(0)
    const valA = a === 0 ? 7 : a;
    const valB = b === 0 ? 7 : b;
    return valA - valB;
  });

  for (const wd of sortedDays) {
    const dayStores = grouped.get(wd)!;
    
    // Check space for Day Header + at least one store
    if (ctx.y < 120) startNewPage(ctx, promoterName, referenceDate, stats);

    // Day Section Header
    ctx.page.drawRectangle({
      x: MARGIN,
      y: ctx.y - 20,
      width: CONTENT_W,
      height: 20,
      color: COLOR_SECTION_BG,
    });
    ctx.page.drawText(WEEKDAY_PT[wd], { x: MARGIN + 8, y: ctx.y - 14, size: 9, font: fontB, color: COLOR_BRAND });
    
    const stopCountStr = `${dayStores.size} PARADA${dayStores.size > 1 ? 'S' : ''}`;
    ctx.page.drawText(stopCountStr, { 
      x: PAGE.w - MARGIN - 8 - font.widthOfTextAtSize(stopCountStr, 7), 
      y: ctx.y - 14, 
      size: 7, 
      font: fontB, 
      color: COLOR_MUTED 
    });
    
    ctx.y -= 30;

    let storeIdx = 1;
    for (const { store, industries } of dayStores.values()) {
      // Estimated height: store name (10) + industries (10) + padding (10)
      const needed = 30;
      
      if (ctx.y < needed + BOTTOM_LIMIT) {
        startNewPage(ctx, promoterName, referenceDate, stats);
        // Re-draw day header if we just swapped page in middle of day
        ctx.page.drawText(`${WEEKDAY_PT[wd]} (cont.)`, { x: MARGIN, y: ctx.y, size: 8, font: fontB, color: COLOR_BRAND });
        ctx.y -= 20;
      }

      // Store Row - Formato compacto
      const idxStr = String(storeIdx).padStart(2, '0');
      ctx.page.drawText(idxStr, { x: MARGIN, y: ctx.y, size: 9, font: fontB, color: COLOR_BLUE });
      
      const storeName = sanitize(`${store.storeChain ? `${store.storeChain} · ` : ""}${store.storeName}`);
      ctx.page.drawText(storeName.substring(0, 65), { x: MARGIN + 25, y: ctx.y, size: 9, font: fontB, color: COLOR_TEXT });
      
      const uf = sanitize(store.storeUf || "");
      if (uf) {
        ctx.page.drawText(uf, { 
          x: PAGE.w - MARGIN - font.widthOfTextAtSize(uf, 8), 
          y: ctx.y, 
          size: 8, 
          font: font, 
          color: COLOR_MUTED 
        });
      }
      
      ctx.y -= 11;

      // Industries (compact line) - Sem "INDÚSTRIAS:" extra
      const indStr = industries.map(sanitize).join(" • ");
      ctx.page.drawText(indStr.substring(0, 100), { x: MARGIN + 25, y: ctx.y, size: 8, font: font, color: COLOR_MUTED });
      
      ctx.y -= 15;
      storeIdx++;
    }
    ctx.y -= 5;
  }


  // Finalize all pages with footers
  const totalPages = pdf.getPageCount();
  pdf.getPages().forEach((p, i) => {
    ctx.page = p;
    ctx.pageNum = i + 1;
    drawFooter(ctx, totalPages);
  });

  return pdf.save();
}

export function promoterPdfFileName(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  return `ROTEIRO_${clean}.pdf`;
}
