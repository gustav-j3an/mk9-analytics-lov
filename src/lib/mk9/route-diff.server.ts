// Motor de diff de reimportação de rotas — SERVER-ONLY.
// Compara rotas geradas pelo importador (com IDs já resolvidos) com o snapshot
// vigente em (start-of-competency) e classifica cada item para que
// mk9_apply_route_diff aplique de forma transacional.
//
// Regra de prioridade:
//   1. MANUAL confirmado no sistema (nunca sobrescrito silenciosamente).
//   2. Importação da competência corrente.
//   3. Importação histórica anterior (fecha via valid_until).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  PlannedRouteRecord,
  RouteDiffItem,
  RouteDiffReport,
} from "./types";

interface DbRouteRow {
  id: string;
  promoter_id: string;
  store_id: string;
  industry_id: string;
  weekday: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  archived_at: string | null;
  source_type: string;
  source_import_id: string | null;
  last_manual_edit_at: string | null;
}

interface NameMaps {
  promoter: Map<string, string>;
  store: Map<string, { name: string; uf: string | null }>;
  industry: Map<string, string>;
}

const routeKey = (storeId: string, industryId: string, weekday: number) =>
  `${storeId}|${industryId}|${weekday}`;

const storeIndustryKey = (storeId: string, industryId: string) =>
  `${storeId}|${industryId}`;

