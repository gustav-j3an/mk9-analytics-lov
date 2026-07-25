// Geração de PDF do Relatório da Indústria usando pdf-lib (compatível com Cloudflare Workers).
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import type { IndustryReport, StoreStatus } from "./industry-report.server";
import { STORE_STATUS_LABEL } from "./industry-report.server";

const MONTHS_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 40;
const CONTENT_W = A4.w - MARGIN * 2;

const COLOR_BRAND = rgb(0.10, 0.32, 0.72);
const COLOR_TEXT = rgb(0.10, 0.12, 0.16);
const COLOR_MUTED = rgb(0.40, 0.45, 0.52);
const COLOR_LINE = rgb(0.85, 0.87, 0.92);
const COLOR_HEADER_BG = rgb(0.94, 0.96, 1.00);
const COLOR_ROW_ALT = rgb(0.97, 0.98, 1.00);
const COLOR_GOOD = rgb(0.10, 0.55, 0.35);
const COLOR_WARN = rgb(0.80, 0.50, 0.10);
const COLOR_BAD  = rgb(0.75, 0.20, 0.20);

function fmtBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function statusColor(s: StoreStatus) {
  if (s === "ATENDIDA_INTEGRAL" || s === "ACIMA_FREQUENCIA") return COLOR_GOOD;
  if (s === "ATENDIDA_PARCIAL") return COLOR_WARN;
  return COLOR_BAD;
}

function sanitizePdfText(s: string): string {
  // WinAnsi (fontes padrão) não cobre alguns símbolos. Substitui os problemáticos.
  return s
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/\u00A0/g, " ");
}

function truncate(font: PDFFont, s: string, size: number, maxW: number): string {
  s = sanitizePdfText(s);
  if (font.widthOfTextAtSize(s, size) <= maxW) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (font.widthOfTextAtSize(s.slice(0, mid) + "…", size) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo) + "…";
}

interface Ctx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  pageNum: number;
  totalPages: () => number;
  font: PDFFont;
  fontB: PDFFont;
  report: IndustryReport;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([A4.w, A4.h]);
  ctx.pageNum += 1;
  ctx.y = A4.h - MARGIN;
  drawRunningHeader(ctx);
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN + 30) newPage(ctx);
}

function drawRunningHeader(ctx: Ctx) {
  const { page, font, report } = ctx;
  page.drawText(sanitizePdfText(`MK9 · Relatório da Indústria`), {
    x: MARGIN, y: A4.h - MARGIN + 12,
    size: 8, font, color: COLOR_MUTED,
  });
  const right = sanitizePdfText(report.industry.name);
  const w = font.widthOfTextAtSize(right, 8);
  page.drawText(right, { x: A4.w - MARGIN - w, y: A4.h - MARGIN + 12, size: 8, font, color: COLOR_MUTED });
  page.drawLine({ start: { x: MARGIN, y: A4.h - MARGIN + 6 }, end: { x: A4.w - MARGIN, y: A4.h - MARGIN + 6 }, thickness: 0.5, color: COLOR_LINE });
}

function drawFooter(ctx: Ctx, total: number) {
  const y = MARGIN - 18;
  ctx.page.drawLine({ start: { x: MARGIN, y: y + 12 }, end: { x: A4.w - MARGIN, y: y + 12 }, thickness: 0.5, color: COLOR_LINE });
  const left = sanitizePdfText(`Emitido em ${new Date(ctx.report.generatedAt).toLocaleString("pt-BR")}`);
  ctx.page.drawText(left, { x: MARGIN, y, size: 8, font: ctx.font, color: COLOR_MUTED });
  const right = `Página ${ctx.pageNum} de ${total}`;
  const w = ctx.font.widthOfTextAtSize(right, 8);
  ctx.page.drawText(right, { x: A4.w - MARGIN - w, y, size: 8, font: ctx.font, color: COLOR_MUTED });
}

function drawTitle(ctx: Ctx) {
  const { page, fontB, font, report } = ctx;
  const periodLabel = `${MONTHS_PT[ctx.report.window.startDate.slice(5,7) ? Number(report.window.startDate.slice(5,7))-1 : 0]}`;
  page.drawText("Relatório de Cobertura", { x: MARGIN, y: ctx.y - 22, size: 20, font: fontB, color: COLOR_BRAND });
  ctx.y -= 30;
  page.drawText(sanitizePdfText(report.industry.name), { x: MARGIN, y: ctx.y - 18, size: 16, font: fontB, color: COLOR_TEXT });
  ctx.y -= 26;
  const meta = `Período: ${fmtBR(report.window.startDate)} a ${fmtBR(report.window.endDate)}  ·  ${report.window.totalDays} dias`;
  page.drawText(sanitizePdfText(meta), { x: MARGIN, y: ctx.y - 12, size: 10, font, color: COLOR_MUTED });
  ctx.y -= 20;
}

