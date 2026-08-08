// Parser puro da planilha MK9. Recebe um ArrayBuffer e devolve um IR normalizado.
// Não conhece banco de dados. Portável 1:1 para Node + Prisma.
import * as XLSX from "xlsx";
import {
  isDayMarked,
  normalizeExternalId,
  normalizeName,
  normalizeStoreName,
  normalizePhone,
  normalizeText,
  normalizeUF,
  parseNumber,
  parseWeekdayHeader,
} from "./normalization";
import type { Weekday } from "./types";

export interface ParsedIndustry {
  name: string;
  nameNormalized: string;
  monthlyContractedFrequency?: number | null;
  monthlyEstimatedFrequency?: number | null;
  weeksCount?: number | null;
  sourceSheet: string;
  excelRow: number;
}
export interface ParsedStore {
  chain?: string | null;
  name: string;
  nameNormalized: string;
  uf?: string | null;
  sourceSheet: string;
  excelRow: number;
}
export interface ParsedPromoter {
  externalId?: string | null;
  name: string;
  nameNormalized: string;
  city?: string | null;
  contact?: string | null;
  contactNormalized?: string | null;
  notes?: string | null;
  sourceSheet: string;
  excelRow: number;
}
export interface ParsedRouteLine {
  industryName: string;
  industryNormalized: string;
  storeName: string;
  storeNormalized: string;
  uf?: string | null;
  promoterName: string;
  promoterNormalized: string;
  weekdays: Weekday[];
  sourceSheet: string;
  excelRow: number;
}

export interface ParsedWorkbook {
  filename: string;
  industries: ParsedIndustry[];
  stores: ParsedStore[];
  promoters: ParsedPromoter[];
  routes: ParsedRouteLine[];
  sheetsAnalyzed: string[];
  warnings: string[];
}

const ROUTE_SHEET_PREFIX = "roteiro";
const CONSULTA_PREFIX = "consulta";

export function parseWorkbook(buffer: ArrayBuffer, filename: string): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: "array" });
  const out: ParsedWorkbook = {
    filename,
    industries: [],
    stores: [],
    promoters: [],
    routes: [],
    sheetsAnalyzed: [],
    warnings: [],
  };

  for (const sheetName of wb.SheetNames) {
    const norm = normalizeText(sheetName);
    if (norm.startsWith(CONSULTA_PREFIX)) continue;
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: true,
    });
    if (!rows.length) continue;
    out.sheetsAnalyzed.push(sheetName);

    if (norm === "industria" || norm === "industrias") {
      parseIndustriesSheet(rows, sheetName, out);
    } else if (norm.startsWith("frequencia")) {
      parseFrequencySheet(rows, sheetName, out);
    } else if (norm === "lojas" || norm === "loja") {
      parseStoresSheet(rows, sheetName, out);
    } else if (norm === "promotores" || norm === "promotor") {
      parsePromotersSheet(rows, sheetName, out);
    } else if (norm.startsWith(ROUTE_SHEET_PREFIX)) {
      parseRouteSheet(rows, sheetName, out);
    }
  }

  return out;
}

// ----- helpers -----
function findKey(row: Record<string, unknown>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const key of keys) {
    const nk = normalizeText(key);
    for (const cand of candidates) {
      if (nk === cand || nk.startsWith(cand)) return key;
    }
  }
  return null;
}
function readCell(row: Record<string, unknown>, candidates: string[]): unknown {
  const key = findKey(row, candidates);
  return key ? row[key] : null;
}

function parseIndustriesSheet(rows: Record<string, unknown>[], sheet: string, out: ParsedWorkbook) {
  rows.forEach((row, i) => {
    const raw = readCell(row, ["industria", "indústria"]);
    const name = raw ? String(raw).trim() : "";
    if (!name) return;
    out.industries.push({
      name,
      nameNormalized: normalizeName(name),
      sourceSheet: sheet,
      excelRow: i + 2,
    });
  });
}

