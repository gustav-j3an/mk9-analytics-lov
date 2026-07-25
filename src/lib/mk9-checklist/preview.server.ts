import type { ChecklistItem, ChecklistPreview } from "./types";
import type { ChecklistDiagnostics } from "./diagnostics";
import { buildRichError } from "./errors.server";
import { parseChecklistWorkbook } from "./parser";
import {
  createChecklistImport,
  loadIndustry,
  loadStoresIndex,
  savePreviewSnapshot,
  updateImportStatus,
} from "./persistence.server";

interface ChecklistPreviewInput {
  buffer: ArrayBuffer;
  filename: string;
  fileSize: number;
  mimeType: string;
  industryId: string;
  operationMonth: number;
  operationYear: number;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export async function runChecklistPreview(input: ChecklistPreviewInput, diagnostics: ChecklistDiagnostics) {
  diagnostics.info("preview-start", "Iniciando prévia do checklist", {
    parser: "parseChecklistWorkbook",
    filename: input.filename,
    fileSize: input.fileSize,
    mimeType: input.mimeType || "(não informado)",
    industryId: input.industryId,
    operationMonth: input.operationMonth,
    operationYear: input.operationYear,
  });

  diagnostics.info("load-industry", "Carregando indústria selecionada", { industryId: input.industryId });
  const industry = await loadIndustry(input.industryId);

  diagnostics.info("parse-workbook", "Chamando parser específico de checklist", {
    parser: "src/lib/mk9-checklist/parser.ts:parseChecklistWorkbook",
  });
  const parsed = parseChecklistWorkbook(input.buffer, input.filename, {
    onDebug: (event) => diagnostics.info(event.step, event.message, event.data),
  });

  diagnostics.info("visits-generated", "Visitas geradas pelo parser", {
    sheetsAnalyzed: parsed.sheetsAnalyzed,
    stores: parsed.stores.length,
    visits: parsed.marks.length,
    warnings: parsed.warnings,
  });

  if (parsed.marks.length === 0 && parsed.stores.length === 0) {
    const payload = buildRichError(
      new Error(
        "Planilha vazia ou fora do modelo esperado. Não foi possível localizar cabeçalho com coluna 'Loja' + colunas de dias (1..31).",
      ),
      {
        step: "parse-workbook",
        function: "checklistPreview",
        parser: { sheet: parsed.sheetsAnalyzed[0] ?? "(nenhuma)" },
        extra: {
          parser: "parseChecklistWorkbook",
          sheetsAnalyzed: parsed.sheetsAnalyzed,
          warnings: parsed.warnings,
          diagnostics: diagnostics.events,
        },
      },
    );
    throw new Error(JSON.stringify(payload));
  }

  diagnostics.info("load-stores", "Carregando índice de lojas da base MK9", {});
  const stores = await loadStoresIndex();

  diagnostics.info("build-preview-items", "Cruzando visitas do checklist com lojas cadastradas", {
    marks: parsed.marks.length,
    storesInSheet: parsed.stores.length,
  });
  const maxDay = daysInMonth(input.operationYear, input.operationMonth);
  const items: ChecklistItem[] = [];
  const storesSeen = new Set<string>();
  const storesFound = new Set<string>();
  const storesNotFound = new Set<string>();

  for (const mark of parsed.marks) {
    const key = `${mark.storeNormalized}|${mark.uf ?? ""}`;
    storesSeen.add(key);
    const match = stores.byKey.get(key) ?? stores.byName.get(mark.storeNormalized);

    const dateStr =
      mark.day >= 1 && mark.day <= maxDay
        ? `${input.operationYear}-${pad2(input.operationMonth)}-${pad2(mark.day)}`
        : "";

    if (!match) {
      storesNotFound.add(key);
      items.push({
        excelRow: mark.excelRow,
        storeName: mark.storeName,
        uf: mark.uf,
        storeId: null,
        scheduledDate: dateStr,
        status: "store_not_found",
        message: "Loja não localizada na base MK9",
      });
      continue;
    }
    storesFound.add(key);

    if (!dateStr) {
      items.push({
        excelRow: mark.excelRow,
        storeName: mark.storeName,
        uf: mark.uf,
        storeId: match.id,
        scheduledDate: "",
        status: "invalid_date",
        message: `Dia ${mark.day} inválido para ${pad2(input.operationMonth)}/${input.operationYear}`,
      });
      continue;
    }

    items.push({
      excelRow: mark.excelRow,
      storeName: mark.storeName,
      uf: mark.uf,
      storeId: match.id,
      scheduledDate: dateStr,
      status: "found",
    });
  }

  for (const s of parsed.stores) {
    const key = `${s.storeNormalized}|${s.uf ?? ""}`;
    storesSeen.add(key);
    const match = stores.byKey.get(key) ?? stores.byName.get(s.storeNormalized);
    if (match) storesFound.add(key);
    else storesNotFound.add(key);
  }

  const validDates = items.filter((i) => i.status === "found").length;
  const invalidDates = items.filter((i) => i.status === "invalid_date").length;

  const preview: ChecklistPreview = {
    filename: input.filename,
    industryId: industry.id,
    industryName: industry.name,
    operationMonth: input.operationMonth,
    operationYear: input.operationYear,
    counters: {
      totalStores: storesSeen.size,
      totalMarks: parsed.marks.length,
      storesFound: storesFound.size,
      storesNotFound: storesNotFound.size,
      validDates,
      invalidDates,
    },
    items,
    warnings: parsed.warnings,
  };

  diagnostics.info("preview-built", "Contadores da prévia preenchidos", {
    totalStores: preview.counters.totalStores,
    totalMarks: preview.counters.totalMarks,
    storesFound: preview.counters.storesFound,
    storesNotFound: preview.counters.storesNotFound,
    validDates: preview.counters.validDates,
    invalidDates: preview.counters.invalidDates,
    rowsDisplayed: preview.items.length,
  });

  diagnostics.info("create-import", "Criando registro da importação do checklist", {});
  const { id: importId } = await createChecklistImport({
    filename: input.filename,
    industryId: industry.id,
    operationMonth: input.operationMonth,
    operationYear: input.operationYear,
  });

  diagnostics.info("save-preview", "Salvando snapshot da prévia", { importId });
  await savePreviewSnapshot(importId, preview);

  diagnostics.info("update-status-previewing", "Atualizando status da importação", { importId });
  await updateImportStatus(importId, { status: "previewing", counters: { ...preview.counters } });

  diagnostics.info("preview-complete", "Prévia finalizada com sucesso", {
    importId,
    visits: preview.items.length,
  });

  return { importId, preview, diagnostics: diagnostics.events };
}