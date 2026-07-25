// Server-only PDF renderer for the Industry Report.
// Uses the self-contained pdf-lib ESM bundle to avoid the tslib/CommonJS entrypoint.
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib/dist/pdf-lib.esm.js";
import type { ExecutionStatus, IndustryReport, RouteStatus, StoreLine } from "@/lib/mk9-reports/industry-report.server";
import { EXECUTION_STATUS_LABEL, ROUTE_STATUS_LABEL } from "@/lib/mk9-reports/industry-report.server";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 38;
const CONTENT_W = A4.w - MARGIN * 2;

const COLOR_BRAND = rgb(0.07, 0.24, 0.52);
const COLOR_TEXT = rgb(0.10, 0.12, 0.16);
const COLOR_MUTED = rgb(0.40, 0.45, 0.52);
const COLOR_LINE = rgb(0.84, 0.87, 0.91);
const COLOR_HEADER_BG = rgb(0.93, 0.96, 1.00);
const COLOR_ROW_ALT = rgb(0.97, 0.98, 1.00);
const COLOR_GOOD = rgb(0.08, 0.50, 0.32);
const COLOR_WARN = rgb(0.82, 0.48, 0.08);
const COLOR_BAD = rgb(0.74, 0.18, 0.20);

function fmtBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function pct(value: number): string {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function executionColor(s: ExecutionStatus) {
  if (s === "INTEGRAL") return COLOR_GOOD;
  if (s === "PARCIAL") return COLOR_WARN;
  return COLOR_BAD;
}

function routeColor(s: RouteStatus) {
  return s === "DENTRO_ROTEIRO" ? COLOR_GOOD : COLOR_WARN;
}

function sanitizePdfText(s: string): string {
  return s
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/\u00A0/g, " ");
}

function truncate(font: PDFFont, text: string, size: number, maxW: number): string {
  const s = sanitizePdfText(text || "—");
  if (font.widthOfTextAtSize(s, size) <= maxW) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (font.widthOfTextAtSize(`${s.slice(0, mid)}...`, size) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return `${s.slice(0, lo)}...`;
}

type Column = { label: string; w: number };

interface PdfCtx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  pageNum: number;
  font: PDFFont;
  fontB: PDFFont;
  report: IndustryReport;
}

function drawRunningHeader(ctx: PdfCtx) {
  ctx.page.drawText("MK9 Analytics", { x: MARGIN, y: A4.h - 24, size: 9, font: ctx.fontB, color: COLOR_BRAND });
  const right = sanitizePdfText(ctx.report.industry.name);
  const w = ctx.font.widthOfTextAtSize(right, 8);
  ctx.page.drawText(right, { x: A4.w - MARGIN - w, y: A4.h - 24, size: 8, font: ctx.font, color: COLOR_MUTED });
  ctx.page.drawLine({ start: { x: MARGIN, y: A4.h - 32 }, end: { x: A4.w - MARGIN, y: A4.h - 32 }, thickness: 0.5, color: COLOR_LINE });
}

function newPage(ctx: PdfCtx) {
  ctx.page = ctx.pdf.addPage([A4.w, A4.h]);
  ctx.pageNum += 1;
  ctx.y = A4.h - MARGIN;
  drawRunningHeader(ctx);
}

function ensure(ctx: PdfCtx, needed: number) {
  if (ctx.y - needed < MARGIN + 34) newPage(ctx);
}

function drawFooter(ctx: PdfCtx, pageNumber: number, total: number) {
  const y = MARGIN - 18;
  ctx.page.drawLine({ start: { x: MARGIN, y: y + 12 }, end: { x: A4.w - MARGIN, y: y + 12 }, thickness: 0.5, color: COLOR_LINE });
  const left = sanitizePdfText(`Emitido em ${new Date(ctx.report.generatedAt).toLocaleString("pt-BR")}`);
  ctx.page.drawText(left, { x: MARGIN, y, size: 8, font: ctx.font, color: COLOR_MUTED });
  const right = `Página ${pageNumber} de ${total}`;
  const w = ctx.font.widthOfTextAtSize(right, 8);
  ctx.page.drawText(right, { x: A4.w - MARGIN - w, y, size: 8, font: ctx.font, color: COLOR_MUTED });
}

