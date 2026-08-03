import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib/dist/pdf-lib.esm.js";
import type { IndustryReport, StoreLine } from "@/lib/mk9-reports/industry-report.server";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const PAGE = { w: 595.28, h: 841.89 }; // A4 portrait
const MARGIN = 40;
const CONTENT_W = PAGE.w - MARGIN * 2;
const BOTTOM_LIMIT = 50;

const COLOR_BRAND = rgb(0.07, 0.24, 0.52);
const COLOR_TEXT = rgb(0.10, 0.12, 0.16);
const COLOR_MUTED = rgb(0.40, 0.45, 0.52);
const COLOR_LINE = rgb(0.84, 0.87, 0.91);
const COLOR_HEADER_BG = rgb(0.93, 0.96, 1.00);
const COLOR_ROW_ALT = rgb(0.97, 0.98, 1.00);

function sanitizePdfText(s: string): string {
  return (s ?? "").replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
}

function fmtBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function wrapText(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const clean = sanitizePdfText(text).trim();
  if (!clean) return ["-"];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxW) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface PdfCtx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  fontB: PDFFont;
  report: IndustryReport;
  unattendedStores: StoreLine[];
}

function drawHeader(ctx: PdfCtx) {
  ctx.page.drawText("MK9 Analytics", { x: MARGIN, y: PAGE.h - 30, size: 10, font: ctx.fontB, color: COLOR_BRAND });
  ctx.page.drawText("Lojas não atendidas", { x: PAGE.w - MARGIN - ctx.font.widthOfTextAtSize("Lojas não atendidas", 10), y: PAGE.h - 30, size: 10, font: ctx.font, color: COLOR_MUTED });
  ctx.page.drawLine({ start: { x: MARGIN, y: PAGE.h - 40 }, end: { x: PAGE.w - MARGIN, y: PAGE.h - 40 }, thickness: 0.5, color: COLOR_LINE });
}

