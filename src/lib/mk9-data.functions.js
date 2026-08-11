// Leitura de dados MK9 para consumo pelas telas.
// Todas as leituras exigem sessão válida + papel (ver mk9-auth/read-guards.server)
// e são filtradas pelo escopo resolvido no servidor (mk9-auth/access-scope.server).
// ESTRATÉGIA: cliente administrativo controlado (agregações e joins), sempre com
// restrições explícitas de indústria/UF/loja aplicadas na própria consulta.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const mk9ListIndustries = createServerFn({ method: "GET" }).handler(async () => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (scope.allowedIndustryIds?.length === 0)
        return [];
    let q = supabaseAdmin
        .from("mk9_industries")
        .select("id, name, display_name, notes, source_type, archived_at, archive_reason, monthly_contracted_frequency, monthly_estimated_frequency, frequency_difference, frequency_status, weeks_count, requires_checklist, checklist_enabled_at, updated_at")
        .order("name", { ascending: true });
    if (scope.allowedIndustryIds)
        q = q.in("id", scope.allowedIndustryIds);
    const { data, error } = await q;
    if (error)
        throw new Error(error.message);
    return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        displayName: (r.display_name ?? null),
        cnpj: null, // Campo temporariamente removido da query por ausência na tabela real
        notes: (r.notes ?? null),
        sourceType: (r.source_type ?? "IMPORT"),
        archivedAt: (r.archived_at ?? null),
        archiveReason: (r.archive_reason ?? null),
        monthlyContractedFrequency: r.monthly_contracted_frequency,
        monthlyEstimatedFrequency: r.monthly_estimated_frequency,
        frequencyDifference: r.frequency_difference,
        frequencyStatus: r.frequency_status,
        weeksCount: r.weeks_count,
        requiresChecklist: r.requires_checklist === true,
        controlMode: (r.control_mode ?? "VISIT_CONTROLLED"),
        checklistEnabledAt: (r.checklist_enabled_at ?? null),
        updatedAt: r.updated_at,
    }));
});
/**
 * Indústrias habilitadas ao fluxo de checklist. Filtro aplicado NO SERVIDOR:
 * a interface nunca decide sozinha quem pode receber importação de checklist.
 */
export const mk9ListChecklistIndustries = createServerFn({ method: "GET" }).handler(async () => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (scope.allowedIndustryIds?.length === 0)
        return [];
    let q = supabaseAdmin
        .from("mk9_industries")
        .select("id, name, requires_checklist")
        .eq("requires_checklist", true)
        .order("name", { ascending: true });
    if (scope.allowedIndustryIds)
        q = q.in("id", scope.allowedIndustryIds);
    const { data, error } = await q;
    if (error)
        throw new Error(error.message);
    return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        requiresChecklist: true,
    }));
});
/**
 * Busca assíncrona de indústrias habilitadas para checklist (seletores do fluxo).
 * Não carrega tudo: filtro no servidor, escopo aplicado, no máximo 20 resultados.
 */
