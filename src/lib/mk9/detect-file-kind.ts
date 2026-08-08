// Detecta se um .xlsx é a Base MK9 (roteiro/consulta) ou um checklist mensal
// da indústria. Roda no cliente antes de enviar ao servidor, evitando
// misturar os dois importadores.
import * as XLSX from "xlsx";

export type Mk9FileKind = "base" | "checklist" | "unknown";

export interface DetectResult {
  kind: Mk9FileKind;
  reason: string;
  sheets: string[];
}

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function detectMk9FileKind(file: File): Promise<DetectResult> {
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array" });
  } catch (err) {
    return { kind: "unknown", reason: "Não foi possível abrir o arquivo Excel.", sheets: [] };
  }
  const sheets = wb.SheetNames ?? [];
  const norm = sheets.map(normalize);

  const hasBaseSheets = norm.some((n) => n.startsWith("roteiro") || n.startsWith("consulta"));
  const filenameHint = /check[\s_-]?list|checklist/i.test(file.name);

  if (hasBaseSheets && !filenameHint) {
    return {
      kind: "base",
      reason: "Contém abas Roteiro/Consulta da Base MK9.",
      sheets,
    };
  }

  // Sem abas de Roteiro/Consulta: procurar cabeçalho de checklist
  // (coluna "Loja" + colunas de dias 1..31) em qualquer aba.
  for (const name of sheets) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });
    for (let r = 0; r < Math.min(rows.length, 40); r++) {
      const row = rows[r] ?? [];
      let hasStore = false;
      let dayCols = 0;
      for (const cell of row) {
        const t = normalize(String(cell ?? ""));
        if (!hasStore && (t === "loja" || t === "cliente" || t === "pdv")) {
          hasStore = true;
        }
        if (typeof cell === "number" && Number.isInteger(cell) && cell >= 1 && cell <= 31) {
          dayCols++;
        } else if (typeof cell === "string") {
          const m = cell.trim().match(/^0?(\d{1,2})$/);
          if (m) {
            const n = Number(m[1]);
            if (n >= 1 && n <= 31) dayCols++;
          }
        }
      }
      if (hasStore && dayCols >= 3) {
        return {
          kind: "checklist",
          reason: `Aba "${name}" tem cabeçalho de checklist (coluna Loja + colunas de dias).`,
          sheets,
        };
      }
    }
  }

  if (filenameHint) {
    return {
      kind: "checklist",
      reason: "Nome do arquivo sugere checklist mensal.",
      sheets,
    };
  }

  if (hasBaseSheets) {
    return { kind: "base", reason: "Contém abas Roteiro/Consulta da Base MK9.", sheets };
  }

  return {
    kind: "unknown",
    reason: "Nenhuma aba reconhecida como Base MK9 ou checklist.",
    sheets,
  };
}