function drawTitle(ctx: PdfCtx, year: number, month: number) {
  const { report } = ctx;
  ctx.page.drawText("Relatório de visitas", { x: MARGIN, y: ctx.y - 26, size: 22, font: ctx.fontB, color: COLOR_BRAND });
  ctx.y -= 36;
  ctx.page.drawText(sanitizePdfText(report.industry.name), { x: MARGIN, y: ctx.y - 18, size: 16, font: ctx.fontB, color: COLOR_TEXT });
  ctx.y -= 28;
  const filters = [report.filters.uf ? `UF ${report.filters.uf}` : null, report.filters.sourceImportId ? "Checklist filtrado" : null].filter(Boolean).join(" · ");
  const meta = `Competência: ${MONTHS_PT[month - 1]} / ${year}  ·  Período real: ${fmtBR(report.window.startDate)} a ${fmtBR(report.window.endDate)}  ·  ${report.window.totalDays} dias`;
  ctx.page.drawText(sanitizePdfText(meta), { x: MARGIN, y: ctx.y - 12, size: 9.5, font: ctx.font, color: COLOR_MUTED });
  ctx.y -= 17;
  if (filters) {
    ctx.page.drawText(sanitizePdfText(`Filtros: ${filters}`), { x: MARGIN, y: ctx.y - 12, size: 9, font: ctx.font, color: COLOR_MUTED });
    ctx.y -= 16;
  }
}

function drawKpis(ctx: PdfCtx) {
  const t = ctx.report.totals;
  const m = t.metrics;
  const cards = [
    ["Lojas", String(t.totalStores), "brand"],
    ["Visitas contratadas", String(m.contratadas), "brand"],
    ["Visitas realizadas", String(m.executadas), "good"],
    ["Visitas pendentes", String(m.pendencias), "bad"],
    ["Extras", String(m.extras), "warn"],
    ["Fora do roteiro", String(t.unplanned), "warn"],
    ["Cobertura", pct(m.coberturaPct), m.coberturaPct >= 90 ? "good" : m.coberturaPct >= 70 ? "warn" : "bad"],
    ["Cob. operacional", pct(t.operationalCoveragePct), t.operationalCoveragePct >= 90 ? "good" : t.operationalCoveragePct >= 70 ? "warn" : "bad"],
  ] as const;
  const cols = 4;
  const gap = 8;
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cardH = 48;
  const rows = Math.ceil(cards.length / cols);
  ensure(ctx, rows * (cardH + gap) + 8);
  const startY = ctx.y;
  cards.forEach(([label, value, tone], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gap);
    const y = startY - row * (cardH + gap) - cardH;
    const color = tone === "good" ? COLOR_GOOD : tone === "bad" ? COLOR_BAD : tone === "warn" ? COLOR_WARN : COLOR_BRAND;
    ctx.page.drawRectangle({ x, y, width: cardW, height: cardH, color: rgb(1, 1, 1), borderColor: COLOR_LINE, borderWidth: 0.7 });
    ctx.page.drawRectangle({ x, y: y + cardH - 3, width: cardW, height: 3, color });
    ctx.page.drawText(truncate(ctx.font, label, 7.5, cardW - 10), { x: x + 7, y: y + cardH - 17, size: 7.5, font: ctx.font, color: COLOR_MUTED });
    ctx.page.drawText(value, { x: x + 7, y: y + 10, size: 15, font: ctx.fontB, color: COLOR_TEXT });
  });
  ctx.y = startY - rows * (cardH + gap) - 10;
}