export const mk9SearchChecklistIndustries = createServerFn({ method: "GET" })
    .inputValidator((data) => z.object({ q: z.string().max(120).optional() }).parse(data ?? {}))
    .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (scope.allowedIndustryIds?.length === 0)
        return [];
    let q = supabaseAdmin
        .from("mk9_industries")
        .select("id, name")
        .eq("requires_checklist", true)
        .order("name", { ascending: true })
        .limit(20);
    const term = (data.q ?? "").trim();
    if (term)
        q = q.ilike("name", `%${term}%`);
    if (scope.allowedIndustryIds)
        q = q.in("id", scope.allowedIndustryIds);
    const { data: rows, error } = await q;
    if (error)
        throw new Error("Não foi possível buscar as indústrias.");
    return (rows ?? []).map((r) => ({ id: r.id, name: r.name }));
});
/** Configuração operacional de uma indústria (modal "Configurar operação"). */
export const mk9GetIndustryOperationConfig = createServerFn({ method: "GET" })
    .inputValidator((data) => z.object({ industryId: z.string().uuid() }).parse(data))
    .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    if (scope.allowedIndustryIds && !scope.allowedIndustryIds.includes(data.industryId)) {
        const { mk9IndustryError } = await import("@/lib/mk9-checklist/industry-admin");
        throw mk9IndustryError("FORBIDDEN", 403);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ind, error } = await supabaseAdmin
        .from("mk9_industries")
        .select("id, name, requires_checklist, checklist_enabled_at")
        .eq("id", data.industryId)
        .maybeSingle();
    if (error)
        throw new Error("Não foi possível carregar a indústria.");
    if (!ind) {
        const { mk9IndustryError } = await import("@/lib/mk9-checklist/industry-admin");
        throw mk9IndustryError("INDUSTRY_NOT_FOUND", 404);
    }
    const { data: cfg } = await supabaseAdmin
        .from("mk9_industry_period_config")
        .select("period_type, start_day, end_day, uses_previous_month, week_grouping, active")
        .eq("industry_id", data.industryId)
        .maybeSingle();
    return {
        id: ind.id,
        name: ind.name,
        requiresChecklist: ind.requires_checklist === true,
        controlMode: (ind.control_mode ?? "VISIT_CONTROLLED"),
        checklistEnabledAt: (ind.checklist_enabled_at ?? null),
        periodType: (cfg?.period_type ?? "CALENDAR_MONTH"),
        hasCustomPeriod: !!cfg && cfg.period_type === "CUSTOM_CYCLE" && cfg.active === true,
        period: cfg
            ? {
                startDay: cfg.start_day,
                endDay: cfg.end_day,
                usesPreviousMonth: cfg.uses_previous_month === true,
                weekGrouping: cfg.week_grouping,
                active: cfg.active === true,
            }
            : null,
    };
});
/**
 * Alteração da classificação: exclusiva de ADMIN, aplicada via RPC com audit log.
 * `source` distingue a origem (tela administrativa × durante a importação) e
 * `importId` amarra o evento à importação que disparou a habilitação.
 */
export const mk9SetIndustryRequiresChecklist = createServerFn({ method: "POST" })
    .inputValidator((data) => z
    .object({
    industryId: z.string().uuid(),
    value: z.boolean(),
    reason: z.string().max(500).optional(),
    source: z.enum(["ADMIN_UI", "IMPORT"]).optional(),
    importId: z.string().uuid().nullable().optional(),
})
    .parse(data))
    .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { mk9IndustryError } = await import("@/lib/mk9-checklist/industry-admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("mk9_admin_set_industry_requires_checklist", {
        p_industry_id: data.industryId,
        p_value: data.value,
        p_reason: data.reason ?? null,
        p_actor: ctx.userId,
        p_source: data.source ?? "ADMIN_UI",
        p_import_id: data.importId ?? null,
    });
    if (error) {
        const raw = error.message ?? "";
        if (raw.includes("MK9_INDUSTRY_NOT_FOUND"))
            throw mk9IndustryError("INDUSTRY_NOT_FOUND", 404);
        if (raw.includes("MK9_INDUSTRY_ALREADY_ENABLED"))
            throw mk9IndustryError("INDUSTRY_ALREADY_ENABLED", 409);
        throw new Error("Não foi possível alterar a classificação de checklist desta indústria.");
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
        ok: true,
        industryId: data.industryId,
        name: (row?.name ?? null),
        requiresChecklist: data.value,
        checklistEnabledAt: (row?.checklist_enabled_at ?? null),
    };
});
/**
 * Cadastro de indústria durante a importação de checklist.
 * Nunca cria em silêncio: exige confirmação quando há nomes semelhantes e
 * bloqueia duplicidade por nome normalizado.
 */
