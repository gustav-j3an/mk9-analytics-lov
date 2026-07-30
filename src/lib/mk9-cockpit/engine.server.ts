/**
 * MK9 — Cockpit Operacional (Fase 3.1B): motor do payload.
 *
 * O Cockpit NÃO recalcula operação: ele lê o MESMO núcleo do Dashboard
 * (`src/lib/mk9-operations`) e apenas interpreta — saúde, prioridades e
 * previsão. Por isso contratadas/realizadas batem número a número.
 *
 * Ele acrescenta uma leitura: ocorrências abertas do Centro de Qualidade
 * (bloqueantes e vencidas), sempre respeitando o escopo do usuário.
 */
import { countIndustriesMissingChecklist } from "@/lib/mk9-checklist/industry-gate";
import { toWeeklySeries, buildDailySeries } from "@/lib/mk9-operations/buckets";
import { loadOperationCore } from "@/lib/mk9-operations/core.server";
import { addDays, elapsedDays, pct, periodLabel } from "@/lib/mk9-operations/periods";
import type { OperationFilters } from "@/lib/mk9-operations/types";

import { evaluateHealth } from "./health";
import { forecastClose } from "./forecast";
import { rankPriorities, scoreFor } from "./priorities";
import { buildPromoterAttention, quickActionsForRole } from "./view";
import type {
  Mk9CockpitIndustry,
  Mk9CockpitOverview,
  Mk9CockpitViewer,
  Mk9PriorityItem,
  Mk9TimelineEvent,
} from "./types";

const OPEN_STATUSES = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "REOPENED"];

interface QualitySnapshot {
  open: number;
  overdue: number;
  blocking: number;
  unassigned: number;
  openByIndustry: Map<string, number>;
  recent?: Array<{ id: string; at: string; kind: "OCORRENCIA_DETECTADA"; description: string; industryId: string | null }>;
  topItems: Array<{
    id: string;
    title: string;
    severity: string;
    industryId: string | null;
    storeId: string | null;
    dueAt: string | null;
    overdueDays: number;
  }>;
}

async function loadQuality(
  supabase: any,
  filters: OperationFilters,
  industryIds: string[],
  today: string,
): Promise<QualitySnapshot> {
  const snap: QualitySnapshot = {
    open: 0,
    overdue: 0,
    blocking: 0,
    unassigned: 0,
    openByIndustry: new Map(),
    topItems: [],
  };
  if (!industryIds.length) return snap;

  let q = supabase
    .from("mk9_data_quality_issues")
    .select("id, title, severity, status, due_at, industry_id, store_id, assigned_to_user_id, first_detected_at, competence_month, competence_year")
    .in("status", OPEN_STATUSES)
    .is("archived_at", null)
    .in("industry_id", industryIds)
    .limit(5000);

  const allowedStoreIds = filters.access?.allowedStoreIds ?? null;
  if (allowedStoreIds) q = q.or(`store_id.is.null,store_id.in.(${allowedStoreIds.join(",")})`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    snap.open += 1;
    if (!row.assigned_to_user_id) snap.unassigned += 1;
    if (row.industry_id) {
      snap.openByIndustry.set(row.industry_id, (snap.openByIndustry.get(row.industry_id) ?? 0) + 1);
    }
    const blocking = String(row.severity).toUpperCase() === "BLOQUEANTE";
    if (blocking) snap.blocking += 1;
    const dueAt = row.due_at ? String(row.due_at).slice(0, 10) : null;
    const overdue = Boolean(dueAt && dueAt < today);
    if (overdue) snap.overdue += 1;
    if (blocking || overdue) {
      snap.topItems.push({
        id: row.id,
        title: row.title,
        severity: String(row.severity).toUpperCase(),
        industryId: row.industry_id ?? null,
        storeId: row.store_id ?? null,
        dueAt,
        overdueDays: overdue && dueAt ? Math.max(0, Math.round((Date.parse(today) - Date.parse(dueAt)) / 86400000)) : 0,
      });
    }
  }
  snap.recent = (data ?? [])
    .filter((r: any) => r.first_detected_at)
    .sort((a: any, b: any) => String(b.first_detected_at).localeCompare(String(a.first_detected_at)))
    .slice(0, 8)
    .map((r: any) => ({
      id: `issue-${r.id}`,
      at: String(r.first_detected_at),
      kind: "OCORRENCIA_DETECTADA" as const,
      description: String(r.title),
      industryId: r.industry_id ?? null,
    }));
  return snap;
}

