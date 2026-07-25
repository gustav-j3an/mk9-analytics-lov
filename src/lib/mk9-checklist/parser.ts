// Parser puro do checklist mensal enviado pelas indústrias.
// Detecta cabeçalho, colunas de dias (1..31) e marcações (✓, x, sim, 1...).
import * as XLSX from "xlsx";
import { isDayMarked, normalizeName, normalizeUF, parseNumber, normalizeText } from "@/lib/mk9/normalization";
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
  }>;
}

function headerMatch(cell: unknown, keywords: string[]): boolean {
  const t = normalizeText(String(cell ?? ""));
  return keywords.some((k) => t === k || t.includes(k));
}

function detectDayColumn(cell: unknown): number | null {
  if (cell === null || cell === undefined || cell === "") return null;
  // Aceita: número 1..31, "01", "1", "22/07", data serial Excel
  if (typeof cell === "number") {
    if (cell >= 1 && cell <= 31 && Number.isInteger(cell)) return cell;
    // Data serial Excel (>= 40000). Converte via XLSX util.
    if (cell > 40000) {
      const d = XLSX.SSF?.parse_date_code?.(cell);
      if (d && d.d) return d.d;
    }
    return null;
  }
  const s = String(cell).trim();
  const m = s.match(/^0?(\d{1,2})(?:[\/\-.]\d{1,2}.*)?$/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 31) return n;
  }
  return null;
}

export function parseChecklistWorkbook(buffer: ArrayBuffer, filename: string): ParsedChecklist {
  const wb = XLSX.read(buffer, { type: "array" });
  const out: ParsedChecklist = {
    filename,
    sheetsAnalyzed: [],
    marks: [],
    warnings: [],
    stores: [],
  };

  const seenStoreKeys = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, blankrows: false });
    if (!rows.length) continue;

    // 1) Localiza a linha de cabeçalho: precisa ter "loja" e ao menos uma coluna de dia (1..31).
    let headerRow = -1;
    let storeCol = -1;
    let ufCol = -1;
    let weeklyCol = -1;
    let monthlyCol = -1;
    const dayCols: Array<{ col: number; day: number }> = [];

    for (let r = 0; r < Math.min(rows.length, 40); r++) {
      const row = rows[r] ?? [];
      const localDayCols: Array<{ col: number; day: number }> = [];
      let localStoreCol = -1;
      let localUfCol = -1;
      let localWeeklyCol = -1;
      let localMonthlyCol = -1;

      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (localStoreCol < 0 && headerMatch(cell, ["loja", "cliente", "pdv"])) localStoreCol = c;
        else if (localUfCol < 0 && headerMatch(cell, ["uf", "estado"])) localUfCol = c;
        else if (localWeeklyCol < 0 && headerMatch(cell, ["freq semanal", "frequencia semanal", "semanal"])) localWeeklyCol = c;
        else if (localMonthlyCol < 0 && headerMatch(cell, ["freq mensal", "frequencia mensal", "mensal"])) localMonthlyCol = c;
        else {
          const day = detectDayColumn(cell);
          if (day) localDayCols.push({ col: c, day });
        }
      }

      if (localStoreCol >= 0 && localDayCols.length >= 3) {
        headerRow = r;
        storeCol = localStoreCol;
        ufCol = localUfCol;
        weeklyCol = localWeeklyCol;
        monthlyCol = localMonthlyCol;
        dayCols.push(...localDayCols);
        break;
      }
    }

    if (headerRow < 0) {
      out.warnings.push(`Aba "${sheetName}" ignorada: cabeçalho não encontrado.`);
      continue;
    }

    out.sheetsAnalyzed.push(sheetName);

    // 2) Percorre linhas de dados
    for (let r = headerRow + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const rawName = row[storeCol];
      if (rawName === null || rawName === undefined || String(rawName).trim() === "") continue;
      const storeName = String(rawName).trim();
      const storeNormalized = normalizeName(storeName);
      if (!storeNormalized) continue;
      // Ignora linhas de rodapé/total
      if (/^(total|totais|geral|subtotal)/i.test(storeName)) continue;

      const uf = ufCol >= 0 ? normalizeUF(row[ufCol]) : null;
      const weekly = weeklyCol >= 0 ? parseNumber(row[weeklyCol]) : null;
      const monthly = monthlyCol >= 0 ? parseNumber(row[monthlyCol]) : null;

      const storeKey = `${storeNormalized}|${uf ?? ""}`;
      if (!seenStoreKeys.has(storeKey)) {
        seenStoreKeys.add(storeKey);
        out.stores.push({
          storeName,
          storeNormalized,
          uf,
          excelRow: r + 1,
          weeklyFrequency: weekly,
          monthlyFrequency: monthly,
        });
      }

      for (const { col, day } of dayCols) {
        if (isDayMarked(row[col])) {
          out.marks.push({
            storeName,
            storeNormalized,
            uf,
            weeklyFrequency: weekly,
            monthlyFrequency: monthly,
            day,
            excelRow: r + 1,
          });
        }
      }
    }
  }

  return out;
}