function drawFooter(ctx: PdfCtx, pageNum: number, total: number) {
  const y = 30;
  ctx.page.drawLine({ start: { x: MARGIN, y: y + 10 }, end: { x: PAGE.w - MARGIN, y: y + 10 }, thickness: 0.5, color: COLOR_LINE });
  const d = new Date();
  const dateStr = `Emitido em ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  ctx.page.drawText(sanitizePdfText(dateStr), { x: MARGIN, y, size: 7, font: ctx.font, color: COLOR_MUTED });
  const pStr = `Página ${pageNum} de ${total}`;
  ctx.page.drawText(pStr, { x: PAGE.w - MARGIN - ctx.font.widthOfTextAtSize(pStr, 7), y, size: 7, font: ctx.font, color: COLOR_MUTED });
}

function newPage(ctx: PdfCtx) {
  ctx.page = ctx.pdf.addPage([PAGE.w, PAGE.h]);
  ctx.y = PAGE.h - 60;
  drawHeader(ctx);
}

function ensureSpace(ctx: PdfCtx, needed: number) {
  if (ctx.y - needed < BOTTOM_LIMIT) newPage(ctx);
}

export async function renderUnattendedPdf(report: IndustryReport, year: number, month: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE.w, PAGE.h]);

  const unattendedStores = report.stores.filter(s => s.expected > 0 && s.actual === 0);
  const ctx: PdfCtx = { pdf, page, y: PAGE.h - 60, font, fontB, report, unattendedStores };

  drawHeader(ctx);

  // Resumo Executivo
  ctx.page.drawText("RESUMO EXECUTIVO", { x: MARGIN, y: ctx.y, size: 12, font: ctx.fontB, color: COLOR_BRAND });
  ctx.y -= 25;

  const summary = [
    ["INDÚSTRIA:", report.industry.name],
    ["Competência:", `${MONTHS_PT[month - 1]} / ${year}`],
    ["Período:", `${fmtBR(report.window.startDate)} a ${fmtBR(report.window.endDate)}`],
    ["Lojas contratadas:", String(report.stores.filter(s => s.expected > 0).length)],
    ["Lojas sem nenhum atendimento:", String(unattendedStores.length)],
    ["Visitas contratadas nessas lojas:", String(unattendedStores.reduce((sum, s) => sum + s.expected, 0))],
  ];

  for (const [label, val] of summary) {
    ctx.page.drawText(label, { x: MARGIN, y: ctx.y, size: 9, font: ctx.fontB, color: COLOR_TEXT });
    ctx.page.drawText(sanitizePdfText(val), { x: MARGIN + 160, y: ctx.y, size: 9, font: ctx.font, color: COLOR_TEXT });
    ctx.y -= 14;
  }

  // UFs afetadas
  ctx.y -= 10;
  ctx.page.drawText("UFs afetadas:", { x: MARGIN, y: ctx.y, size: 9, font: ctx.fontB, color: COLOR_TEXT });
  ctx.y -= 14;
  const ufMap = new Map<string, number>();
  unattendedStores.forEach(s => {
    const uf = s.uf || "—";
    ufMap.set(uf, (ufMap.get(uf) || 0) + 1);
  });
  const ufList = Array.from(ufMap.entries()).sort((a, b) => b[1] - a[1]);
  ufList.forEach(([uf, count]) => {
    ctx.page.drawText(`${uf} — ${count} lojas`, { x: MARGIN + 10, y: ctx.y, size: 8, font: ctx.font, color: COLOR_MUTED });
    ctx.y -= 12;
  });

  ctx.y -= 20;

  if (unattendedStores.length === 0) {
    ctx.page.drawText("Todas as lojas contratadas desta indústria tiveram pelo menos um atendimento no período selecionado.", {
      x: MARGIN,
      y: ctx.y,
      size: 10,
      font: ctx.font,
      color: COLOR_TEXT
    });
  } else {
    // Tabela por agrupamento: UF -> Promotor -> Loja
    // Agrupamos
    const groups = new Map<string, Map<string, StoreLine[]>>();
    unattendedStores.forEach(s => {
      const uf = s.uf || "—";
      const promoter = "Não identificado"; // TODO: Resolver promotor se disponível no report
      if (!groups.has(uf)) groups.set(uf, new Map());
      const ufGroup = groups.get(uf)!;
      if (!ufGroup.has(promoter)) ufGroup.set(promoter, []);
      ufGroup.get(promoter)!.push(s);
    });

    const cols = [
      { label: "Loja / Rede", w: 180 },
      { label: "Cidade / UF", w: 120 },
      { label: "Frequência", w: 80 },
      { label: "Contrat.", w: 50 },
      { label: "Observação", w: 80 },
    ];

    const sortedUfs = Array.from(groups.keys()).sort();
    for (const uf of sortedUfs) {
      ensureSpace(ctx, 40);
      ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 15, width: CONTENT_W, height: 15, color: COLOR_HEADER_BG });
      ctx.page.drawText(`UF: ${uf}`, { x: MARGIN + 5, y: ctx.y - 11, size: 10, font: ctx.fontB, color: COLOR_BRAND });
      ctx.y -= 25;

      const promoters = groups.get(uf)!;
      for (const [promoter, stores] of promoters) {
        ensureSpace(ctx, 30);
        ctx.page.drawText(`Promotor: ${promoter}`, { x: MARGIN + 10, y: ctx.y, size: 9, font: ctx.fontB, color: COLOR_TEXT });
        const subtotalLojas = stores.length;
        const subtotalVisitas = stores.reduce((sum, s) => sum + s.expected, 0);
        const subStr = `(${subtotalLojas} lojas, ${subtotalVisitas} visitas pendentes)`;
        ctx.page.drawText(subStr, { x: MARGIN + 20 + ctx.fontB.widthOfTextAtSize(`Promotor: ${promoter}`, 9), y: ctx.y, size: 8, font: ctx.font, color: COLOR_MUTED });
        ctx.y -= 15;

        // Header da tabela
        ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 12, width: CONTENT_W, height: 12, color: COLOR_LINE });
        let currX = MARGIN + 5;
        cols.forEach(c => {
          ctx.page.drawText(c.label, { x: currX, y: ctx.y - 9, size: 7, font: ctx.fontB, color: COLOR_TEXT });
          currX += c.w;
        });
        ctx.y -= 12;

        stores.sort((a, b) => a.storeName.localeCompare(b.storeName)).forEach((s, idx) => {
          const rowLines = [
            wrapText(ctx.font, `${s.storeName}${s.chain ? ` (${s.chain})` : ""}`, 8, cols[0].w - 10),
            wrapText(ctx.font, `${s.uf || "—"} / —`, 8, cols[1].w - 10), // Cidade não disponível fácil no StoreLine
            wrapText(ctx.font, s.frequencyLabel || "—", 8, cols[2].w - 10),
            [String(s.expected)],
            [""],
          ];
          const rowH = Math.max(...rowLines.map(l => l.length)) * 10 + 4;
          ensureSpace(ctx, rowH);

          if (idx % 2 === 1) ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - rowH, width: CONTENT_W, height: rowH, color: COLOR_ROW_ALT });

          let cellX = MARGIN + 5;
          rowLines.forEach((lines, cIdx) => {
            lines.forEach((line, lIdx) => {
              ctx.page.drawText(line, { x: cellX, y: ctx.y - 10 - lIdx * 10, size: 8, font: ctx.font, color: COLOR_TEXT });
            });
            cellX += cols[cIdx].w;
          });
          ctx.y -= rowH;
          ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: PAGE.w - MARGIN, y: ctx.y }, thickness: 0.2, color: COLOR_LINE });
        });
        ctx.y -= 10;
      }
    }
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    ctx.page = p;
    drawFooter(ctx, i + 1, pages.length);
  });

  return pdf.save();
}

export function unattendedPdfFileName(report: IndustryReport, year: number, month: number): string {
  const name = report.industry.name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const meses = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  return `LOJAS_NAO_ATENDIDAS_${name}_${meses[month - 1]}_${year}.pdf`;
}