function drawCoverageExplanation(ctx: PdfCtx) {
  ensure(ctx, 58);
  ctx.page.drawText("Critério de cobertura", { x: MARGIN, y: ctx.y - 12, size: 10, font: ctx.fontB, color: COLOR_TEXT });
  ctx.y -= 18;
  const lines = [
    "Contratadas = soma da coluna VISITA MENSAL do checklist por loja; roteiro é auditoria separada.",
    "Cobertura contratual = soma por loja de min(realizadas válidas, visitas contratadas) / visitas contratadas.",
    "Visitas extras em uma loja são destacadas separadamente e não compensam pendências de outra loja.",
    "Cobertura operacional = visitas planejadas conciliadas / visitas planejadas no roteiro.",
  ];
  for (const line of lines) {
    ctx.page.drawText(sanitizePdfText(line), { x: MARGIN, y: ctx.y - 10, size: 8.5, font: ctx.font, color: COLOR_MUTED });
    ctx.y -= 13;
  }
  ctx.y -= 6;
}

function drawTableHeader(ctx: PdfCtx, cols: Column[]) {
  ensure(ctx, 22);
  const y = ctx.y - 18;
  ctx.page.drawRectangle({ x: MARGIN, y: y - 3, width: CONTENT_W, height: 21, color: COLOR_HEADER_BG });
  let x = MARGIN + 5;
  for (const col of cols) {
    ctx.page.drawText(sanitizePdfText(col.label), { x, y, size: 8, font: ctx.fontB, color: COLOR_BRAND });
    x += col.w;
  }
  ctx.y -= 21;
}

function drawUfTable(ctx: PdfCtx) {
  if (ctx.report.ufs.length === 0) return;
  ensure(ctx, 50);
  ctx.page.drawText("Resumo por UF", { x: MARGIN, y: ctx.y - 12, size: 11, font: ctx.fontB, color: COLOR_TEXT });
  ctx.y -= 20;
  const cols: Column[] = [
    { label: "UF", w: 42 },
    { label: "Lojas", w: 52 },
    { label: "Contr.", w: 58 },
    { label: "Real.", w: 54 },
    { label: "Válidas", w: 58 },
    { label: "Pend.", w: 50 },
    { label: "Extras", w: 50 },
    { label: "Cobertura", w: CONTENT_W - 364 },
  ];
  drawTableHeader(ctx, cols);
  ctx.report.ufs.forEach((u, i) => {
    ensure(ctx, 18);
    const y = ctx.y - 15;
    if (i % 2 === 1) ctx.page.drawRectangle({ x: MARGIN, y: y - 3, width: CONTENT_W, height: 18, color: COLOR_ROW_ALT });
    const vals = [u.uf, String(u.stores), String(u.expected), String(u.actual), String(u.validForCoverage), String(u.pending), String(u.extra), pct(u.coveragePct)];
    let x = MARGIN + 5;
    vals.forEach((v, idx) => {
      ctx.page.drawText(truncate(ctx.font, v, 8.5, cols[idx].w - 8), { x, y, size: 8.5, font: ctx.font, color: COLOR_TEXT });
      x += cols[idx].w;
    });
    ctx.y -= 18;
  });
  ctx.y -= 12;
}

function dateList(store: StoreLine): string {
  if (store.actualDates.length === 0) return "—";
  const formatted = store.actualDates.map(fmtBR);
  if (formatted.length <= 5) return formatted.join(", ");
  return `${formatted.slice(0, 5).join(", ")} +${formatted.length - 5}`;
}