async function loadRecentImports(supabase: any, industryIds: string[]) {
  if (!industryIds.length) return [] as Array<{ id: string; at: string; status: string; industryId: string | null }>;
  const { data, error } = await supabase
    .from("mk9_checklist_imports")
    .select("id, industry_id, status, created_at")
    .in("industry_id", industryIds)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: `import-${r.id}`,
    at: String(r.created_at),
    status: String(r.status),
    industryId: r.industry_id ?? null,
  }));
}

async function countFailedImports(supabase: any, filters: OperationFilters, industryIds: string[]): Promise<number> {
  if (!industryIds.length) return 0;
  const { count, error } = await supabase
    .from("mk9_checklist_imports")
    .select("id", { count: "exact", head: true })
    .in("industry_id", industryIds)
    .eq("operation_month", filters.month)
    .eq("operation_year", filters.year)
    .eq("status", "failed");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function buildCockpitOverview(
  supabase: any,
  filters: OperationFilters,
  viewer: Mk9CockpitViewer = { role: "ADMIN", canViewImports: true, canViewPersonalData: true },
): Promise<Mk9CockpitOverview> {
  const startedAt = Date.now();
  const core = await loadOperationCore(supabase, filters);
  const { today, storeRows, industryRows, ctxs } = core;

  const [quality, failedImports, recentImports] = await Promise.all([
    loadQuality(supabase, filters, core.industryIds, today),
    countFailedImports(supabase, filters, core.industryIds),
    viewer.canViewImports ? loadRecentImports(supabase, core.industryIds) : Promise.resolve([]),
  ]);

  const contratadas = storeRows.reduce((a, s) => a + s.contratadas, 0);
  const realizadas = storeRows.reduce((a, s) => a + s.realizadas, 0);
  const expectedToDate = industryRows.reduce((a, i) => a + i.expectedToDate, 0);
  const pacePercentage = expectedToDate > 0 ? pct(realizadas, expectedToDate) : realizadas > 0 ? 100 : 0;
  const lojasSemVisita = storeRows.filter((s) => s.contratadas > 0 && s.realizadas === 0).length;
  const industriasEmRisco = industryRows.filter(
    (i) => i.status === "CRITICA" || i.status === "SEM_CHECKLIST" || i.status === "SEM_FREQUENCIA",
  ).length;

  const health = evaluateHealth({
    pacePercentage,
    expectedToDate,
    realizedToDate: realizadas,
    blockingIssues: quality.blocking,
    overdueIssues: quality.overdue,
    failedImports,
  });

  // ---- previsão: ritmo recente (14 dias) vs ritmo do período ----------------
  const recentStart = addDays(today, -13);
  let realizedLastTwoWeeks = 0;
  for (const s of storeRows) {
    const bucket = core.ctxById.get(s.industryId)?.buckets.get(s.storeId);
    for (const d of bucket?.visits ?? []) if (d >= recentStart && d <= today) realizedLastTwoWeeks += 1;
  }
  const totalDays = ctxs.length ? Math.max(...ctxs.map((c) => c.win.totalDays)) : 30;
  const elapsed = ctxs.length ? Math.max(...ctxs.map((c) => elapsedDays(c.win, today))) : 0;
  const forecast = forecastClose({
    contracted: contratadas,
    realizedToDate: realizadas,
    realizedLastTwoWeeks,
    elapsedDays: elapsed,
    totalDays,
  });

  // ---- prioridades ----------------------------------------------------------
  const candidates: Mk9PriorityItem[] = [];
  const industryName = (id: string | null) =>
    industryRows.find((i) => i.industryId === id)?.industryName ?? "Indústria";

  for (const item of quality.topItems) {
    const blocking = item.severity === "BLOQUEANTE";
    const kind = blocking ? "OCORRENCIA_BLOQUEANTE" : "OCORRENCIA_VENCIDA";
    const impact = blocking ? 10 : item.overdueDays;
    candidates.push({
      id: `issue-${item.id}`,
      kind,
      score: scoreFor(kind, impact),
      title: item.title,
      description: blocking
        ? `Ocorrência bloqueante em ${industryName(item.industryId)}.`
        : `Prazo vencido há ${item.overdueDays} dia(s) em ${industryName(item.industryId)}.`,
      impact,
      industryId: item.industryId,
      storeId: item.storeId,
      promoterId: null,
      deepLink: `/?module=quality&issue=${item.id}`,
    });
  }

  if (failedImports > 0) {
    candidates.push({
      id: "imports-failed",
      kind: "IMPORTACAO_FALHA",
      score: scoreFor("IMPORTACAO_FALHA", failedImports),
      title: `${failedImports} importação(ões) de checklist com falha`,
      description: "Os números da competência podem estar incompletos até a reimportação.",
      impact: failedImports,
      industryId: null,
      storeId: null,
      promoterId: null,
      deepLink: "/?module=checklists",
    });
  }

  for (const i of industryRows.filter((x) => x.status === "CRITICA" || x.status === "SEM_CHECKLIST")) {
    const impact = Math.max(0, i.expectedToDate - i.realizadas);
    candidates.push({
      id: `industry-${i.industryId}`,
      kind: "INDUSTRIA_CRITICA",
      score: scoreFor("INDUSTRIA_CRITICA", impact),
      title: `${i.industryName} em risco (${i.pacePercentage}% do ritmo)`,
      description: `${i.realizadas} de ${i.expectedToDate} visitas esperadas até hoje · ${impact} em risco.`,
      impact,
      industryId: i.industryId,
      storeId: null,
      promoterId: null,
      deepLink: `/?module=audit&industry=${i.industryId}`,
    });
  }

  const semVisita = storeRows
    .filter((s) => s.contratadas > 0 && s.realizadas === 0)
    .sort((a, b) => b.contratadas - a.contratadas)
    .slice(0, 10);
  for (const s of semVisita) {
    candidates.push({
      id: `store-${s.industryId}-${s.storeId}`,
      kind: "LOJA_SEM_VISITA",
      score: scoreFor("LOJA_SEM_VISITA", s.contratadas),
      title: `${s.storeName} sem nenhuma visita`,
      description: `${s.industryName} · ${s.contratadas} contratadas · ${s.uf ?? "—"}`,
      impact: s.contratadas,
      industryId: s.industryId,
      storeId: s.storeId,
      promoterId: s.promoterId,
      deepLink: `/?module=audit&store=${s.storeId}`,
    });
  }

  const industries: Mk9CockpitIndustry[] = industryRows.map((i) => ({
    industryId: i.industryId,
    industryName: i.industryName,
    status: i.status,
    contratadas: i.contratadas,
    realizadas: i.realizadas,
    expectedToDate: i.expectedToDate,
    coberturaPct: i.coberturaPct,
    pacePercentage: i.pacePercentage,
    openIssues: quality.openByIndustry.get(i.industryId) ?? 0,
  }));

  const timeline: Mk9TimelineEvent[] = [
    ...recentImports.map((imp: any) => ({
      id: imp.id,
      at: imp.at,
      kind: "IMPORTACAO" as const,
      description: `Importação de checklist (${imp.status})`,
      industryName: imp.industryId ? industryName(imp.industryId) : null,
    })),
    ...(quality.recent ?? []).map((ev) => ({
      id: ev.id,
      at: ev.at,
      kind: ev.kind,
      description: ev.description,
      industryName: ev.industryId ? industryName(ev.industryId) : null,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const series = toWeeklySeries(
    buildDailySeries({
      ctxs,
      industryRows,
      storeRows,
      globalStart: core.globalStart,
      globalEnd: core.globalEnd,
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    today,
    periodLabel: periodLabel(filters.year, filters.month),
    windowStart: core.globalStart,
    windowEnd: core.globalEnd,
    health,
    kpis: {
      contratadas,
      realizadas,
      expectedToDate,
      pendentes: Math.max(0, contratadas - realizadas),
      coberturaPct: contratadas > 0 ? Math.min(100, pct(realizadas, contratadas)) : 0,
      pacePercentage,
      lojasSemVisita,
      industriasEmRisco,
      ocorrenciasAbertas: quality.open,
      ocorrenciasVencidas: quality.overdue,
    },
    forecast,
    priorities: rankPriorities(candidates),
    priorityMoreCount: Math.max(0, candidates.length - 5),
    industries,
    series,
    availableUfs: core.availableUfs,
    viewer,
    quickActions: quickActionsForRole(viewer.role),
    checklists: {
      imports: core.checklistImportsTotal,
      failedImports,
      // Só indústrias classificadas como "exige checklist" podem gerar alerta de ausência.
      industriesWithoutChecklist: countIndustriesMissingChecklist(core.ctxs, { month, year }),
      lastImportAt: recentImports[0]?.at ?? null,
    },
    quality: {
      open: quality.open,
      blocking: quality.blocking,
      overdue: quality.overdue,
      unassigned: quality.unassigned,
    },
    promoters: viewer.canViewPersonalData ? buildPromoterAttention(storeRows) : [],
    supervisors: {
      available: false,
      reason:
        "Indicador indisponível. Cadastre os escopos dos supervisores para acompanhar a equipe.",
    },
    timeline,
    perf: { totalMs: Math.round(Date.now() - startedAt), coreMs: core.coreMs, queryCount: core.queryCount + 2 },
  };
}