function drawKpis(ctx: Ctx) {
  const { page, font, fontB, report } = ctx;
  const cards: Array<{ label: string; value: string; tone: "brand" | "good" | "warn" | "bad" }> = [
    { label: "Lojas no período", value: String(report.totals.totalStores), tone: "brand" },
    { label: "Visitas contratadas", value: String(report.totals.contracted), tone: "brand" },
    { label: "Visitas realizadas", value: String(report.totals.actual), tone: "good" },
    { label: "Pendentes", value: String(report.totals.pending), tone: "bad" },
    { label: "Cobertura", value: `${report.totals.coveragePct}%`, tone: report.totals.coveragePct >= 90 ? "good" : report.totals.coveragePct >= 70 ? "warn" : "bad" },
    { label: "Fora do roteiro", value: String(report.totals.unplanned), tone: "warn" },
  ];
  const cols = 3;
  const gap = 10;
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
  const rows = Math.ceil(cards.length / cols);
  const cardH = 56;
  ensure(ctx, rows * (cardH + gap));
  const startY = ctx.y;
  cards.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gap);
    const y = startY - row * (cardH + gap) - cardH;
    page.drawRectangle({ x, y, width: cardW, height: cardH, color: rgb(1,1,1), borderColor: COLOR_LINE, borderWidth: 0.8 });
    page.drawRectangle({ x, y: y + cardH - 3, width: cardW, height: 3, color: c.tone === "good" ? COLOR_GOOD : c.tone === "bad" ? COLOR_BAD : c.tone === "warn" ? COLOR_WARN : COLOR_BRAND });
    page.drawText(sanitizePdfText(c.label), { x: x + 10, y: y + cardH - 20, size: 9, font, color: COLOR_MUTED });
    page.drawText(sanitizePdfText(c.value), { x: x + 10, y: y + 12, size: 18, font: fontB, color: COLOR_TEXT });
  });
  ctx.y = startY - rows * (cardH + gap);
}

function drawCoverageBar(ctx: Ctx) {
  const { page, font, fontB, report } = ctx;
  ensure(ctx, 60);
  page.drawText("Cobertura geral", { x: MARGIN, y: ctx.y - 14, size: 11, font: fontB, color: COLOR_TEXT });
  ctx.y -= 22;
  const barY = ctx.y - 14;
  page.drawRectangle({ x: MARGIN, y: barY, width: CONTENT_W, height: 14, color: rgb(0.94,0.95,0.98), borderColor: COLOR_LINE, borderWidth: 0.5 });
  const pct = Math.max(0, Math.min(100, report.totals.coveragePct));
  page.drawRectangle({ x: MARGIN, y: barY, width: (CONTENT_W * pct) / 100, height: 14, color: pct >= 90 ? COLOR_GOOD : pct >= 70 ? COLOR_WARN : COLOR_BAD });
  const label = `${pct}%`;
  const w = fontB.widthOfTextAtSize(label, 10);
  page.drawText(label, { x: MARGIN + CONTENT_W - w - 6, y: barY + 3, size: 10, font: fontB, color: COLOR_TEXT });
  ctx.y = barY - 12;
}

function drawUfTable(ctx: Ctx) {
  const { page, font, fontB, report } = ctx;
  if (report.ufs.length === 0) return;
  ensure(ctx, 40);
  page.drawText("Resumo por UF", { x: MARGIN, y: ctx.y - 14, size: 11, font: fontB, color: COLOR_TEXT });
  ctx.y -= 22;
  const cols = [
    { key: "uf", label: "UF", w: 60 },
    { key: "stores", label: "Lojas", w: 80 },
    { key: "expected", label: "Contratadas", w: 110 },
    { key: "actual", label: "Realizadas", w: 110 },
    { key: "coverage", label: "Cobertura", w: CONTENT_W - 60 - 80 - 110 - 110 },
  ];
  drawTableHeader(ctx, cols);
  for (let i = 0; i < report.ufs.length; i++) {
    const u = report.ufs[i];
    ensure(ctx, 18);
    const rowY = ctx.y - 16;
    if (i % 2 === 1) page.drawRectangle({ x: MARGIN, y: rowY - 2, width: CONTENT_W, height: 18, color: COLOR_ROW_ALT });
    let x = MARGIN + 6;
    const vals = [u.uf, String(u.stores), String(u.expected), String(u.actual), `${u.coveragePct}%`];
    for (let c = 0; c < cols.length; c++) {
      const t = truncate(font, vals[c], 9, cols[c].w - 10);
      page.drawText(t, { x, y: rowY, size: 9, font, color: COLOR_TEXT });
      x += cols[c].w;
    }
    ctx.y -= 18;
  }
  ctx.y -= 10;
}

