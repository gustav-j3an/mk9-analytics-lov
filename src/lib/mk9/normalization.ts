// Utilidades puras de normalização. Sem dependências externas.
// Portáveis para qualquer runtime (browser, Node, Cloudflare Worker).

export function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeText(input: string | null | undefined): string {
  if (!input) return "";
  return stripDiacritics(String(input))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeName(input: string | null | undefined): string {
  return normalizeText(input);
}

// Normalização específica para nomes de LOJA.
// Objetivo: unificar variantes tipográficas do mesmo estabelecimento
// (hífens, pontuação, espaços duplicados, acentos, caixa).
// Ex.: "TATICO - SAMAMBAIA NORTE" == "TATICO SAMAMBAIA - NORTE" == "tatico  samambaia—norte".
export function normalizeStoreName(input: string | null | undefined): string {
  if (!input) return "";
  return stripDiacritics(String(input))
    .toLowerCase()
    .replace(/[\-–—/,.()·|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Palavras genéricas descartadas ao gerar a chave de tokens (não distinguem lojas).
const STORE_STOPWORDS = new Set([
  "av", "avenida", "r", "rua", "al", "alameda", "rod", "rodovia",
  "de", "da", "do", "das", "dos", "e",
  "loja", "unidade", "un", "n", "no", "num", "nº",
]);

// Forma "compacta": normalizada e SEM espaços. Serve para casar
// "T-63" vs "T63" (mesmo estabelecimento, hífen opcional entre letra/dígito).
export function storeCompactKey(normalized: string): string {
  return normalized.replace(/\s+/g, "");
}

// Chave por conjunto ordenado de tokens (sem stopwords). Serve para casar
// mesmas palavras em ordem diferente:
// "ATACADÃO AV. RIO VERDE APARECIDA DE GOIANIA" ==
// "ATACADÃO - APARECIDA DE GOIANIA AV. RIO VERDE".
export function storeTokenSetKey(normalized: string): string {
  const tokens = normalized.split(/\s+/).filter((t) => t && !STORE_STOPWORDS.has(t));
  const unique = Array.from(new Set(tokens)).sort();
  return unique.join(" ");
}

export function normalizeUF(input: string | null | undefined): string | null {
  if (!input) return null;
  const uf = String(input).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(uf) ? uf : null;
}

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D+/g, "");
  return digits.length ? digits : null;
}

export function normalizeExternalId(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const value = String(input).trim();
  return value.length ? value : null;
}

// Reconhece marcações de dia (✓, ✔, ✅, X, x, SIM, 1, TRUE).
const TRUTHY_MARKS = new Set([
  "✓", "✔", "✅", "☑", "☒", "x", "sim", "s", "1", "true", "verdadeiro", "y", "yes", "ok", "feito",
]);
export function isDayMarked(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "number") return value === 1;
  if (value === null || value === undefined) return false;
  const raw = String(value).replace(/\uFE0F/g, "").trim();
  if (!raw) return false;
  if (TRUTHY_MARKS.has(raw)) return true;
  const norm = normalizeText(raw);
  return TRUTHY_MARKS.has(norm);
}

// Mapa: cabeçalho -> weekday (0=dom ... 6=sab, padrão JS).
const WEEKDAY_MAP: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  dom: 0, domingo: 0,
  seg: 1, segunda: 1, "segunda feira": 1,
  ter: 2, terca: 2, "terca feira": 2,
  qua: 3, quarta: 3, "quarta feira": 3,
  qui: 4, quinta: 4, "quinta feira": 4,
  sex: 5, sexta: 5, "sexta feira": 5,
  sab: 6, sabado: 6,
};
export function parseWeekdayHeader(header: string | null | undefined): 0 | 1 | 2 | 3 | 4 | 5 | 6 | null {
  if (!header) return null;
  const key = normalizeText(header).replace(/[-.]/g, " ").replace(/\s+/g, " ").trim();
  return WEEKDAY_MAP[key] ?? null;
}

export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