export const mk9CreateChecklistIndustry = createServerFn({ method: "POST" })
    .inputValidator((data) => z
    .object({
    name: z.string().min(2).max(120),
    confirmed: z.boolean().optional(),
    importId: z.string().uuid().nullable().optional(),
})
    .parse(data))
    .handler(async ({ data }) => {
    const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { decideIndustryCreation, mk9IndustryError } = await import("@/lib/mk9-checklist/industry-admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: listErr } = await supabaseAdmin
        .from("mk9_industries")
        .select("id, name, name_normalized, requires_checklist");
    if (listErr)
        throw new Error("Não foi possível validar o nome da indústria.");
    const decision = decideIndustryCreation(data.name, (existing ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        nameNormalized: r.name_normalized,
        requiresChecklist: r.requires_checklist === true,
    })), { confirmed: data.confirmed });
    if (decision.kind === "duplicate") {
        return { status: "duplicate", match: decision.match };
    }
    if (decision.kind === "needs_confirmation") {
        return { status: "candidates", candidates: decision.candidates };
    }
    const { data: rows, error } = await supabaseAdmin.rpc("mk9_admin_create_checklist_industry", {
        p_name: decision.name,
        p_name_normalized: decision.nameNormalized,
        p_actor: ctx.userId,
        p_import_id: data.importId ?? null,
        p_source: "IMPORT",
    });
    if (error) {
        if ((error.message ?? "").includes("MK9_DUPLICATE_INDUSTRY")) {
            throw mk9IndustryError("DUPLICATE_INDUSTRY", 409);
        }
        throw new Error("Não foi possível cadastrar a indústria.");
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
        status: "created",
        industry: {
            id: row?.id,
            name: row?.name,
            requiresChecklist: true,
            checklistEnabledAt: (row?.checklist_enabled_at ?? null),
        },
    };
});
export const mk9ListStores = createServerFn({ method: "GET" }).handler(async () => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (scope.allowedUfs?.length === 0 || scope.allowedStoreIds?.length === 0)
        return [];
    let q = supabaseAdmin
        .from("mk9_stores")
        .select("id, name, chain, uf, updated_at, archived_at")
        .order("name", { ascending: true });
    if (scope.allowedUfs)
        q = q.in("uf", scope.allowedUfs);
    if (scope.allowedStoreIds)
        q = q.in("id", scope.allowedStoreIds);
    const { data, error } = await q;
    if (error)
        throw new Error(error.message);
    return (data ?? []).map((r) => ({
        id: r.id,
        chain: r.chain ?? null,
        name: r.name,
        uf: r.uf ?? null,
        updatedAt: r.updated_at,
        archivedAt: (r.archived_at ?? null),
    }));
});
export const mk9ListPromoters = createServerFn({ method: "GET" }).handler(async () => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Escopo de promotor: explícito (mk9_user_scopes) ou derivado do roteiro
    // dentro das indústrias/UFs permitidas (resolvido em lote, sem N+1).
    let allowedPromoterIds = scope.allowedPromoterIds;
    if (!allowedPromoterIds &&
        (scope.allowedIndustryIds || scope.allowedUfs || scope.allowedStoreIds)) {
        let rq = supabaseAdmin
            .from("mk9_planned_routes")
            .select("promoter_id, store:mk9_stores(uf)")
            .is("archived_at", null)
            .not("promoter_id", "is", null)
            .limit(50000);
        if (scope.allowedIndustryIds)
            rq = rq.in("industry_id", scope.allowedIndustryIds);
        if (scope.allowedStoreIds)
            rq = rq.in("store_id", scope.allowedStoreIds);
        const { data: routes, error: rErr } = await rq;
        if (rErr)
            throw new Error(rErr.message);
        allowedPromoterIds = Array.from(new Set((routes ?? [])
            .filter((r) => !scope.allowedUfs || (r.store?.uf && scope.allowedUfs.includes(r.store.uf)))
            .map((r) => r.promoter_id)));
    }
    if (allowedPromoterIds?.length === 0)
        return [];
    let q = supabaseAdmin
        .from("mk9_promoters")
        .select("id, name, external_id, employee_number, city, uf, contact, notes, updated_at, archived_at, is_active, supervisor_id")
        .order("name", { ascending: true });
    if (allowedPromoterIds)
        q = q.in("id", allowedPromoterIds);
    const { data, error } = await q;
    if (error)
        throw new Error(error.message);
    // Dados pessoais (contato/observações) só para quem tem autorização.
    return (data ?? []).map((r) => ({
        id: r.id,
        externalId: r.external_id ?? null,
        employeeNumber: r.employee_number ?? null,
        name: r.name,
        city: r.city ?? null,
        uf: r.uf ?? null,
        contact: scope.canViewPersonalData ? (r.contact ?? null) : null,
        notes: scope.canViewPersonalData ? (r.notes ?? null) : null,
        updatedAt: r.updated_at,
        archivedAt: r.archived_at ?? null,
        isActive: r.is_active,
        supervisorId: r.supervisor_id ?? null,
    }));
});
export const mk9ListRoutesDetailed = createServerFn({ method: "POST" })
    .inputValidator((data) => z
    .object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2100),
})
    .parse(data))
    .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (scope.allowedIndustryIds?.length === 0 ||
        scope.allowedStoreIds?.length === 0 ||
        scope.allowedUfs?.length === 0)
        return [];
    let q = supabaseAdmin
        .from("mk9_planned_routes")
        .select("id, weekday, operation_month, operation_year, source_sheet, promoter:mk9_promoters(id,name,city), store:mk9_stores(id,name,chain,uf), industry:mk9_industries(id,name)")
        .eq("operation_month", data.month)
        .eq("operation_year", data.year);
    if (scope.allowedIndustryIds)
        q = q.in("industry_id", scope.allowedIndustryIds);
    if (scope.allowedStoreIds)
        q = q.in("store_id", scope.allowedStoreIds);
    if (scope.allowedPromoterIds)
        q = q.in("promoter_id", scope.allowedPromoterIds);
    const { data: allRows, error } = await q;
    if (error)
        throw new Error(error.message);
    const rows = (allRows ?? []).filter((r) => !scope.allowedUfs || (r.store?.uf && scope.allowedUfs.includes(r.store.uf)));
    return (rows ?? []).map((r) => ({
        id: r.id,
        weekday: r.weekday,
        sourceSheet: r.source_sheet ?? null,
        promoterId: r.promoter?.id ?? null,
        promoterName: r.promoter?.name ?? "—",
        promoterCity: r.promoter?.city ?? null,
        storeId: r.store?.id ?? null,
        storeName: r.store?.name ?? "—",
        storeChain: r.store?.chain ?? null,
        storeUf: r.store?.uf ?? null,
        industryId: r.industry?.id ?? null,
        industryName: r.industry?.name ?? "—",
    }));
});
export const mk9ListVisitsDetailed = createServerFn({ method: "POST" })
    .inputValidator((data) => z
    .object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2100),
})
    .parse(data))
    .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (scope.allowedIndustryIds?.length === 0 ||
        scope.allowedStoreIds?.length === 0 ||
        scope.allowedUfs?.length === 0)
        return [];
    const first = new Date(Date.UTC(data.year, data.month - 1, 1)).toISOString().slice(0, 10);
    const last = new Date(Date.UTC(data.year, data.month, 0)).toISOString().slice(0, 10);
    let q = supabaseAdmin
        .from("mk9_planned_visits")
        .select("id, scheduled_date, status, source_sheet, promoter:mk9_promoters(id,name), store:mk9_stores(id,name,chain,uf), industry:mk9_industries(id,name)")
        .gte("scheduled_date", first)
        .lte("scheduled_date", last)
        .is("archived_at", null)
        .order("scheduled_date", { ascending: true })
        .limit(5000);
    if (scope.allowedIndustryIds)
        q = q.in("industry_id", scope.allowedIndustryIds);
    if (scope.allowedStoreIds)
        q = q.in("store_id", scope.allowedStoreIds);
    if (scope.allowedPromoterIds)
        q = q.in("promoter_id", scope.allowedPromoterIds);
    const { data: allRows, error } = await q;
    if (error)
        throw new Error(error.message);
    const rows = (allRows ?? []).filter((r) => !scope.allowedUfs || (r.store?.uf && scope.allowedUfs.includes(r.store.uf)));
    return (rows ?? []).map((r) => ({
        id: r.id,
        scheduledDate: r.scheduled_date,
        status: r.status,
        sourceSheet: r.source_sheet ?? null,
        promoterName: r.promoter?.name ?? "—",
        storeName: r.store?.name ?? "—",
        storeChain: r.store?.chain ?? null,
        storeUf: r.store?.uf ?? null,
        industryName: r.industry?.name ?? "—",
    }));
});
export const mk9DashboardContractMetrics = createServerFn({ method: "POST" })
    .inputValidator((data) => z
    .object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2100),
})
    .parse(data))
    .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveWindow } = await import("@/lib/mk9-reports/period.server");
    const empty = {
        contratadas: 0,
        executadas: 0,
        validas: 0,
        extras: 0,
        pendencias: 0,
        coverage: 0,
    };
    if (scope.allowedIndustryIds?.length === 0 ||
        scope.allowedStoreIds?.length === 0 ||
        scope.allowedUfs?.length === 0)
        return empty;
    // Fase 1B.3: contratadas vêm da frequência VERSIONADA, com a mesma
    // matemática proporcional do Dashboard/Auditoria/Relatório.
    // A antiga fórmula `weekly × 4` foi eliminada.
    const { contractedVisitsForFrequencySegments } = await import("@/lib/mk9-frequency/segments");
    const { loadFrequencyVersionsForPeriod, segmentsForWindow } = await import("@/lib/mk9-frequency/versions.server");
    let indQuery = supabaseAdmin.from("mk9_industries").select("id").limit(20000);
    if (scope.allowedIndustryIds)
        indQuery = indQuery.in("id", scope.allowedIndustryIds);
    const [{ data: industryRows, error: indError }, { data: configs, error: configError }] = await Promise.all([
        indQuery,
        supabaseAdmin
            .from("mk9_industry_period_config")
            .select("industry_id, period_type, start_day, end_day, uses_previous_month, week_grouping")
            .eq("active", true)
            .limit(20000),
    ]);
    if (indError)
        throw new Error(indError.message);
    if (configError)
        throw new Error(configError.message);
    const industryIds = (industryRows ?? []).map((i) => i.id);
    if (!industryIds.length)
        return empty;
    const configByIndustry = new Map();
    for (const cfg of configs ?? [])
        configByIndustry.set(cfg.industry_id, cfg);
    const windows = new Map();
    for (const industryId of industryIds) {
        const cfg = configByIndustry.get(industryId) ?? {
            industryId,
            periodType: "CALENDAR_MONTH",
            startDay: 1,
            endDay: 31,
            usesPreviousMonth: false,
            weekGrouping: "CALENDAR_WEEK",
            active: true,
        };
        windows.set(industryId, resolveWindow(cfg, data.year, data.month));
    }
    const globalStart = Array.from(windows.values()).reduce((a, w) => (w.startDate < a ? w.startDate : a), `${data.year}-12-31`);
    const globalEnd = Array.from(windows.values()).reduce((a, w) => (w.endDate > a ? w.endDate : a), `${data.year}-01-01`);
    const freqVersions = await loadFrequencyVersionsForPeriod(supabaseAdmin, {
        industryIds,
        storeIds: scope.allowedStoreIds,
        periodStart: globalStart,
        periodEnd: globalEnd,
        accessScope: scope,
    });
    const perStore = new Map();
    for (const [key, segs] of freqVersions) {
        const industryId = key.slice(0, key.indexOf("|"));
        const win = windows.get(industryId);
        if (!win)
            continue;
        const inWindow = segmentsForWindow(segs, win.startDate, win.endDate);
        if (!inWindow.length)
            continue;
        const contracted = contractedVisitsForFrequencySegments({
            segments: inWindow,
            operationPeriodStart: win.startDate,
            operationPeriodEnd: win.endDate,
        });
        perStore.set(key, { contratadas: contracted.contratadas, executadas: 0 });
    }
    const scopedStoreIds = new Set(perStore.keys());
    const actualQueries = Array.from(windows.entries()).map(([industryId, window]) => supabaseAdmin
        .from("mk9_actual_visits")
        .select("industry_id, store_id, scheduled_date")
        .eq("industry_id", industryId)
        .gte("scheduled_date", window.startDate)
        .lte("scheduled_date", window.endDate)
        .limit(20000));
    const actualResults = await Promise.all(actualQueries);
    const actuals = [];
    for (const result of actualResults) {
        if (result.error)
            throw new Error(result.error.message);
        // Extras fora do escopo não podem vazar para os totais.
        actuals.push(...(result.data ?? []).filter((a) => scopedStoreIds.has(`${a.industry_id}|${a.store_id}`)));
    }
    for (const a of actuals) {
        const key = `${a.industry_id}|${a.store_id}`;
        const cur = perStore.get(key) ?? { contratadas: 0, executadas: 0 };
        cur.executadas += 1;
        perStore.set(key, cur);
    }
    let contratadas = 0;
    let executadas = 0;
    let extras = 0;
    for (const s of perStore.values()) {
        contratadas += s.contratadas;
        executadas += s.executadas;
        extras += Math.max(0, s.executadas - s.contratadas);
    }
    // Nova regra: realizadas é o total bruto do checklist (nunca reduzido).
    // Pendentes e cobertura globais usam contratadas - realizadas.
    const pendencias = Math.max(0, contratadas - executadas);
    const validas = Math.min(contratadas, executadas);
    const coverage = contratadas > 0 ? Math.min(100, Math.round((executadas / contratadas) * 100)) : 0;
    return { contratadas, executadas, validas, extras, pendencias, coverage };
});
