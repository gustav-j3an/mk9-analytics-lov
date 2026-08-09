function keyOf(normalized, uf) {
    return `${normalized}|${uf ?? ""}`;
}
export function buildValidationReport(input) {
    const { parsed, items, storeFrequencies, persistedByStore } = input;
    const afterCommit = persistedByStore !== undefined;
    // 1) marcações parseadas por (normalized|uf) com datas
    const parsedByKey = new Map();
    for (const m of parsed.marks) {
        const k = keyOf(m.storeNormalized, m.uf);
        const entry = parsedByKey.get(k) ?? {
            dates: new Set(),
            storeName: m.storeName,
            uf: m.uf,
        };
        if (m.scheduledDate)
            entry.dates.add(m.scheduledDate);
        parsedByKey.set(k, entry);
    }
    // 2) resolvido pelo preview (storeId + status por loja)
    const resolvedByKey = new Map();
    for (const s of storeFrequencies)
        resolvedByKey.set(keyOf(s.storeNormalized, s.uf), s);
    // 3) itens invalidos por loja (data inválida, loja não encontrada)
    const invalidDatesByKey = new Map();
    const unmatchedByKey = new Map();
    for (const it of items) {
        const k = keyOf(it.storeNormalized, it.uf);
        if (it.status === "invalid_date")
            invalidDatesByKey.set(k, (invalidDatesByKey.get(k) ?? 0) + 1);
        if (it.status === "store_not_found")
            unmatchedByKey.set(k, (unmatchedByKey.get(k) ?? 0) + 1);
    }
    const stores = [];
    let declaredSum = 0;
    let parsedTotal = 0;
    let persistedTotal = 0;
    let unmatchedStoreTotal = 0;
    let invalidDateTotal = 0;
    // Uma linha por loja do Excel; se aparecer só em marks (sem linha própria em stores),
    // ainda emitimos entrada para não sumir a divergência.
    const seen = new Set();
    const emit = (key, storeName, storeNormalized, uf, declared, storeIdHint) => {
        if (seen.has(key))
            return;
        seen.add(key);
        const marksSet = parsedByKey.get(key)?.dates ?? new Set();
        const parsedCount = marksSet.size;
        parsedTotal += parsedCount;
        if (declared !== null && Number.isFinite(declared))
            declaredSum += declared;
        const resolved = resolvedByKey.get(key);
        const storeId = storeIdHint ?? resolved?.storeId ?? null;
        const persistedSet = storeId
            ? (persistedByStore?.get(storeId) ?? new Set())
            : new Set();
        const persistedCount = afterCommit ? persistedSet.size : null;
        if (persistedCount !== null)
            persistedTotal += persistedCount;
        const diffParsedVsDeclared = declared === null ? null : parsedCount - declared;
        const diffPersistedVsParsed = persistedCount === null ? null : persistedCount - parsedCount;
        const missing = afterCommit ? Array.from(marksSet).filter((d) => !persistedSet.has(d)) : [];
        const extra = afterCommit ? Array.from(persistedSet).filter((d) => !marksSet.has(d)) : [];
        let status = "OK";
        let message;
        if ((unmatchedByKey.get(key) ?? 0) > 0) {
            status = "STORE_NOT_FOUND";
            message = "Nenhuma loja correspondente encontrada na Base MK9.";
            unmatchedStoreTotal += unmatchedByKey.get(key) ?? 0;
        }
        else if (afterCommit && diffPersistedVsParsed !== null && diffPersistedVsParsed !== 0) {
            status = "PERSIST_DIVERGENCE";
            message =
                diffPersistedVsParsed < 0
                    ? `${Math.abs(diffPersistedVsParsed)} visita(s) identificada(s) no Excel não foram persistidas.`
                    : `${diffPersistedVsParsed} visita(s) persistidas além das identificadas nesta importação.`;
        }
        else if (diffParsedVsDeclared !== null && diffParsedVsDeclared !== 0 && declared !== 0) {
            status = "PARSE_DIVERGENCE";
            message =
                diffParsedVsDeclared < 0
                    ? `Coluna REALIZADO declara ${declared}, mas só ${parsedCount} marcação(ões) foram identificadas.`
                    : `Coluna REALIZADO declara ${declared}, mas ${parsedCount} marcação(ões) foram identificadas.`;
        }
        invalidDateTotal += invalidDatesByKey.get(key) ?? 0;
        stores.push({
            storeName,
            storeNormalized,
            uf,
            storeId,
            declared,
            parsed: parsedCount,
            persisted: persistedCount,
            diffParsedVsDeclared,
            diffPersistedVsParsed,
            status,
            dates: Array.from(marksSet).sort(),
            persistedDates: afterCommit ? Array.from(persistedSet).sort() : undefined,
            missingDates: afterCommit ? missing.sort() : undefined,
            extraDates: afterCommit ? extra.sort() : undefined,
            message,
        });
    };
    for (const s of parsed.stores) {
        const k = keyOf(s.storeNormalized, s.uf);
        const resolved = resolvedByKey.get(k);
        emit(k, s.storeName, s.storeNormalized, s.uf, s.realizado, resolved?.storeId ?? null);
    }
    // Lojas presentes só em marks (sem linha própria em stores)
    for (const [k, entry] of parsedByKey) {
        if (seen.has(k))
            continue;
        const resolved = resolvedByKey.get(k);
        emit(k, entry.storeName, k.split("|")[0], entry.uf, null, resolved?.storeId ?? null);
    }
    // Status agregado
    let status;
    const declaredTotal = parsed.declaredTotal;
    const declaredCheckMismatch = declaredTotal !== null && parsedTotal !== declaredTotal;
    const anyPersistDiff = afterCommit && stores.some((s) => (s.diffPersistedVsParsed ?? 0) !== 0);
    const anyParseDiff = stores.some((s) => (s.diffParsedVsDeclared ?? 0) !== 0);
    const anyUnmatched = unmatchedStoreTotal > 0 || invalidDateTotal > 0;
    if (afterCommit) {
        if (anyPersistDiff)
            status = "INCONSISTENT";
        else if (declaredCheckMismatch || anyParseDiff || anyUnmatched)
            status = "COMPLETED_WITH_ALERTS";
        else
            status = "CONSISTENT";
    }
    else {
        // No preview, nunca é INCONSISTENT (pois ainda não persistimos)
        if (declaredCheckMismatch || anyParseDiff || anyUnmatched) {
            status = "COMPLETED_WITH_ALERTS";
        }
        else if (parsed.realizadoSum > 0 && parsed.marks.length !== parsed.realizadoSum) {
            // REGRA CICOPAL/FRUTA POLPA: Divergência entre REALIZADO e MARCAÇÕES é alerta não-bloqueante
            status = "COMPLETED_WITH_ALERTS";
        }
        else {
            status = "CONSISTENT";
        }
    }
    const summaryLines = [];
    if (declaredTotal !== null) {
        summaryLines.push(`Total declarado na planilha: ${declaredTotal}`);
    }
    summaryLines.push(`Soma da coluna REALIZADO por loja: ${declaredSum}`);
    summaryLines.push(`Visitas identificadas no Excel: ${parsedTotal}`);
    if (afterCommit)
        summaryLines.push(`Visitas persistidas no banco: ${persistedTotal}`);
    if (declaredTotal !== null && parsedTotal !== declaredTotal) {
        summaryLines.push(`Diferença entre total declarado e identificado: ${parsedTotal - declaredTotal}`);
    }
    if (afterCommit && persistedTotal !== parsedTotal) {
        summaryLines.push(`Diferença entre identificado e persistido: ${persistedTotal - parsedTotal}`);
    }
    if (unmatchedStoreTotal > 0)
        summaryLines.push(`Visitas sem loja identificada: ${unmatchedStoreTotal}`);
    if (invalidDateTotal > 0)
        summaryLines.push(`Linhas com data inválida: ${invalidDateTotal}`);
    if (parsed.duplicateStores.length > 0)
        summaryLines.push(`Linhas duplicadas de loja: ${parsed.duplicateStores.length}`);
    return {
        status,
        declaredTotal,
        declaredSum,
        parsedTotal,
        persistedTotal: afterCommit ? persistedTotal : null,
        unmatchedStoreTotal,
        invalidDateTotal,
        duplicateRowTotal: parsed.duplicateStores.length,
        stores: stores.sort((a, b) => (a.storeName || "").localeCompare(b.storeName || "")),
        summaryLines,
        validatedAt: new Date().toISOString(),
    };
}
// Reconstrução parcial da validação pré-commit a partir de um snapshot ChecklistPreview.
// Usada quando não temos o `ParsedChecklist` bruto em mãos (ex: pós-commit sem re-parse).
export function buildValidationFromSnapshot(preview, persistedByStore) {
    const fakeMarks = preview.items
        .filter((i) => i.scheduledDate &&
        (i.status === "found" || i.status === "linked_by_similarity" || i.status === "new_store"))
        .map((i) => ({
        storeName: i.storeName,
        storeNormalized: i.storeNormalized,
        uf: i.uf,
        weeklyFrequency: null,
        monthlyFrequency: null,
        day: Number(i.scheduledDate.slice(8, 10)),
        scheduledDate: i.scheduledDate,
        excelRow: i.excelRow,
    }));
    const fakeParsed = {
        filename: preview.filename,
        sheetsAnalyzed: [],
        marks: fakeMarks,
        warnings: [],
        stores: preview.storeFrequencies.map((s) => ({
            storeName: s.storeName,
            storeNormalized: s.storeNormalized,
            uf: s.uf,
            excelRow: s.excelRow ?? 0,
            weeklyFrequency: s.weeklyFrequency,
            monthlyFrequency: s.monthlyFrequency,
            realizado: null,
        })),
        duplicateStores: [],
        realizadoSum: 0,
        monthlyFrequencySum: preview.counters.totalContractedFrequency ?? 0,
        declaredTotal: preview.validation?.declaredTotal ?? null,
        firstDate: null,
        lastDate: null,
        dateColumnCount: 0,
    };
    return buildValidationReport({
        parsed: fakeParsed,
        items: preview.items,
        storeFrequencies: preview.storeFrequencies,
        persistedByStore,
    });
}