function firstDayOfCompetency(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function coversDate(row: DbRouteRow, date: string): boolean {
  if (!row.is_active || row.archived_at) return false;
  if (row.valid_from > date) return false;
  if (row.valid_until && row.valid_until < date) return false;
  return true;
}

async function loadNameMaps(
  promoterIds: string[],
  storeIds: string[],
  industryIds: string[],
): Promise<NameMaps> {
  const [pRes, sRes, iRes] = await Promise.all([
    promoterIds.length
      ? supabaseAdmin.from("mk9_promoters").select("id,name").in("id", promoterIds)
      : Promise.resolve({ data: [] as any[] }),
    storeIds.length
      ? supabaseAdmin.from("mk9_stores").select("id,name,uf").in("id", storeIds)
      : Promise.resolve({ data: [] as any[] }),
    industryIds.length
      ? supabaseAdmin.from("mk9_industries").select("id,name").in("id", industryIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const promoter = new Map<string, string>();
  const store = new Map<string, { name: string; uf: string | null }>();
  const industry = new Map<string, string>();
  for (const r of pRes.data ?? []) promoter.set(r.id, r.name);
  for (const r of sRes.data ?? []) store.set(r.id, { name: r.name, uf: r.uf ?? null });
  for (const r of iRes.data ?? []) industry.set(r.id, r.name);
  return { promoter, store, industry };
}

export async function buildRouteDiff(
  incomingRoutes: PlannedRouteRecord[],
  operationMonth: number,
  operationYear: number,
): Promise<RouteDiffReport> {
  const competencyStart = firstDayOfCompetency(operationMonth, operationYear);

  // 1) Snapshot completo de rotas ativas para as chaves (store,industry) tocadas.
  //    Lemos todas as versões para detectar futuras/passadas.
  const storeIds = Array.from(new Set(incomingRoutes.map((r) => r.storeId)));
  const industryIds = Array.from(new Set(incomingRoutes.map((r) => r.industryId)));

  // Ampliar snapshot: também precisamos ver rotas ativas com essas mesmas chaves,
  // além das que possam estar apenas com valid_until anterior (para REMOVED_FROM_IMPORT).
  let dbRows: DbRouteRow[] = [];
  if (storeIds.length && industryIds.length) {
    const { data, error } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select(
        "id,promoter_id,store_id,industry_id,weekday,valid_from,valid_until,is_active,archived_at,source_type,source_import_id,last_manual_edit_at",
      )
      .in("store_id", storeIds)
      .in("industry_id", industryIds)
      .eq("is_active", true)
      .is("archived_at", null);
    if (error) throw error;
    dbRows = (data ?? []) as DbRouteRow[];
  }

  // 2) Índices auxiliares
  //    - por chave (store,industry,weekday) para casar UNCHANGED/CHANGED_PROMOTER
  //    - por (store,industry) para detectar CHANGED_WEEKDAY (mesmo promotor migrou de dia)
  //    - por chave completa para saber quais rotas do banco ficaram fora da planilha
  const dbByKey = new Map<string, DbRouteRow[]>();
  const dbByStoreIndustry = new Map<string, DbRouteRow[]>();
  for (const row of dbRows) {
    const k1 = routeKey(row.store_id, row.industry_id, row.weekday);
    const k2 = storeIndustryKey(row.store_id, row.industry_id);
    if (!dbByKey.has(k1)) dbByKey.set(k1, []);
    if (!dbByStoreIndustry.has(k2)) dbByStoreIndustry.set(k2, []);
    dbByKey.get(k1)!.push(row);
    dbByStoreIndustry.get(k2)!.push(row);
  }

  // 3) Nomes para renderização (best-effort)
  const promoterIdsAll = new Set<string>();
  incomingRoutes.forEach((r) => promoterIdsAll.add(r.promoterId));
  dbRows.forEach((r) => promoterIdsAll.add(r.promoter_id));
  const names = await loadNameMaps(
    Array.from(promoterIdsAll),
    storeIds,
    industryIds,
  );

  const items: RouteDiffItem[] = [];
  const seenIncomingKeys = new Set<string>();

  const mkItem = (
    kind: RouteDiffItem["kind"],
    incoming: PlannedRouteRecord | null,
    currentRow: DbRouteRow | null,
    reason?: string,
  ): RouteDiffItem => {
    const storeInfo = incoming
      ? names.store.get(incoming.storeId)
      : currentRow ? names.store.get(currentRow.store_id) : undefined;
    const industryId = incoming?.industryId ?? currentRow?.industry_id ?? "";
    const weekday = incoming?.weekday ?? currentRow?.weekday ?? 0;
    return {
      kind,
      currentRouteId: currentRow?.id ?? null,
      storeName: storeInfo?.name ?? null,
      storeUf: storeInfo?.uf ?? null,
      industryName: industryId ? (names.industry.get(industryId) ?? null) : null,
      weekday,
      currentPromoterId: currentRow?.promoter_id ?? null,
      currentPromoterName: currentRow
        ? (names.promoter.get(currentRow.promoter_id) ?? null)
        : null,
      incomingPromoterId: incoming?.promoterId ?? null,
      incomingPromoterName: incoming
        ? (names.promoter.get(incoming.promoterId) ?? null)
        : null,
      newRoute: incoming
        ? {
            promoter_id: incoming.promoterId,
            store_id: incoming.storeId,
            industry_id: incoming.industryId,
            weekday: incoming.weekday,
            operation_month: incoming.operationMonth,
            operation_year: incoming.operationYear,
            source_sheet: incoming.sourceSheet ?? null,
          }
        : null,
      competencyStart,
      reason,
    };
  };

  // 4) Classificar cada rota importada
  for (const inc of incomingRoutes) {
    const k1 = routeKey(inc.storeId, inc.industryId, inc.weekday);
    seenIncomingKeys.add(k1);

    // Existe versão MANUAL vigente que cobre o início da competência?
    const currentForKey = (dbByKey.get(k1) ?? []).filter((r) => coversDate(r, competencyStart));
    // Versão futura na mesma (store, industry, weekday) começando depois da competência?
    const futureForKey = (dbByKey.get(k1) ?? []).filter(
      (r) => r.valid_from > competencyStart,
    );

    // Versão vigente na (store, industry) qualquer dia da semana — pra CHANGED_WEEKDAY
    const currentSameStoreIndustry = (dbByStoreIndustry.get(storeIndustryKey(inc.storeId, inc.industryId)) ?? [])
      .filter((r) => coversDate(r, competencyStart));

    // MANUAL na mesma chave vigente → conflito manual
    const manualCurrent = currentForKey.find((r) => r.source_type === "MANUAL");
    if (manualCurrent) {
      items.push(
        mkItem(
          "MANUAL_CONFLICT",
          inc,
          manualCurrent,
          "Versão vigente foi editada manualmente no sistema.",
        ),
      );
      continue;
    }

    // Versão futura na mesma chave → conflito futuro
    if (futureForKey.length > 0) {
      items.push(
        mkItem(
          "FUTURE_VERSION_CONFLICT",
          inc,
          futureForKey[0],
          `Existe versão futura começando em ${futureForKey[0].valid_from}.`,
        ),
      );
      continue;
    }

    // Vigente com mesmo promotor → UNCHANGED
    const exactMatch = currentForKey.find((r) => r.promoter_id === inc.promoterId);
    if (exactMatch) {
      items.push(mkItem("UNCHANGED", inc, exactMatch));
      continue;
    }

    // Vigente com outro promotor → CHANGED_PROMOTER
    if (currentForKey.length > 0) {
      items.push(mkItem("CHANGED_PROMOTER", inc, currentForKey[0]));
      continue;
    }

    // Mesma (store, industry) tem rota vigente em OUTRO weekday com o MESMO promotor
    // que agora migrou para o novo weekday → CHANGED_WEEKDAY
    const weekdayShift = currentSameStoreIndustry.find(
      (r) => r.promoter_id === inc.promoterId && r.weekday !== inc.weekday,
    );
    if (weekdayShift) {
      items.push(mkItem("CHANGED_WEEKDAY", inc, weekdayShift));
      continue;
    }

    // Nada cobre → nova rota
    items.push(mkItem("NEW_ROUTE", inc, null));
  }

  // 5) Rotas do banco que ficaram fora da planilha (REMOVED_FROM_IMPORT / MANUAL_CONFLICT)
  //    Só analisamos rotas vigentes no start-of-competency e com source_type IMPORT.
  for (const row of dbRows) {
    if (!coversDate(row, competencyStart)) continue;
    const k1 = routeKey(row.store_id, row.industry_id, row.weekday);
    if (seenIncomingKeys.has(k1)) continue;
    if (row.source_type === "MANUAL") {
      // Não classifica como conflito de "remoção" — manual sempre preservado.
      continue;
    }
    items.push(mkItem("REMOVED_FROM_IMPORT", null, row));
  }

  const count = (k: RouteDiffItem["kind"]) => items.filter((i) => i.kind === k).length;
  return {
    competencyStart,
    totalIncoming: incomingRoutes.length,
    unchanged: count("UNCHANGED"),
    new: count("NEW_ROUTE"),
    changedPromoter: count("CHANGED_PROMOTER"),
    changedWeekday: count("CHANGED_WEEKDAY"),
    removed: count("REMOVED_FROM_IMPORT"),
    manualConflicts: count("MANUAL_CONFLICT"),
    futureConflicts: count("FUTURE_VERSION_CONFLICT"),
    items,
  };
}

// -----------------------------------------------------------------------------
// Aplica o diff via RPC transacional. Erro → rollback total (função plpgsql).
// -----------------------------------------------------------------------------
export async function applyRouteDiff(
  importId: string,
  report: RouteDiffReport,
  force: boolean,
): Promise<{ unchanged: number; new: number; changed: number; removed: number; skipped: number }> {
  const decisions = report.items.map((i) => ({
    kind: i.kind,
    current_route_id: i.currentRouteId,
    new_route: i.newRoute,
    competency_start: i.competencyStart,
  }));
  const { data, error } = await supabaseAdmin.rpc("mk9_apply_route_diff" as any, {
    _import_id: importId,
    _decisions: decisions as any,
    _force: force,
  });
  if (error) throw error;
  return data as any;
}
