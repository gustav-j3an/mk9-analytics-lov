// Parser puro do checklist mensal enviado pelas indústrias.
// Detecta cabeçalho, colunas de DATAS COMPLETAS (dd/mm/yyyy, serial Excel, Date) e marcações (✅, ✓, x, sim, 1...).
// Reconhece a coluna final REALIZADO para conciliar totais.
import * as XLSX from "xlsx";
import {
  isDayMarked,
  normalizeStoreName,
  normalizeUF,
  parseNumber,
  normalizeText,
} from "@/lib/mk9/normalization";
import type { ChecklistMark } from "./types";

export interface ParsedChecklist {
  filename: string;
  sheetsAnalyzed: string[];
  marks: ChecklistMark[];
  warnings: string[];
  stores: Array<{
    storeName: string;
    storeNormalized: string;
    uf: string | null;
    excelRow: number;
    weeklyFrequency: number | null;
    monthlyFrequency: number | null;
    realizado: number | null;
  }>;
  duplicateStores: Array<{
    storeName: string;
    storeNormalized: string;
    uf: string | null;
    excelRow: number;
    firstExcelRow: number;
  }>;
  realizadoSum: number;
  monthlyFrequencySum: number;
  declaredTotal: number | null; // célula "TOTAL VISITAS MÊS REALIZADAS" (quando presente)
  firstDate: string | null; // ISO yyyy-mm-dd
  lastDate: string | null;
  dateColumnCount: number;
}

export interface ChecklistParserDebugEvent {
  step: string;
  message: string;
  data?: Record<string, unknown>;
}

interface ParseChecklistOptions {
  onDebug?: (event: ChecklistParserDebugEvent) => void;
}

function headerMatch(cell: unknown, keywords: string[]): boolean {
  const t = normalizeText(String(cell ?? ""));
  return keywords.some((k) => t === k || t.includes(k));
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function excelSerialToDate(serial: number): Date | null {
  // Excel epoch (com bug 1900). XLSX.SSF.parse_date_code lida com isso.
  const parsed = XLSX.SSF?.parse_date_code?.(serial);
  if (!parsed || !parsed.y) return null;
  return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
}

function toIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

// Detecta coluna de data completa. Aceita Date, serial Excel (>= 30000), "dd/mm/yyyy", "dd/mm/yy", "dd-mm-yyyy".
function detectDateColumn(cell: unknown): string | null {
  if (cell === null || cell === undefined || cell === "") return null;
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return toIsoDate(new Date(Date.UTC(cell.getFullYear(), cell.getMonth(), cell.getDate())));
  }
  if (typeof cell === "number") {
    if (cell >= 30000 && cell < 90000) {
      const d = excelSerialToDate(cell);
      if (d) return toIsoDate(d);
    }
    return null;
  }
  const s = String(cell).trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2999) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }
  
  // MK9 v3.4.0: Telemetria de datas ignoradas
  if (cell !== null && cell !== undefined && String(cell).trim().length > 0) {
    const s = String(cell).trim();
    // Se parece uma data (tem números e separadores) mas não passou no regex/validadores acima
    if (s.match(/\d/) && s.match(/[\/\-.]/)) {
      return "INVALID_DATE_FORMAT";
    }
  }

  return null;
}

