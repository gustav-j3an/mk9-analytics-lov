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
  const storeFrequencyByKey = new Map<string, ChecklistPreview["storeFrequencies"][number]>();

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
    const r = resolve(s.storeNormalized, s.uf);
    if (!storesSeen.has(key)) storesSeen.add(key);
    if (r.kind === "found") storesFound.add(key);
    else if (r.kind === "linked_by_similarity") storesLinked.add(key);
    else storesNew.add(key);

    storeFrequencyByKey.set(key, {
      storeName: s.storeName,
      storeNormalized: s.storeNormalized,
      uf: s.uf,
      storeId: r.kind === "new_store" ? null : r.storeId,
      status: r.kind,
      matchedStoreName: r.kind === "linked_by_similarity" || r.kind === "found" ? r.matchedName : undefined,
      similarityScore: r.kind === "linked_by_similarity" ? r.score : undefined,
      weeklyFrequency: s.weeklyFrequency,
      monthlyFrequency: s.monthlyFrequency,
      excelRow: s.excelRow,
    });
  }

  const validDates = items.filter((i) => i.status === "found" || i.status === "linked_by_similarity" || i.status === "new_store").length;
  const invalidDates = items.filter((i) => i.status === "invalid_date").length;

  // Frequências por loja (fonte: checklist parseado). Guardadas no snapshot
  // para que o commit consiga persistir em mk9_industry_store_frequency.
  const storeFrequencies = Array.from(storeFrequencyByKey.values());
  const frequenciesNotImported = storeFrequencies.filter((s) => s.monthlyFrequency === null).length;

  const preview: ChecklistPreview = {
    filename: input.filename,
    industryId: industry.id,
    industryName: industry.name,
    operationMonth: input.operationMonth,
    operationYear: input.operationYear,
    counters: {
      totalStores: storesSeen.size,
      totalMarks: parsed.marks.length,
      totalContractedFrequency: parsed.monthlyFrequencySum,
      storesFound: storesFound.size,
      storesLinkedBySimilarity: storesLinked.size,
      storesNew: storesNew.size,
      storesNotFound: 0,
      validDates,
      invalidDates,
      frequenciesNotImported,
      duplicateStoreNames: parsed.duplicateStores.length,
    },
    items,
    storeFrequencies,
    warnings: [
      ...(parsed.firstDate && parsed.lastDate
        ? [`Período detectado: ${parsed.firstDate.split("-").reverse().join("/")} a ${parsed.lastDate.split("-").reverse().join("/")} (${parsed.dateColumnCount} colunas de data). Soma REALIZADO: ${parsed.realizadoSum}. Soma VISITA MENSAL: ${parsed.monthlyFrequencySum}.`]
        : []),
      ...(parsed.duplicateStores.length
        ? [`Duplicidades de loja detectadas: ${parsed.duplicateStores.length}. Verifique linhas: ${parsed.duplicateStores.slice(0, 10).map((d) => `${d.storeName} (${d.uf ?? "—"}) linha ${d.excelRow}`).join(", ")}${parsed.duplicateStores.length > 10 ? "…" : ""}.`]
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
    totalContractedFrequency: preview.counters.totalContractedFrequency,
    frequenciesNotImported: preview.counters.frequenciesNotImported,
  });

  return { importId, preview, diagnostics: diagnostics.events };
}