function drawTableHeader(ctx: Ctx, cols: Array<{ label: string; w: number }>) {
  ensure(ctx, 22);
  const y = ctx.y - 18;
  ctx.page.drawRectangle({ x: MARGIN, y: y - 2, width: CONTENT_W, height: 20, color: COLOR_HEADER_BG });
  let x = MARGIN + 6;
  for (const c of cols) {
    ctx.page.drawText(sanitizePdfText(c.label), { x, y, size: 9, font: ctx.fontB, color: COLOR_BRAND });
    x += c.w;
  }
  ctx.y -= 20;
}

function drawStoreTable(ctx: Ctx) {
  const { report, font, fontB, page } = ctx;
  ensure(ctx, 40);
  page.drawText("Resultado por loja", { x: MARGIN, y: ctx.y - 14, size: 11, font: fontB, color: COLOR_TEXT });
  ctx.y -= 22;
  const cols = [
    { key: "name", label: "Loja", w: 180 },
    { key: "uf", label: "UF", w: 36 },
    { key: "expected", label: "Contr.", w: 44 },
    { key: "actual", label: "Real.", w: 44 },
    { key: "pending", label: "Pend.", w: 44 },
    { key: "coverage", label: "Cob.", w: 44 },
    { key: "status", label: "Status", w: CONTENT_W - 180 - 36 - 44 - 44 - 44 - 44 },
  ];
  const drawHeader = () => drawTableHeader(ctx, cols);
  drawHeader();
  for (let i = 0; i < report.stores.length; i++) {
    if (ctx.y - 18 < MARGIN + 40) { newPage(ctx); drawHeader(); }
    const s = report.stores[i];
    const rowY = ctx.y - 16;
    if (i % 2 === 1) page.drawRectangle({ x: MARGIN, y: rowY - 2, width: CONTENT_W, height: 18, color: COLOR_ROW_ALT });
    let x = MARGIN + 6;
    const nameStr = s.chain ? `${s.chain} · ${s.storeName}` : s.storeName;
    const vals = [
      truncate(font, nameStr, 9, cols[0].w - 10),
      s.uf ?? "—",
      String(s.expected),
      String(s.actual),
      String(s.pending),
      `${s.coveragePct}%`,
      truncate(font, STORE_STATUS_LABEL[s.status], 9, cols[6].w - 10),
    ];
    for (let c = 0; c < cols.length; c++) {
      const color = c === 6 ? statusColor(s.status) : COLOR_TEXT;
      page.drawText(sanitizePdfText(vals[c]), { x, y: rowY, size: 9, font, color });
      x += cols[c].w;
    }
    ctx.y -= 18;
  }
}

function drawLegend(ctx: Ctx) {
  ensure(ctx, 60);
  ctx.y -= 8;
  ctx.page.drawText("Legenda de status", { x: MARGIN, y: ctx.y - 12, size: 10, font: ctx.fontB, color: COLOR_TEXT });
  ctx.y -= 20;
  const entries: Array<[StoreStatus, ReturnType<typeof rgb>]> = [
    ["ATENDIDA_INTEGRAL", COLOR_GOOD],
    ["ACIMA_FREQUENCIA", COLOR_GOOD],
    ["ATENDIDA_PARCIAL", COLOR_WARN],
    ["NAO_ATENDIDA", COLOR_BAD],
    ["FORA_ROTEIRO", COLOR_WARN],
  ];
  for (const [k, c] of entries) {
    ensure(ctx, 14);
    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 10, width: 10, height: 10, color: c });
    ctx.page.drawText(sanitizePdfText(STORE_STATUS_LABEL[k]), { x: MARGIN + 16, y: ctx.y - 9, size: 9, font: ctx.font, color: COLOR_TEXT });
    ctx.y -= 14;
  }
}

export async function renderIndustryReportPdf(report: IndustryReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Relatório ${report.industry.name}`);
  pdf.setAuthor("MK9 Analytics");
  pdf.setCreator("MK9 Analytics");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([A4.w, A4.h]);
  const ctx: Ctx = {
    pdf, page, y: A4.h - MARGIN, pageNum: 1, totalPages: () => pdf.getPageCount(), font, fontB, report,
  };
  drawRunningHeader(ctx);
  drawTitle(ctx);
  drawKpis(ctx);
  drawCoverageBar(ctx);
  drawUfTable(ctx);
  drawStoreTable(ctx);
  drawLegend(ctx);

  // Rodapé em todas as páginas
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    ctx.page = pages[i];
    ctx.pageNum = i + 1;
    drawFooter(ctx, pages.length);
  }
  return pdf.save();
}

export function pdfFileName(report: IndustryReport, year: number, month: number): string {
  const name = report.industry.name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  const monthName = MONTHS_PT[month - 1].toUpperCase();
  return `RELATORIO_${name}_${monthName}_${year}.pdf`;
}