function parseFrequencySheet(rows: Record<string, unknown>[], sheet: string, out: ParsedWorkbook) {
  rows.forEach((row, i) => {
    const raw = readCell(row, ["industria", "indústria"]);
    const name = raw ? String(raw).trim() : "";
    if (!name) return;
    const contracted = parseNumber(
      readCell(row, ["freq mensal contratada", "freq. mensal contratada", "contratada"]),
    );
    const estimated = parseNumber(
      readCell(row, ["freq mensal realizada", "freq. mensal realizada", "realizada"]),
    );
    const weeks = parseNumber(readCell(row, ["semanas por mes", "semanas por mês", "semanas"]));
    // upsert por nome normalizado
    const norm = normalizeName(name);
    const existing = out.industries.find((it) => it.nameNormalized === norm);
    if (existing) {
      existing.monthlyContractedFrequency = contracted;
      existing.monthlyEstimatedFrequency = estimated;
      existing.weeksCount = weeks ?? existing.weeksCount ?? null;
    } else {
      out.industries.push({
        name,
        nameNormalized: norm,
        monthlyContractedFrequency: contracted,
        monthlyEstimatedFrequency: estimated,
        weeksCount: weeks,
        sourceSheet: sheet,
        excelRow: i + 2,
      });
    }
  });
}

function parseStoresSheet(rows: Record<string, unknown>[], sheet: string, out: ParsedWorkbook) {
  rows.forEach((row, i) => {
    const nameRaw = readCell(row, ["loja"]);
    const name = nameRaw ? String(nameRaw).trim() : "";
    if (!name) return;
    const chain = readCell(row, ["rede"]);
    const uf = readCell(row, ["uf", "estado"]);
    out.stores.push({
      chain: chain ? String(chain).trim() : null,
      name,
      nameNormalized: normalizeStoreName(name),
      uf: normalizeUF(uf as string),
      sourceSheet: sheet,
      excelRow: i + 2,
    });
  });
}

function parsePromotersSheet(rows: Record<string, unknown>[], sheet: string, out: ParsedWorkbook) {
  rows.forEach((row, i) => {
    const nameRaw = readCell(row, ["nome", "promotor"]);
    const name = nameRaw ? String(nameRaw).trim() : "";
    if (!name) return;
    const externalId = normalizeExternalId(readCell(row, ["id"]) as string);
    const city = readCell(row, ["cidade atendimento", "cidade"]);
    const contact = readCell(row, ["contato", "telefone"]);
    const notes = readCell(row, ["observacao", "observação", "obs"]);
    const contactStr = contact ? String(contact).trim() : null;
    out.promoters.push({
      externalId,
      name,
      nameNormalized: normalizeName(name),
      city: city ? String(city).trim() : null,
      contact: contactStr,
      contactNormalized: normalizePhone(contactStr),
      notes: notes ? String(notes).trim() : null,
      sourceSheet: sheet,
      excelRow: i + 2,
    });
  });
}

function parseRouteSheet(rows: Record<string, unknown>[], sheet: string, out: ParsedWorkbook) {
  // Descobrir dinamicamente quais colunas do row são dias da semana.
  if (!rows.length) return;
  const sampleKeys = Object.keys(rows[0] as Record<string, unknown>);
  const dayColumns: Array<{ key: string; weekday: Weekday }> = [];
  for (const key of sampleKeys) {
    const wd = parseWeekdayHeader(key);
    if (wd !== null) dayColumns.push({ key, weekday: wd });
  }

  rows.forEach((row, i) => {
    const industry = readCell(row, ["industria", "indústria"]);
    const store = readCell(row, ["loja"]);
    const promoter = readCell(row, ["promotor", "promotores"]);
    const uf = readCell(row, ["uf", "estado"]);
    const industryName = industry ? String(industry).trim() : "";
    const storeName = store ? String(store).trim() : "";
    const promoterName = promoter ? String(promoter).trim() : "";
    if (!industryName && !storeName && !promoterName) return;

    const weekdays: Weekday[] = [];
    for (const col of dayColumns) {
      if (isDayMarked(row[col.key])) weekdays.push(col.weekday);
    }

    out.routes.push({
      industryName,
      industryNormalized: normalizeName(industryName),
      storeName,
      storeNormalized: normalizeStoreName(storeName),
      uf: normalizeUF(uf as string),
      promoterName,
      promoterNormalized: normalizeName(promoterName),
      weekdays,
      sourceSheet: sheet,
      excelRow: i + 2,
    });
  });
}