export function parseChecklistWorkbook(
  buffer: ArrayBuffer,
  filename: string,
  options: ParseChecklistOptions = {},
): ParsedChecklist {
  const debug = (step: string, message: string, data?: Record<string, unknown>) => {
    options.onDebug?.({ step, message, data });
  };
  debug("parser-open-workbook", "Abrindo workbook do checklist", {
    filename,
    byteLength: buffer.byteLength,
  });
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  debug("parser-workbook-opened", "Workbook aberto", {
    sheets: wb.SheetNames,
    sheetCount: wb.SheetNames.length,
  });

  const out: ParsedChecklist = {
    filename,
    sheetsAnalyzed: [],
    marks: [],
    warnings: [],
    stores: [],
    duplicateStores: [],
    realizadoSum: 0,
    monthlyFrequencySum: 0,
    declaredTotal: null,
    firstDate: null,
    lastDate: null,
    dateColumnCount: 0,
  };

  const seenStoreKeys = new Map<string, number>();
  const allDates: string[] = [];

  for (const sheetName of wb.SheetNames) {
    debug("sheet-found", "Sheet encontrada", { sheet: sheetName });
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: true,
    });
    debug("rows-read", "Quantidade de linhas lidas", { sheet: sheetName, rows: rows.length });
    if (!rows.length) continue;

    // 1) Localiza cabeçalho: precisa ter "loja" + ao menos 3 colunas de data completa.
    let headerRow = -1;
    let storeCol = -1;
    let ufCol = -1;
    let weeklyCol = -1;
    let monthlyCol = -1;
    let realizadoCol = -1;
    const dateCols: Array<{ col: number; iso: string; recovered?: boolean; original?: string }> =
      [];

    for (let r = 0; r < Math.min(rows.length, 40); r++) {
      const row = rows[r] ?? [];
      const localDateCols: Array<{ col: number; iso: string }> = [];
      let localStoreCol = -1;
      let localUfCol = -1;
      let localWeeklyCol = -1;
      let localMonthlyCol = -1;
      let localRealizadoCol = -1;

      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (localStoreCol < 0 && headerMatch(cell, ["loja", "cliente", "pdv"])) {
          localStoreCol = c;
          continue;
        }
        if (localUfCol < 0 && headerMatch(cell, ["uf", "estado"])) {
          localUfCol = c;
          continue;
        }
        if (
          localWeeklyCol < 0 &&
          headerMatch(cell, [
            "visita semanal",
            "visitas semanais",
            "freq semanal",
            "frequencia semanal",
            "frequência semanal",
          ])
        ) {
          localWeeklyCol = c;
          continue;
        }
        if (
          localMonthlyCol < 0 &&
          headerMatch(cell, [
            "visita mensal",
            "visitas mensais",
            "freq mensal",
            "frequencia mensal",
            "frequência mensal",
            "frequencia contratada",
            "frequência contratada",
            "contratada",
            "meta mensal",
          ])
        ) {
          localMonthlyCol = c;
          continue;
        }
        if (
          localRealizadoCol < 0 &&
          headerMatch(cell, [
            "realizado",
            "realizadas",
            "total realizado",
            "executado",
            "executadas",
          ])
        ) {
          localRealizadoCol = c;
          continue;
        }
        const iso = detectDateColumn(cell);
        if (iso === "INVALID_DATE_FORMAT") {
          out.warnings.push(`Coluna ${c + 1} na linha ${r + 1} ignorada: Formato de data não reconhecido ("${cell}").`);
        } else if (iso) {
          localDateCols.push({ col: c, iso });
        }
      }

      // Restringe às datas entre VISITA MENSAL e REALIZADO quando ambos existem.
      let filtered = localDateCols;
      if (localMonthlyCol >= 0) {
        filtered = filtered.filter((d) => d.col > localMonthlyCol);
      }
      if (localRealizadoCol >= 0) {
        filtered = filtered.filter((d) => d.col < localRealizadoCol);
      }

      if (localStoreCol >= 0 && filtered.length >= 3) {
        headerRow = r;
        storeCol = localStoreCol;
        ufCol = localUfCol;
        weeklyCol = localWeeklyCol;
        monthlyCol = localMonthlyCol;
        realizadoCol = localRealizadoCol;
        dateCols.push(...filtered);

        // Recupera cabeçalhos de data malformados (ex: "25/0/2026", "25//2026",
        // "25" só o dia) entre VISITA MENSAL e REALIZADO, inferindo mês/ano
        // a partir dos vizinhos válidos. Não inventa marcação: só devolve a
        // coluna ao parser. Se a célula estiver vazia, ignora.
        const capturedCols = new Set(filtered.map((d) => d.col));
        const startCol = localMonthlyCol >= 0 ? localMonthlyCol + 1 : 0;
        const endCol = localRealizadoCol >= 0 ? localRealizadoCol : row.length;
        for (let c = startCol; c < endCol; c++) {
          if (capturedCols.has(c)) continue;
          const raw = row[c];
          if (raw === null || raw === undefined || String(raw).trim() === "") continue;
          const rawStr = String(raw).trim();
          const dayMatch = rawStr.match(/(\d{1,2})/);
          if (!dayMatch) continue;
          const day = Number(dayMatch[1]);
          if (!(day >= 1 && day <= 31)) continue;
          let ref: { col: number; iso: string } | null = null;
          for (let i = filtered.length - 1; i >= 0; i--) {
            if (filtered[i].col < c) {
              ref = filtered[i];
              break;
            }
          }
          if (!ref) {
            for (const d of filtered) {
              if (d.col > c) {
                ref = d;
                break;
              }
            }
          }
          if (!ref) continue;
          const [yy, mm] = ref.iso.split("-");
          const iso = `${yy}-${mm}-${pad2(day)}`;
          dateCols.push({ col: c, iso, recovered: true, original: rawStr });
          out.warnings.push(
            `Cabeçalho de data corrigido automaticamente na coluna ${c + 1} (linha ${r + 1}): "${rawStr}" interpretado como ${iso.split("-").reverse().join("/")}.`,
          );
        }
        dateCols.sort((a, b) => a.col - b.col);

        debug("header-identified", "Cabeçalho identificado", {
          sheet: sheetName,
          excelRow: r + 1,
          storeColumn: localStoreCol + 1,
          ufColumn: localUfCol >= 0 ? localUfCol + 1 : null,
          weeklyColumn: localWeeklyCol >= 0 ? localWeeklyCol + 1 : null,
          monthlyColumn: localMonthlyCol >= 0 ? localMonthlyCol + 1 : null,
          realizadoColumn: localRealizadoCol >= 0 ? localRealizadoCol + 1 : null,
          dateColumnCount: dateCols.length,
          recoveredColumns: dateCols.filter((d) => d.recovered).length,
          firstDate: dateCols[0]?.iso ?? null,
          lastDate: dateCols[dateCols.length - 1]?.iso ?? null,
        });
        break;
      }
    }

    if (headerRow < 0) {
      debug("header-not-found", "Cabeçalho não identificado na sheet", {
        sheet: sheetName,
        checkedRows: Math.min(rows.length, 40),
      });
      out.warnings.push(`Aba "${sheetName}" ignorada: cabeçalho não encontrado.`);
      continue;
    }

    out.sheetsAnalyzed.push(sheetName);
    out.dateColumnCount = Math.max(out.dateColumnCount, dateCols.length);
    for (const dc of dateCols) allDates.push(dc.iso);

    // Total declarado impresso na planilha: procura "TOTAL VISITAS ... REALIZ..." nas linhas acima
    // do cabeçalho e pega o número na mesma célula, à direita ou abaixo. Só define uma vez.
    if (out.declaredTotal === null) {
      for (let rr = 0; rr < headerRow; rr++) {
        const row = rows[rr] ?? [];
        for (let cc = 0; cc < row.length; cc++) {
          const t = normalizeText(String(row[cc] ?? ""));
          if (!t) continue;
          if (t.includes("total") && (t.includes("realiz") || t.includes("visitas"))) {
            const numHere = parseNumber(row[cc]);
            if (numHere !== null && numHere > 0 && Number.isFinite(numHere)) {
              out.declaredTotal = numHere;
              break;
            }
            const right = parseNumber(row[cc + 1]);
            if (right !== null && Number.isFinite(right)) {
              out.declaredTotal = right;
              break;
            }
            const below = parseNumber((rows[rr + 1] ?? [])[cc]);
            if (below !== null && Number.isFinite(below)) {
              out.declaredTotal = below;
              break;
            }
          }
        }
        if (out.declaredTotal !== null) break;
      }
    }

    // 2) Percorre linhas de dados
    let sheetRealizadoSum = 0;
    let sheetMarks = 0;
    for (let r = headerRow + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const rawName = row[storeCol];
      if (rawName === null || rawName === undefined || String(rawName).trim() === "") continue;
      const storeName = String(rawName).trim();
      const storeNormalized = normalizeStoreName(storeName);
      if (!storeNormalized) continue;

      // REVISÃO MK9 (Protocolo CICOPAL): Uma linha NÃO deve ser descartada simplesmente porque
      // CIDADE ou UF estão vazias, desde que possua o campo LOJA válido.
      // O parser atual estava exigindo UF, o que descartava lojas válidas em arquivos da CICOPAL.
      
      // Permitimos que a linha prossiga sem UF; a reconciliação tentará resolver pela base oficial.
      const ufValue = ufCol >= 0 ? normalizeUF(row[ufCol]) : null;



      // MK9 REFINEMENT (v3.4.0): A line is only a summary/footer if it matches keywords
      // AND has no visit marks. This prevents discarding stores like "TOTAL LUBRIFICANTES".
      const isSummaryName = /^(total|totais|geral|subtotal)/i.test(storeName);
      let hasMarks = false;
      for (const { col } of dateCols) {
        if (isDayMarked(row[col])) {
          hasMarks = true;
          break;
        }
      }

      if (isSummaryName && !hasMarks) {
        debug("line-ignored", "Linha de resumo ignorada", { storeName, excelRow: r + 1 });
        continue;
      }

      const uf = ufValue;
      const weekly = weeklyCol >= 0 ? parseNumber(row[weeklyCol]) : null;
      const monthly = monthlyCol >= 0 ? parseNumber(row[monthlyCol]) : null;
      const realizado = realizadoCol >= 0 ? parseNumber(row[realizadoCol]) : null;
      if (realizado !== null && Number.isFinite(realizado)) sheetRealizadoSum += realizado;
      if (monthly !== null && Number.isFinite(monthly)) out.monthlyFrequencySum += monthly;

      const storeKey = `${storeNormalized}|${uf ?? ""}`;
      const firstExcelRow = seenStoreKeys.get(storeKey);
      if (firstExcelRow === undefined) {
        seenStoreKeys.set(storeKey, r + 1);
        out.stores.push({
          storeName,
          storeNormalized,
          uf,
          excelRow: r + 1,
          weeklyFrequency: weekly,
          monthlyFrequency: monthly,
          realizado,
        });
      } else {
        out.duplicateStores.push({
          storeName,
          storeNormalized,
          uf,
          excelRow: r + 1,
          firstExcelRow,
        });
      }

      for (const { col, iso } of dateCols) {
        if (isDayMarked(row[col])) {
          const day = Number(iso.slice(8, 10));
          out.marks.push({
            storeName,
            storeNormalized,
            uf,
            weeklyFrequency: weekly,
            monthlyFrequency: monthly,
            day,
            scheduledDate: iso,
            excelRow: r + 1,
          });
          sheetMarks++;
        }
      }
    }
    out.realizadoSum += sheetRealizadoSum;
    debug("sheet-summary", "Resumo da aba", {
      sheet: sheetName,
      marks: sheetMarks,
      realizadoSum: sheetRealizadoSum,
    });
  }

  if (allDates.length) {
    allDates.sort();
    out.firstDate = allDates[0];
    out.lastDate = allDates[allDates.length - 1];
  }

  // Validação checksum: REALIZADO da planilha (soma AK) vs marcações lidas (F-AJ)
  // MK9 CORE RULE: A fonte de verdade das visitas realizadas são as MARCAÇÕES NAS DATAS.
  // A coluna REALIZADO serve apenas como conferência e sinalização de alertas.
  if (out.realizadoSum > 0 && out.marks.length !== out.realizadoSum) {
    out.warnings.push(
      `Alerta de divergência (REALIZED_SUMMARY_MISMATCH): a coluna REALIZADO informa ${out.realizadoSum} visitas, mas foram identificadas ${out.marks.length} marcações reais nas datas. O sistema utilizará as ${out.marks.length} marcações confirmadas.`,
    );
  } else if (out.realizadoSum === 0 && out.marks.length > 0) {
    // Caso a coluna REALIZADO esteja vazia mas existam marcações
    out.warnings.push(
      `Coluna REALIZADO zerada ou ausente, mas foram identificadas ${out.marks.length} marcações reais nas datas.`,
    );
  }


  debug("parser-complete", "Parser de checklist finalizado", {
    sheetsAnalyzed: out.sheetsAnalyzed,
    stores: out.stores.length,
    visits: out.marks.length,
    dateColumnCount: out.dateColumnCount,
    firstDate: out.firstDate,
    lastDate: out.lastDate,
    realizadoSum: out.realizadoSum,
    monthlyFrequencySum: out.monthlyFrequencySum,
    duplicateStores: out.duplicateStores.length,
    warnings: out.warnings.length,
  });

  return out;
}
