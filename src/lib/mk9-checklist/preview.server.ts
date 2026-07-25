import type { ChecklistItem, ChecklistPreview } from "./types";
import type { ChecklistDiagnostics } from "./diagnostics";
import { buildRichError } from "./errors.server";
import { parseChecklistWorkbook } from "./parser";
import { diceCoefficient } from "./similarity";
import {
  cancelPreviousPreviews,
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

const SIMILARITY_THRESHOLD = 0.95;

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

  const parsed = parseChecklistWorkbook(input.buffer, input.filename, {
    onDebug: (event) => diagnostics.info(event.step, event.message, event.data),
  });

  diagnostics.info("visits-generated", "Visitas geradas pelo parser", {
    sheetsAnalyzed: parsed.sheetsAnalyzed,
    stores: parsed.stores.length,
    visits: parsed.marks.length,
    dateColumnCount: parsed.dateColumnCount,
    firstDate: parsed.firstDate,
    lastDate: parsed.lastDate,
    realizadoSum: parsed.realizadoSum,
    warnings: parsed.warnings,
  });

  if (parsed.marks.length === 0 && parsed.stores.length === 0) {
    const payload = buildRichError(
      new Error(
        "Planilha vazia ou fora do modelo esperado. Não foi possível localizar cabeçalho com coluna 'Loja' + colunas de datas.",
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

  const industry = await loadIndustry(input.industryId);
  const stores = await loadStoresIndex();

  // Índice por UF para similaridade
  const storesByUf = new Map<string, Array<{ id: string; name: string; nameNormalized: string; uf: string | null }>>();
  for (const rec of stores.all) {
    const key = rec.uf ?? "";
    const list = storesByUf.get(key) ?? [];
    list.push(rec);
    storesByUf.set(key, list);
  }

  // Resolve uma loja: exata → similaridade → nova. Memoiza por (normalized, uf).
  type Resolution =
    | { kind: "found"; storeId: string; matchedName?: string }
    | { kind: "linked_by_similarity"; storeId: string; matchedName: string; score: number }
    | { kind: "new_store" };
  const resolveCache = new Map<string, Resolution>();
  function resolve(normalized: string, uf: string | null): Resolution {
    const key = `${normalized}|${uf ?? ""}`;
    const cached = resolveCache.get(key);
    if (cached) return cached;
    const exact = stores.byKey.get(key) ?? stores.byName.get(normalized);
    if (exact) {
      const r: Resolution = { kind: "found", storeId: exact.id, matchedName: exact.name };
      resolveCache.set(key, r);
      return r;
    }
    // similaridade dentro da mesma UF (fallback: sem UF quando ausente)
    const pool = storesByUf.get(uf ?? "") ?? [];
    let best: { rec: (typeof pool)[number]; score: number } | null = null;
    let secondBest = 0;
    for (const rec of pool) {
      const score = diceCoefficient(normalized, rec.nameNormalized);
      if (!best || score > best.score) {
        secondBest = best?.score ?? 0;
        best = { rec, score };
      } else if (score > secondBest) {
        secondBest = score;
      }
    }
    if (best && best.score >= SIMILARITY_THRESHOLD && secondBest < SIMILARITY_THRESHOLD) {
      const r: Resolution = {
        kind: "linked_by_similarity",
        storeId: best.rec.id,
        matchedName: best.rec.name,
        score: best.score,
      };
      resolveCache.set(key, r);
      return r;
    }
    const r: Resolution = { kind: "new_store" };
    resolveCache.set(key, r);
    return r;
  }

  const items: ChecklistItem[] = [];
  const storesSeen = new Set<string>();
  const storesFound = new Set<string>();
  const storesLinked = new Set<string>();
  const storesNew = new Set<string>();

  for (const mark of parsed.marks) {
    const key = `${mark.storeNormalized}|${mark.uf ?? ""}`;
    storesSeen.add(key);
    const dateStr = mark.scheduledDate || "";
    const r = resolve(mark.storeNormalized, mark.uf);

    if (r.kind === "new_store") {
      storesNew.add(key);
      if (!dateStr) {
        items.push({
          excelRow: mark.excelRow,
          storeName: mark.storeName,
          storeNormalized: mark.storeNormalized,
          uf: mark.uf,
          storeId: null,
          scheduledDate: "",
          status: "invalid_date",
          message: `Data inválida no cabeçalho (linha ${mark.excelRow})`,
        });
        continue;
      }
      items.push({
        excelRow: mark.excelRow,
        storeName: mark.storeName,
        storeNormalized: mark.storeNormalized,
        uf: mark.uf,
        storeId: null,
        scheduledDate: dateStr,
        status: "new_store",
        message: "Nova loja — será cadastrada automaticamente ao confirmar",
      });
      continue;
    }

    if (r.kind === "linked_by_similarity") storesLinked.add(key);
    else storesFound.add(key);

    if (!dateStr) {
      items.push({
        excelRow: mark.excelRow,
        storeName: mark.storeName,
        storeNormalized: mark.storeNormalized,
        uf: mark.uf,
        storeId: r.storeId,
        scheduledDate: "",
        status: "invalid_date",
        message: `Data inválida no cabeçalho (linha ${mark.excelRow})`,
      });
      continue;
    }

    items.push({
      excelRow: mark.excelRow,
      storeName: mark.storeName,
      storeNormalized: mark.storeNormalized,
      uf: mark.uf,
      storeId: r.storeId,
      scheduledDate: dateStr,
      status: r.kind === "linked_by_similarity" ? "linked_by_similarity" : "found",
      matchedStoreName: r.matchedName,
      similarityScore: r.kind === "linked_by_similarity" ? r.score : undefined,
    });
  }

  // Garante que lojas listadas sem marcações também apareçam nos contadores
  for (const s of parsed.stores) {
    const key = `${s.storeNormalized}|${s.uf ?? ""}`;
    if (storesSeen.has(key)) continue;
    storesSeen.add(key);
    const r = resolve(s.storeNormalized, s.uf);
    if (r.kind === "found") storesFound.add(key);
    else if (r.kind === "linked_by_similarity") storesLinked.add(key);
    else storesNew.add(key);
  }

  const validDates = items.filter((i) => i.status === "found" || i.status === "linked_by_similarity" || i.status === "new_store").length;
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
      storesLinkedBySimilarity: storesLinked.size,
      storesNew: storesNew.size,
      storesNotFound: 0,
      validDates,
      invalidDates,
    },
    items,
    warnings: [
      ...(parsed.firstDate && parsed.lastDate
        ? [`Período detectado: ${parsed.firstDate.split("-").reverse().join("/")} a ${parsed.lastDate.split("-").reverse().join("/")} (${parsed.dateColumnCount} colunas de data). Soma REALIZADO: ${parsed.realizadoSum}.`]
        : []),
      ...parsed.warnings,
    ],
  };

  // Encerra prévias anteriores presas para a mesma indústria/competência antes de criar a nova.
  await cancelPreviousPreviews({
    industryId: industry.id,
    operationMonth: input.operationMonth,
    operationYear: input.operationYear,
  });

  const { id: importId } = await createChecklistImport({
    filename: input.filename,
    industryId: industry.id,
    operationMonth: input.operationMonth,
    operationYear: input.operationYear,
  });

  await savePreviewSnapshot(importId, preview);
  await updateImportStatus(importId, { status: "previewing", counters: { ...preview.counters } });


  diagnostics.info("preview-complete", "Prévia finalizada com sucesso", {
    importId,
    visits: preview.items.length,
    storesFound: preview.counters.storesFound,
    storesLinkedBySimilarity: preview.counters.storesLinkedBySimilarity,
    storesNew: preview.counters.storesNew,
  });

  return { importId, preview, diagnostics: diagnostics.events };
}