function drawStoreTable(ctx: PdfCtx) {
  ensure(ctx, 54);
  ctx.page.drawText("Resultado por loja", { x: MARGIN, y: ctx.y - 12, size: 11, font: ctx.fontB, color: COLOR_TEXT });
  ctx.y -= 20;
  const cols: Column[] = [
    { label: "Loja", w: 122 },
    { label: "UF", w: 24 },
    { label: "Contr.", w: 36 },
    { label: "Real.", w: 34 },
    { label: "Vál.", w: 30 },
    { label: "Pend.", w: 34 },
    { label: "Extra", w: 34 },
    { label: "Cob.", w: 34 },
    { label: "Exec.", w: 54 },
    { label: "Roteiro", w: 58 },
    { label: "Datas realizadas", w: CONTENT_W - 460 },
  ];
  const drawHeader = () => drawTableHeader(ctx, cols);
  drawHeader();
  ctx.report.stores.forEach((s, i) => {
    if (ctx.y - 18 < MARGIN + 40) {
      newPage(ctx);
      drawHeader();
    }
    const y = ctx.y - 15;
    if (i % 2 === 1) ctx.page.drawRectangle({ x: MARGIN, y: y - 3, width: CONTENT_W, height: 18, color: COLOR_ROW_ALT });
    const name = s.chain ? `${s.chain} - ${s.storeName}` : s.storeName;
    const vals = [
      truncate(ctx.font, name, 8, cols[0].w - 8),
      s.uf ?? "—",
      String(s.expected),
      String(s.actual),
      String(s.validForCoverage),
      String(s.pending),
      String(s.extra),
      pct(s.coveragePct),
      truncate(ctx.font, EXECUTION_STATUS_LABEL[s.executionStatus], 8, cols[8].w - 8),
      truncate(ctx.font, ROUTE_STATUS_LABEL[s.routeStatus], 8, cols[9].w - 8),
      truncate(ctx.font, dateList(s), 8, cols[10].w - 8),
    ];
    let x = MARGIN + 5;
    vals.forEach((v, idx) => {
      const color = idx === 8 ? executionColor(s.executionStatus) : idx === 9 ? routeColor(s.routeStatus) : COLOR_TEXT;
      ctx.page.drawText(sanitizePdfText(v), { x, y, size: 8, font: idx === 8 || idx === 9 ? ctx.fontB : ctx.font, color });
      x += cols[idx].w;
    });
    ctx.y -= 18;
  });
}

function drawLegend(ctx: PdfCtx) {
  ensure(ctx, 86);
  ctx.y -= 8;
  ctx.page.drawText("Legenda", { x: MARGIN, y: ctx.y - 12, size: 10, font: ctx.fontB, color: COLOR_TEXT });
  ctx.y -= 20;
  const executionStatuses: ExecutionStatus[] = ["INTEGRAL", "PARCIAL", "NAO_ATENDIDA"];
  for (const st of executionStatuses) {
    ensure(ctx, 14);
    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 10, width: 9, height: 9, color: executionColor(st) });
    ctx.page.drawText(sanitizePdfText(`Execução: ${EXECUTION_STATUS_LABEL[st]}`), { x: MARGIN + 15, y: ctx.y - 9, size: 8.5, font: ctx.font, color: COLOR_TEXT });
    ctx.y -= 13;
  }
  const routeStatuses: RouteStatus[] = ["DENTRO_ROTEIRO", "FORA_ROTEIRO"];
  for (const st of routeStatuses) {
    ensure(ctx, 14);
    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 10, width: 9, height: 9, color: routeColor(st) });
    ctx.page.drawText(sanitizePdfText(`Roteiro: ${ROUTE_STATUS_LABEL[st]}`), { x: MARGIN + 15, y: ctx.y - 9, size: 8.5, font: ctx.font, color: COLOR_TEXT });
    ctx.y -= 13;
  }
}

export async function renderIndustryReportPdf(report: IndustryReport, year: number, month: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Relatório de visitas - ${report.industry.name}`);
  pdf.setAuthor("MK9 Analytics");
  pdf.setCreator("MK9 Analytics");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([A4.w, A4.h]);
  const ctx: PdfCtx = { pdf, page, y: A4.h - MARGIN, pageNum: 1, font, fontB, report };

  drawRunningHeader(ctx);
  drawTitle(ctx, year, month);
  drawKpis(ctx);
  drawCoverageExplanation(ctx);
  drawUfTable(ctx);
  drawStoreTable(ctx);
  drawLegend(ctx);

  const pages = pdf.getPages();
  pages.forEach((pdfPage, idx) => {
    ctx.page = pdfPage;
    drawFooter(ctx, idx + 1, pages.length);
  });
  return pdf.save();
}

export function industryPdfFileName(report: IndustryReport, year: number, month: number): string {
  const name = report.industry.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `RELATORIO_${name}_${MONTHS_PT[month - 1].toUpperCase()}_${year}.pdf`;
}