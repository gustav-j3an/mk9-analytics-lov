// Persistência do módulo Checklists. SERVER-ONLY.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { storeCompactKey, storeTokenSetKey } from "@/lib/mk9/normalization";
export async function writeValidationReport(importId, report) {
    const { error } = await supabaseAdmin
        .from("mk9_checklist_imports")
        .update({
        validation_status: report.status,
        validation_details: report,
        validated_at: new Date().toISOString(),
    })
        .eq("id", importId);
    if (error)
        throw new Error(error.message);
}
export async function loadValidationReport(importId) {
    const { data, error } = await supabaseAdmin
        .from("mk9_checklist_imports")
        .select("validation_details")
        .eq("id", importId)
        .maybeSingle();
    if (error)
        throw new Error(error.message);
    return (data?.validation_details ?? null);
}
// Consulta as visitas persistidas para uma importação, agrupando por loja.
export async function queryPersistedVisitsByImport(importId) {
    const { data, error } = await supabaseAdmin
        .from("mk9_actual_visits")
        .select("store_id, scheduled_date")
        .eq("source_import_id", importId);
    if (error)
        throw new Error(error.message);
    const byStore = new Map();
    for (const row of data ?? []) {
        const sid = row.store_id;
        const set = byStore.get(sid) ?? new Set();
        set.add(String(row.scheduled_date));
        byStore.set(sid, set);
    }
    return byStore;
}
export async function loadStoresIndex() {
    const { data, error } = await supabaseAdmin
        .from("mk9_stores")
        .select("id, name, name_normalized, uf");
    if (error)
        throw new Error(error.message);
    const byKey = new Map();
    const byName = new Map();
    const countByName = new Map();
    // Índices auxiliares para casar variantes tipográficas do mesmo estabelecimento.
    // compactByUf: nome normalizado sem espaços (T-63 == T63) por UF.
    // tokenSetByUf: conjunto ordenado de tokens (ignora ordem e stopwords) por UF.
    const compactByUf = new Map();
    const tokenSetByUf = new Map();
    const compactCountByUf = new Map();
    const tokenSetCountByUf = new Map();
    const all = [];
    for (const row of data ?? []) {
        const uf = row.uf ?? null;
        const rec = {
            id: row.id,
            name: row.name,
            nameNormalized: row.name_normalized,
            uf,
        };
        all.push(rec);
        byKey.set(`${rec.nameNormalized}|${uf ?? ""}`, rec);
        countByName.set(rec.nameNormalized, (countByName.get(rec.nameNormalized) ?? 0) + 1);
        if (!byName.has(rec.nameNormalized))
            byName.set(rec.nameNormalized, rec);
        const ufKey = uf ?? "";
        const ck = storeCompactKey(rec.nameNormalized);
        const tk = storeTokenSetKey(rec.nameNormalized);
        if (ck) {
            const map = compactByUf.get(ufKey) ?? new Map();
            const cnt = compactCountByUf.get(ufKey) ?? new Map();
            cnt.set(ck, (cnt.get(ck) ?? 0) + 1);
            if (!map.has(ck))
                map.set(ck, rec);
            compactByUf.set(ufKey, map);
            compactCountByUf.set(ufKey, cnt);
        }
        if (tk) {
            const map = tokenSetByUf.get(ufKey) ?? new Map();
            const cnt = tokenSetCountByUf.get(ufKey) ?? new Map();
            cnt.set(tk, (cnt.get(tk) ?? 0) + 1);
            if (!map.has(tk))
                map.set(tk, rec);
            tokenSetByUf.set(ufKey, map);
            tokenSetCountByUf.set(ufKey, cnt);
        }
    }
    // uniqueByName: só devolve record quando existe UMA única loja com aquele
    // nome normalizado, independentemente da UF.
    const uniqueByName = new Map();
    for (const [k, count] of countByName) {
        if (count === 1) {
            const rec = byName.get(k);
            if (rec)
                uniqueByName.set(k, rec);
        }
    }
    // Só aceita match por compact/tokenSet quando é ÚNICO na UF (evita ambiguidade).
    function pickUnique(kind, uf, key) {
        if (!key)
            return null;
        const mapByUf = kind === "compact" ? compactByUf : tokenSetByUf;
        const cntByUf = kind === "compact" ? compactCountByUf : tokenSetCountByUf;
        const cnt = cntByUf.get(uf)?.get(key) ?? 0;
        if (cnt !== 1)
            return null;
        return mapByUf.get(uf)?.get(key) ?? null;
    }
    return { byKey, byName, uniqueByName, all, pickUnique };
}
// Cria (ou reaproveita) lojas para o checklist. Retorna mapa (normalized|uf) -> storeId.
// Idempotente: revalida por (name_normalized, uf) antes de inserir e ignora conflitos.
export async function ensureChecklistStores(importId, candidates) {
    const result = new Map();
    if (!candidates.length)
        return result;
    // Dedup interno por (normalized, uf); mantém a primeira grafia.
    const dedup = new Map();
    for (const c of candidates) {
        const key = `${c.storeNormalized}|${c.uf ?? ""}`;
        if (!dedup.has(key))
            dedup.set(key, c);
    }
    // Revalida: quem já existe agora não precisa ser criado.
    const normalized = Array.from(new Set(Array.from(dedup.values()).map((c) => c.storeNormalized)));
    const { data: existing, error: exErr } = await supabaseAdmin
        .from("mk9_stores")
        .select("id, name_normalized, uf")
        .in("name_normalized", normalized);
    if (exErr)
        throw new Error(exErr.message);
    const existingMap = new Map();
    for (const row of existing ?? []) {
        existingMap.set(`${row.name_normalized}|${row.uf ?? ""}`, row.id);
    }
    for (const [key, c] of dedup) {
        const already = existingMap.get(key);
        if (already) {
            result.set(key, { storeId: already, created: false });
            continue;
        }
        // Insert individual para tolerar conflitos concorrentes por (name_normalized, uf) sem parar o lote.
        const insertPayload = {
            name: c.storeName,
            name_normalized: c.storeNormalized,
            uf: c.uf,
            origin: "CHECKLIST_IMPORT",
            is_incomplete: true,
            created_by_checklist_import_id: importId,
            notes: "Loja criada automaticamente pela importação do checklist",
            last_import_id: null,
        };
        const { data: inserted, error: insErr } = await supabaseAdmin
            .from("mk9_stores")
            .insert(insertPayload)
            .select("id")
            .single();
        if (insErr) {
            // Provável conflito por unique(name_normalized, uf): busca a linha existente.
            const query = supabaseAdmin
                .from("mk9_stores")
                .select("id")
                .eq("name_normalized", c.storeNormalized);
            const { data: after, error: afterErr } = c.uf === null
                ? await query.is("uf", null).maybeSingle()
                : await query.eq("uf", c.uf).maybeSingle();
            if (afterErr || !after)
                throw new Error(insErr.message);
            result.set(key, { storeId: after.id, created: false });
            continue;
        }
        result.set(key, { storeId: inserted.id, created: true });
    }
    return result;
}
export async function loadIndustry(industryId) {
    const { data, error } = await supabaseAdmin
        .from("mk9_industries")
        .select("id, name")
        .eq("id", industryId)
        .maybeSingle();
    if (error)
        throw new Error(error.message);
    if (!data)
        throw new Error("Indústria não encontrada");
    return { id: data.id, name: data.name };
}
export async function cancelPreviousPreviews(input) {
    const q = supabaseAdmin
        .from("mk9_checklist_imports")
        .update({
        status: "cancelled",
        reason: input.reason ?? "preview_abandoned",
        error_message: "Prévia abandonada — substituída por nova importação",
        finished_at: new Date().toISOString(),
    })
        .eq("industry_id", input.industryId)
        .eq("operation_month", input.operationMonth)
        .eq("operation_year", input.operationYear)
        .in("status", ["pending", "previewing"]);
    const { error } = input.exceptImportId ? await q.neq("id", input.exceptImportId) : await q;
    if (error)
        throw new Error(error.message);
}
export async function createChecklistImport(input) {
    const { data, error } = await supabaseAdmin
        .from("mk9_checklist_imports")
        .insert({
        filename: input.filename,
        industry_id: input.industryId,
        operation_month: input.operationMonth,
        operation_year: input.operationYear,
        status: "previewing",
        user_id: input.userId ?? null,
        file_hash: input.fileHash ?? null,
    })
        .select("id")
        .single();
    if (error)
        throw new Error(error.message);
    return { id: data.id };
}
export async function savePreviewSnapshot(importId, preview) {
    const { error } = await supabaseAdmin
        .from("mk9_checklist_imports")
        .update({ preview: preview, counters: preview.counters })
        .eq("id", importId);
    if (error)
        throw new Error(error.message);
}
export async function updateImportStatus(importId, patch) {
    const update = {};
    if (patch.status) {
        update.status = patch.status;
        if (patch.reason)
            update.reason = patch.reason;
        console.log(`[STATUS_CHANGE] import=${importId} to=${patch.status} reason=${patch.reason ?? 'not_specified'}`);
        // GUARD v1.3.14: Nenhuma função interna pode marcar como 'cancelled' sem motivo explícito
        if (patch.status === 'cancelled' && !patch.reason) {
            console.warn(`[STATUS_CHANGE_WARNING] import=${importId} status cancelled without reason!`);
        }
    }
    if (patch.counters)
        update.counters = patch.counters;
    if (patch.errorMessage !== undefined)
        update.error_message = patch.errorMessage;
    if (patch.finishedAt)
        update.finished_at = patch.finishedAt.toISOString();
    if (patch.durationMs !== undefined)
        update.duration_ms = patch.durationMs;
    const { error } = await supabaseAdmin
        .from("mk9_checklist_imports")
        .update(update)
        .eq("id", importId);
    if (error)
        throw new Error(error.message);
}
export async function persistActualVisits(importId, industryId, rows) {
    if (!rows.length)
        return { persisted: 0, skipped: 0 };
    // Deduplica no lote por (store, date)
    const dedup = new Map();
    for (const r of rows)
        dedup.set(`${r.storeId}|${r.scheduledDate}`, r);
    const list = Array.from(dedup.values());
    // Verifica quais já existem para reportar "skipped"
    const keys = list.map((r) => `${r.storeId}|${r.scheduledDate}`);
    const { data: existing, error: exErr } = await supabaseAdmin
        .from("mk9_actual_visits")
        .select("store_id, scheduled_date")
        .eq("industry_id", industryId)
        .eq("origin", "CHECKLIST")
        .in("store_id", Array.from(new Set(list.map((r) => r.storeId))));
    if (exErr)
        throw new Error(exErr.message);
    const existingSet = new Set((existing ?? []).map((r) => `${r.store_id}|${r.scheduled_date}`));
    const skipped = keys.filter((k) => existingSet.has(k)).length;
    const payload = list.map((r) => ({
        industry_id: industryId,
        store_id: r.storeId,
        scheduled_date: r.scheduledDate,
        origin: "CHECKLIST",
        status: "completed",
        source_import_id: importId,
    }));
    const CHUNK = 500;
    let totalUpserted = 0;
    for (let i = 0; i < payload.length; i += CHUNK) {
        const slice = payload.slice(i, i + CHUNK);
        console.log(`[PERSISTENCE] Upserting chunk of ${slice.length} visits...`);
        const { data: upsertedData, error } = await supabaseAdmin
            .from("mk9_actual_visits")
            .upsert(slice, {
            onConflict: "industry_id,store_id,scheduled_date,origin",
            ignoreDuplicates: false // Garante que source_import_id seja atualizado
        })
            .select("id");
        if (error) {
            console.error(`[PERSISTENCE-ERROR] Supabase error during upsert:`, error);
            throw new Error(`Database error: ${error.message} (${error.code})`);
        }
        const count = upsertedData?.length ?? 0;
        totalUpserted += count;
        console.log(`[PERSISTENCE] Chunk upserted successfully: ${count} rows.`);
    }
    if (payload.length > 0 && totalUpserted === 0) {
        console.warn(`[PERSISTENCE-WARN] Payload length was ${payload.length} but totalUpserted is 0.`);
    }
    return { persisted: totalUpserted, skipped };
}
export async function listChecklistImports(limit = 30) {
    const { data, error } = await supabaseAdmin
        .from("mk9_checklist_imports")
        .select("*, industry:mk9_industries(id,name)")
        .order("started_at", { ascending: false })
        .limit(limit);
    if (error)
        throw new Error(error.message);
    return (data ?? []).map((r) => ({
        id: r.id,
        filename: r.filename,
        industryId: r.industry_id,
        industryName: r.industry?.name ?? "—",
        operationMonth: r.operation_month,
        operationYear: r.operation_year,
        status: r.status,
        counters: r.counters ?? {},
        errorMessage: r.error_message ?? null,
        startedAt: r.started_at,
        finishedAt: r.finished_at ?? null,
        durationMs: r.duration_ms ?? null,
        validationStatus: r.validation_status ?? null,
        validationDetails: (r.validation_details ?? null),
        validatedAt: r.validated_at ?? null,
        isOperationalCurrent: !!r.is_operational_current,
        supersededAt: r.superseded_at ?? null,
        supersededBy: r.superseded_by ?? null,
        replacesImportId: r.replaces_import_id ?? null,
    }));
}
export async function deleteChecklistImport(importId) {
    // ON DELETE SET NULL na FK -> visitas realizadas ficam preservadas por padrão.
    // Se quisermos removê-las também: descomentar bloco abaixo.
    // await supabaseAdmin.from("mk9_actual_visits").delete().eq("source_import_id", importId);
    const { error } = await supabaseAdmin.from("mk9_checklist_imports").delete().eq("id", importId);
    if (error)
        throw new Error(error.message);
}
export async function loadPreviewSnapshot(importId) {
    const { data, error } = await supabaseAdmin
        .from("mk9_checklist_imports")
        .select("preview")
        .eq("id", importId)
        .maybeSingle();
    if (error)
        throw new Error(error.message);
    return (data?.preview ?? null);
}
// FASE 1B.2 — A escrita de frequência foi migrada para o motor versionado em
// src/lib/mk9-frequency/diff.server.ts. A tabela mk9_industry_store_frequency
// virou apenas projeção (trigger de guarda no banco bloqueia escrita direta).
// Este wrapper mantém a assinatura anterior, mas agora aplica diff + vigência.
export async function upsertIndustryStoreFrequencies(industryId, importId, rows, options) {
    const { buildFrequencyDiff, applyFrequencyDiff } = await import("@/lib/mk9-frequency/diff.server");
    const report = await buildFrequencyDiff(industryId, rows, options.operationMonth, options.operationYear);
    const applied = await applyFrequencyDiff(importId, report, {
        force: !!options.force,
        reason: options.reason ?? null,
        actorId: options.actorId ?? null,
    });
    return {
        upserted: applied.new + applied.changed,
        report,
        applied,
    };
}
export async function persistImportSnapshot(importId, industryId, rows) {
    if (!rows.length)
        return;
    const payload = rows.map((r) => ({
        import_id: importId,
        industry_id: industryId,
        store_id: r.storeId,
        source_store_name: r.storeName,
        uf: r.uf,
        weekly_frequency: r.weeklyFrequency,
        monthly_frequency: r.monthlyFrequency,
    }));
    const CHUNK = 500;
    for (let i = 0; i < payload.length; i += CHUNK) {
        const slice = payload.slice(i, i + CHUNK);
        const { error } = await supabaseAdmin.from("mk9_checklist_import_store_snapshots").upsert(slice);
        if (error)
            throw new Error(error.message);
    }
}
export async function loadImportSnapshot(importId) {
    try {
        const { data, error } = await supabaseAdmin.from("mk9_checklist_import_store_snapshots")
            .select("store_id, source_store_name, uf, weekly_frequency, monthly_frequency")
            .eq("import_id", importId);
        if (error)
            return [];
        return data || [];
    }
    catch (e) {
        return [];
    }
}
