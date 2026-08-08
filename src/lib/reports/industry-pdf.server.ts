// Server-only PDF renderer for the Industry Report.
// A4 landscape, full-width layout, no text truncation (all cells wrap).
// Uses the self-contained pdf-lib ESM bundle to avoid the tslib/CommonJS entrypoint.
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib/dist/pdf-lib.esm.js";
import type {
  ExecutionStatus,
  IndustryReport,
  RouteStatus,
  StoreLine,
} from "@/lib/mk9-reports/industry-report.server";
import {
  EXECUTION_STATUS_LABEL,
  ROUTE_STATUS_LABEL,
} from "@/lib/mk9-reports/industry-report.server";
import { buildIndustryReportFilename } from "@/lib/mk9/normalization";


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

// A4 landscape (pt)
const PAGE = { w: 841.89, h: 595.28 };
const MARGIN = 28; // ~10 mm
const CONTENT_W = PAGE.w - MARGIN * 2;
const FOOTER_H = 26;
const BOTTOM_LIMIT = MARGIN + FOOTER_H;

const COLOR_BRAND = rgb(0.07, 0.24, 0.52);
const COLOR_TEXT = rgb(0.1, 0.12, 0.16);
const COLOR_MUTED = rgb(0.4, 0.45, 0.52);
const COLOR_LINE = rgb(0.84, 0.87, 0.91);
const COLOR_HEADER_BG = rgb(0.93, 0.96, 1.0);
const COLOR_ROW_ALT = rgb(0.97, 0.98, 1.0);
const COLOR_GOOD = rgb(0.08, 0.5, 0.32);
const COLOR_WARN = rgb(0.82, 0.48, 0.08);
const COLOR_BAD = rgb(0.74, 0.18, 0.2);

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

// WinAnsi-safe sanitization (keeps accents, replaces unsupported glyphs).
function sanitizePdfText(s: string): string {
  return s
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/\u00A0/g, " ");
}

/** Wraps text to a max width. Never truncates: long words are hard-split. */
function wrapText(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const clean = sanitizePdfText(text ?? "").trim();
  if (!clean) return ["-"];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  const pushHardSplit = (word: string) => {
    let chunk = "";
    for (const ch of word) {
      if (font.widthOfTextAtSize(chunk + ch, size) > maxW && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    current = chunk;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxW) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    if (font.widthOfTextAtSize(word, size) > maxW) pushHardSplit(word);
    else current = word;
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}

type Column = { label: string; w: number; align?: "left" | "right" };

interface PdfCtx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  fontB: PDFFont;
  report: IndustryReport;
}

function drawRunningHeader(ctx: PdfCtx) {
  ctx.page.drawText("MK9 Analytics", {
    x: MARGIN,
    y: PAGE.h - 20,
    size: 9,
    font: ctx.fontB,
    color: COLOR_BRAND,
  });
  const right = sanitizePdfText(ctx.report.industry.name);
  const w = ctx.font.widthOfTextAtSize(right, 8);
  ctx.page.drawText(right, {
    x: PAGE.w - MARGIN - w,
    y: PAGE.h - 20,
    size: 8,
    font: ctx.font,
    color: COLOR_MUTED,
  });
  ctx.page.drawLine({
    start: { x: MARGIN, y: PAGE.h - 28 },
    end: { x: PAGE.w - MARGIN, y: PAGE.h - 28 },
    thickness: 0.5,
    color: COLOR_LINE,
  });
}

function newPage(ctx: PdfCtx) {
  ctx.page = ctx.pdf.addPage([PAGE.w, PAGE.h]);
  ctx.y = PAGE.h - MARGIN - 12;
  drawRunningHeader(ctx);
}

function ensure(ctx: PdfCtx, needed: number) {
  if (ctx.y - needed < BOTTOM_LIMIT) newPage(ctx);
}

function drawFooter(ctx: PdfCtx, pageNumber: number, total: number) {
  const y = MARGIN - 4;
  ctx.page.drawLine({
    start: { x: MARGIN, y: y + 12 },
    end: { x: PAGE.w - MARGIN, y: y + 12 },
    thickness: 0.5,
    color: COLOR_LINE,
  });
  const d = new Date(ctx.report.generatedAt);
  const left = sanitizePdfText(
    `Emitido em ${d.toLocaleDateString("pt-BR")} as ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
  );
  ctx.page.drawText(left, { x: MARGIN, y, size: 7, font: ctx.font, color: COLOR_MUTED });
  const right = `Página ${pageNumber} de ${total}`;
  const w = ctx.font.widthOfTextAtSize(right, 7);
  ctx.page.drawText(right, {
    x: PAGE.w - MARGIN - w,
    y,
    size: 7,
    font: ctx.font,
    color: COLOR_MUTED,
  });
}

function drawTitle(ctx: PdfCtx, year: number, month: number) {
  const { report } = ctx;
  ctx.page.drawText("Relatório de visitas", {
    x: MARGIN,
    y: ctx.y - 20,
    size: 17,
    font: ctx.fontB,
    color: COLOR_BRAND,
  });
  ctx.y -= 30;
  ctx.page.drawText(sanitizePdfText(report.industry.name), {
    x: MARGIN,
    y: ctx.y - 14,
    size: 12,
    font: ctx.fontB,
    color: COLOR_TEXT,
  });
  ctx.y -= 22;
  const filters = [
    report.filters.uf ? `UF ${report.filters.uf}` : null,
    report.filters.sourceImportId ? "Checklist filtrado" : null,
  ]
    .filter(Boolean)
    .join(" - ");
  const meta = `Competência: ${MONTHS_PT[month - 1]} / ${year}  ·  Período real: ${fmtBR(report.window.startDate)} a ${fmtBR(report.window.endDate)}  ·  ${report.window.totalDays} dias`;
  ctx.page.drawText(sanitizePdfText(meta), {
    x: MARGIN,
    y: ctx.y - 10,
    size: 9,
    font: ctx.font,
    color: COLOR_MUTED,
  });
  ctx.y -= 15;
  if (filters) {
    ctx.page.drawText(sanitizePdfText(`Filtros: ${filters}`), {
      x: MARGIN,
      y: ctx.y - 10,
      size: 9,
      font: ctx.font,
      color: COLOR_MUTED,
    });
    ctx.y -= 14;
  }
}

function drawPromoterStats(ctx: PdfCtx) {
  const stats = ctx.report.totals.promoterStats;
  if (!stats) return;

  ensure(ctx, 60);
  ctx.page.drawText("Resumo do Promotor", {
    x: MARGIN,
    y: ctx.y - 15,
    size: 12,
    font: ctx.fontB,
    color: COLOR_BRAND,
  });
  ctx.y -= 25;

  const items = [
    ["Promotor", ctx.report.totals.promoterName || "—"],
    ...(ctx.report.totals.promoterEmployeeNumber
      ? [["Matrícula", ctx.report.totals.promoterEmployeeNumber]]
      : []),
    ["Total de Visitas", String(stats.totalVisits)],
    ["Lojas Únicas", String(stats.uniqueStores)],
  ];

  let currentX = MARGIN;
  items.forEach(([label, val]) => {
    const labelText = label + ": ";
    const lW = ctx.fontB.widthOfTextAtSize(labelText, 9);
    const vW = ctx.font.widthOfTextAtSize(val, 9);

    if (currentX + lW + vW + 20 > PAGE.w - MARGIN) {
      ctx.y -= 15;
      currentX = MARGIN;
    }

    ctx.page.drawText(labelText, {
      x: currentX,
      y: ctx.y,
      size: 9,
      font: ctx.fontB,
      color: COLOR_TEXT,
    });
    ctx.page.drawText(sanitizePdfText(val), {
      x: currentX + lW,
      y: ctx.y,
      size: 9,
      font: ctx.font,
      color: COLOR_TEXT,
    });
    currentX += lW + vW + 30;
  });

  ctx.y -= 15;
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const wdStr = weekdays.map((wd, i) => `${wd}: ${stats.byWeekday[i]}`).join("  |  ");
  ctx.page.drawText(sanitizePdfText(wdStr), {
    x: MARGIN,
    y: ctx.y,
    size: 8,
    font: ctx.font,
    color: COLOR_MUTED,
  });
  ctx.y -= 20;
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
    [
      "Cobertura",
      pct(m.coberturaPct),
      m.coberturaPct >= 90 ? "good" : m.coberturaPct >= 70 ? "warn" : "bad",
    ],
    [
      "Cob. operacional",
      pct(t.operationalCoveragePct),
      t.operationalCoveragePct >= 90 ? "good" : t.operationalCoveragePct >= 70 ? "warn" : "bad",
    ],
  ] as const;
  const cols = 8;
  const gap = 7;
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cardH = 44;
  ensure(ctx, cardH + 12);
  const startY = ctx.y;
  cards.forEach(([label, value, tone], i) => {
    const x = MARGIN + i * (cardW + gap);
    const y = startY - cardH;
    const color =
      tone === "good"
        ? COLOR_GOOD
        : tone === "bad"
          ? COLOR_BAD
          : tone === "warn"
            ? COLOR_WARN
            : COLOR_BRAND;
    ctx.page.drawRectangle({
      x,
      y,
      width: cardW,
      height: cardH,
      color: rgb(1, 1, 1),
      borderColor: COLOR_LINE,
      borderWidth: 0.7,
    });
    ctx.page.drawRectangle({ x, y: y + cardH - 3, width: cardW, height: 3, color });
    const labelLines = wrapText(ctx.font, label, 7, cardW - 10).slice(0, 2);
    labelLines.forEach((ln, li) => {
      ctx.page.drawText(ln, {
        x: x + 6,
        y: y + cardH - 15 - li * 8,
        size: 7,
        font: ctx.font,
        color: COLOR_MUTED,
      });
    });
    ctx.page.drawText(value, { x: x + 6, y: y + 8, size: 14, font: ctx.fontB, color: COLOR_TEXT });
  });
  ctx.y = startY - cardH - 12;
}

function drawCoverageExplanation(ctx: PdfCtx) {
  ensure(ctx, 54);
  ctx.page.drawText("Critério de cálculo", {
    x: MARGIN,
    y: ctx.y - 11,
    size: 10,
    font: ctx.fontB,
    color: COLOR_TEXT,
  });
  ctx.y -= 17;
  const lines = [
    "Contratadas = soma da coluna VISITA MENSAL do checklist por loja.",
    "Realizadas = TODAS as visitas confirmadas no checklist (nunca reduzido, mesmo acima do contrato).",
    "Pendentes = max(0, contratadas - realizadas) por loja. Extras = max(0, realizadas - contratadas) por loja.",
    "Cobertura = realizadas / contratadas, limitada a 100 %. Roteiro é auditoria separada.",
  ];
  for (const line of lines) {
    ctx.page.drawText(sanitizePdfText(line), {
      x: MARGIN,
      y: ctx.y - 9,
      size: 8,
      font: ctx.font,
      color: COLOR_MUTED,
    });
    ctx.y -= 11;
  }
  ctx.y -= 6;
}

function drawTableHeader(ctx: PdfCtx, cols: Column[]) {
  const size = 8;
  const lineH = 9.5;
  const wrapped = cols.map((c) => wrapText(ctx.fontB, c.label, size, c.w - 8));
  const maxLines = Math.max(...wrapped.map((w) => w.length));
  const h = maxLines * lineH + 8;
  const top = ctx.y;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: top - h,
    width: CONTENT_W,
    height: h,
    color: COLOR_HEADER_BG,
  });
  let x = MARGIN + 4;
  wrapped.forEach((lines, i) => {
    lines.forEach((ln, li) => {
      ctx.page.drawText(ln, {
        x,
        y: top - 12 - li * lineH,
        size,
        font: ctx.fontB,
        color: COLOR_BRAND,
      });
    });
    x += cols[i].w;
  });
  ctx.y = top - h;
}

function drawUfTable(ctx: PdfCtx) {
  if (ctx.report.ufs.length === 0) return;
  ensure(ctx, 60);
  ctx.page.drawText("Resumo por UF", {
    x: MARGIN,
    y: ctx.y - 11,
    size: 11,
    font: ctx.fontB,
    color: COLOR_TEXT,
  });
  ctx.y -= 20;
  const widths = [0.08, 0.1, 0.12, 0.12, 0.12, 0.12, 0.34];
  const labels = ["UF", "Lojas", "Contratadas", "Realizadas", "Pendentes", "Extras", "Cobertura"];
  const cols: Column[] = labels.map((label, i) => ({ label, w: CONTENT_W * widths[i] }));
  drawTableHeader(ctx, cols);
  ctx.report.ufs.forEach((u, i) => {
    const rowH = 15;
    if (ctx.y - rowH < BOTTOM_LIMIT) {
      newPage(ctx);
      drawTableHeader(ctx, cols);
    }
    const y = ctx.y - 11;
    if (i % 2 === 1)
      ctx.page.drawRectangle({
        x: MARGIN,
        y: ctx.y - rowH,
        width: CONTENT_W,
        height: rowH,
        color: COLOR_ROW_ALT,
      });
    const vals = [
      u.uf,
      String(u.stores),
      String(u.expected),
      String(u.actual),
      String(u.pending),
      String(u.extra),
      pct(u.coveragePct),
    ];
    let x = MARGIN + 4;
    vals.forEach((v, idx) => {
      ctx.page.drawText(sanitizePdfText(v), { x, y, size: 8.5, font: ctx.font, color: COLOR_TEXT });
      x += cols[idx].w;
    });
    ctx.y -= rowH;
  });
  ctx.y -= 14;
}

function dateList(store: StoreLine): string {
  if (store.actualDates.length === 0) return "-";
  return store.actualDates.map(fmtBR).join(", ");
}

// Fase 1B.3: quando houve troca de vigência dentro do período, o PDF mostra a
// composição real (ex.: "1x/sem até 15/07 · 2x/sem desde 16/07") em vez de um
// único valor que não explicaria o contratado.
function frequencyLabel(s: StoreLine): string {
  if (s.frequencyLabel) return s.frequencyLabel;
  if (s.monthlyFrequency != null) return `${s.monthlyFrequency}x/mês`;
  if (s.weeklyFrequency != null) return `${s.weeklyFrequency}x/sem`;
  return "-";
}

function drawStoreTable(ctx: PdfCtx) {
  const pcts = [0.27, 0.04, 0.07, 0.06, 0.06, 0.06, 0.05, 0.06, 0.08, 0.09, 0.16];
  const labels = [
    "Loja",
    "UF",
    "Frequência",
    "Contrat.",
    "Realiz.",
    "Pend.",
    "Extras",
    "Cobert.",
    "Execução",
    "Roteiro",
    "Datas realizadas",
  ];
  const cols: Column[] = labels.map((label, i) => ({ label, w: CONTENT_W * pcts[i] }));

  // Título + cabeçalho nunca ficam órfãos: exigimos espaço para pelo menos 2 linhas.
  ensure(ctx, 90);
  ctx.page.drawText("Resultado por loja", {
    x: MARGIN,
    y: ctx.y - 11,
    size: 11,
    font: ctx.fontB,
    color: COLOR_TEXT,
  });
  ctx.y -= 20;
  drawTableHeader(ctx, cols);

  const size = 8;
  const lineH = 9.5;

  ctx.report.stores.forEach((s, i) => {
    const name =
      s.chain && !s.storeName.toUpperCase().startsWith(s.chain.toUpperCase())
        ? `${s.chain} - ${s.storeName}`
        : s.storeName;
    const cells: string[] = [
      name,
      s.uf ?? "-",
      frequencyLabel(s),
      String(s.expected),
      String(s.actual),
      String(s.pending),
      String(s.extra),
      pct(s.coveragePct),
      EXECUTION_STATUS_LABEL[s.executionStatus],
      ROUTE_STATUS_LABEL[s.routeStatus],
      dateList(s),
    ];
    const wrapped = cells.map((c, idx) =>
      wrapText(idx === 8 || idx === 9 ? ctx.fontB : ctx.font, c, size, cols[idx].w - 8),
    );
    const maxLines = Math.max(...wrapped.map((w) => w.length));
    const rowH = maxLines * lineH + 6;

    // Nunca quebrar uma linha entre páginas.
    if (ctx.y - rowH < BOTTOM_LIMIT) {
      newPage(ctx);
      drawTableHeader(ctx, cols);
    }

    const top = ctx.y;
    if (i % 2 === 1)
      ctx.page.drawRectangle({
        x: MARGIN,
        y: top - rowH,
        width: CONTENT_W,
        height: rowH,
        color: COLOR_ROW_ALT,
      });
    let x = MARGIN + 4;
    wrapped.forEach((lines, idx) => {
      const color =
        idx === 8
          ? executionColor(s.executionStatus)
          : idx === 9
            ? routeColor(s.routeStatus)
            : COLOR_TEXT;
      const font = idx === 8 || idx === 9 ? ctx.fontB : ctx.font;
      lines.forEach((ln, li) => {
        ctx.page.drawText(ln, { x, y: top - 11 - li * lineH, size, font, color });
      });
      x += cols[idx].w;
    });
    ctx.page.drawLine({
      start: { x: MARGIN, y: top - rowH },
      end: { x: PAGE.w - MARGIN, y: top - rowH },
      thickness: 0.3,
      color: COLOR_LINE,
    });
    ctx.y = top - rowH;
  });
}

function drawLegend(ctx: PdfCtx) {
  const executionStatuses: ExecutionStatus[] = ["INTEGRAL", "PARCIAL", "NAO_ATENDIDA"];
  const routeStatuses: RouteStatus[] = ["DENTRO_ROTEIRO", "FORA_ROTEIRO"];
  // Legenda em linha única para não criar página isolada.
  const needed = 30;
  if (ctx.y - needed < BOTTOM_LIMIT) newPage(ctx);
  ctx.y -= 10;
  ctx.page.drawText("Legenda", {
    x: MARGIN,
    y: ctx.y - 10,
    size: 9.5,
    font: ctx.fontB,
    color: COLOR_TEXT,
  });
  ctx.y -= 16;
  let x = MARGIN;
  const items = [
    ...executionStatuses.map((st) => ({
      label: `Execução: ${EXECUTION_STATUS_LABEL[st]}`,
      color: executionColor(st),
    })),
    ...routeStatuses.map((st) => ({
      label: `Roteiro: ${ROUTE_STATUS_LABEL[st]}`,
      color: routeColor(st),
    })),
  ];
  for (const item of items) {
    const text = sanitizePdfText(item.label);
    const w = ctx.font.widthOfTextAtSize(text, 8) + 24;
    if (x + w > PAGE.w - MARGIN) {
      ctx.y -= 12;
      x = MARGIN;
      if (ctx.y - 12 < BOTTOM_LIMIT) newPage(ctx);
    }
    ctx.page.drawRectangle({ x, y: ctx.y - 8, width: 8, height: 8, color: item.color });
    ctx.page.drawText(text, {
      x: x + 12,
      y: ctx.y - 7,
      size: 8,
      font: ctx.font,
      color: COLOR_TEXT,
    });
    x += w;
  }
  ctx.y -= 14;
}

export async function renderIndustryReportPdf(
  report: IndustryReport,
  year: number,
  month: number,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Relatório de visitas - ${report.industry.name}`);
  pdf.setAuthor("MK9 Analytics");
  pdf.setCreator("MK9 Analytics");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE.w, PAGE.h]);
  const ctx: PdfCtx = { pdf, page, y: PAGE.h - MARGIN - 12, font, fontB, report };

  drawRunningHeader(ctx);
  drawTitle(ctx, year, month);
  drawPromoterStats(ctx);
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
  return buildIndustryReportFilename({
    industryName: report.industry.name,
    month,
    year,
    reportType: "FULL",
  });
}

