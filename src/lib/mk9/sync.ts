// Camada de sincronização: recebe o IR do parser + snapshot do banco
// e devolve o plano de mudanças (preview) + o payload persistível.
// PURA. Nenhuma dependência de banco. Testável isoladamente.
import type { ParsedWorkbook } from "./parser";
import type {
  IndustryRecord,
  PromoterRecord,
  StoreRecord,
  PlannedRouteRecord,
  PlannedVisitRecord,
  ImportItem,
  ImportPreview,
  PreviewCounters,
  SyncMode,
  Weekday,
} from "./types";
import { resolveIndustry, resolvePromoter, resolveStore } from "./resolution";
import { computeIndustryStatus, datesForWeekdayInMonth } from "./business/dates";
import { normalizeName } from "./normalization";

export interface DbSnapshot {
  industries: IndustryRecord[];
  stores: StoreRecord[];
  promoters: PromoterRecord[];
  plannedRoutes: PlannedRouteRecord[];
  plannedVisits: PlannedVisitRecord[]; // apenas as do período/futuras
}

export interface SyncPlan {
  preview: ImportPreview;
  toUpsert: {
    industries: IndustryRecord[];
    stores: StoreRecord[];
    promoters: PromoterRecord[];
    routes: PlannedRouteRecord[];
    visits: PlannedVisitRecord[];
  };
  toRemove: {
    routeIds: string[];
    visitIds: string[];
  };
}

export interface BuildPlanInput {
  parsed: ParsedWorkbook;
  snapshot: DbSnapshot;
  operationMonth: number;
  operationYear: number;
  syncMode: SyncMode;
}

const emptyCounters = (): PreviewCounters => ({
  industriesCreated: 0, industriesUpdated: 0,
  storesCreated: 0, storesUpdated: 0,
  promotersCreated: 0, promotersUpdated: 0,
  routesCreated: 0, routesUpdated: 0, routesKept: 0, routesRemoved: 0,
  visitsCreated: 0, visitsUpdated: 0, visitsKept: 0, visitsRemoved: 0, visitsPreserved: 0,
  duplicates: 0, invalid: 0, ambiguous: 0, conflicts: 0,
});

export function buildSyncPlan(input: BuildPlanInput): SyncPlan {
  const { parsed, snapshot, operationMonth, operationYear, syncMode } = input;
  const items: ImportItem[] = [];
  const counters = emptyCounters();

  const industriesOut: IndustryRecord[] = [];
  const storesOut: StoreRecord[] = [];
  const promotersOut: PromoterRecord[] = [];

  // trabalhamos com maps mutáveis (nome normalizado -> record) para
  // permitir que rotas criem cadastros novos e resolvam depois.
  const industryMap = new Map<string, IndustryRecord>();
  snapshot.industries.forEach((r) => industryMap.set(r.nameNormalized, r));
  const storeMap = new Map<string, StoreRecord>();
  snapshot.stores.forEach((r) => storeMap.set(storeKey(r.nameNormalized, r.uf), r));
  const promoterMap = new Map<string, PromoterRecord>();
  snapshot.promoters.forEach((r) => promoterMap.set(r.nameNormalized, r));

  // ---- INDÚSTRIAS ----
  for (const p of parsed.industries) {
    const existing = industryMap.get(p.nameNormalized);
    const contracted = p.monthlyContractedFrequency ?? existing?.monthlyContractedFrequency ?? null;
    const estimated = p.monthlyEstimatedFrequency ?? existing?.monthlyEstimatedFrequency ?? null;
    const { status, diff } = computeIndustryStatus(contracted, estimated);
    const record: IndustryRecord = {
      id: existing?.id,
      name: p.name,
      nameNormalized: p.nameNormalized,
      monthlyContractedFrequency: contracted,
      monthlyEstimatedFrequency: estimated,
      frequencyDifference: diff,
      frequencyStatus: status,
      weeksCount: p.weeksCount ?? existing?.weeksCount ?? null,
    };
    industryMap.set(p.nameNormalized, record);
    industriesOut.push(record);
    if (existing) {
      counters.industriesUpdated++;
      items.push({ sheet: p.sourceSheet, excelRow: p.excelRow, entityType: "industry", action: "update", payload: record as unknown as Record<string, unknown> });
    } else {
      counters.industriesCreated++;
      items.push({ sheet: p.sourceSheet, excelRow: p.excelRow, entityType: "industry", action: "create", payload: record as unknown as Record<string, unknown> });
    }
  }

  // ---- LOJAS ----
  for (const p of parsed.stores) {
    const key = storeKey(p.nameNormalized, p.uf);
    const existing = storeMap.get(key);
    const record: StoreRecord = {
      id: existing?.id,
      chain: p.chain ?? existing?.chain ?? null,
      name: p.name,
      nameNormalized: p.nameNormalized,
      uf: p.uf ?? existing?.uf ?? null,
    };
    storeMap.set(key, record);
    storesOut.push(record);
    if (existing) {
      counters.storesUpdated++;
      items.push({ sheet: p.sourceSheet, excelRow: p.excelRow, entityType: "store", action: "update", payload: record as unknown as Record<string, unknown> });
    } else {
      counters.storesCreated++;
      items.push({ sheet: p.sourceSheet, excelRow: p.excelRow, entityType: "store", action: "create", payload: record as unknown as Record<string, unknown> });
    }
  }

  // ---- PROMOTORES ----
  for (const p of parsed.promoters) {
    // preferir external id
    let existing = p.externalId ? snapshot.promoters.find((x) => x.externalId === p.externalId) : undefined;
    if (!existing) existing = promoterMap.get(p.nameNormalized);
    const record: PromoterRecord = {
      id: existing?.id,
      externalId: p.externalId ?? existing?.externalId ?? null,
      name: p.name || existing?.name || "",
      nameNormalized: p.nameNormalized || existing?.nameNormalized || "",
      city: p.city ?? existing?.city ?? null,
      contact: p.contact ?? existing?.contact ?? null,
      contactNormalized: p.contactNormalized ?? existing?.contactNormalized ?? null,
      notes: p.notes ?? existing?.notes ?? null,
    };
    promoterMap.set(record.nameNormalized, record);
    promotersOut.push(record);
    if (existing) {
      counters.promotersUpdated++;
      items.push({ sheet: p.sourceSheet, excelRow: p.excelRow, entityType: "promoter", action: "update", payload: record as unknown as Record<string, unknown> });
    } else {
      counters.promotersCreated++;
      items.push({ sheet: p.sourceSheet, excelRow: p.excelRow, entityType: "promoter", action: "create", payload: record as unknown as Record<string, unknown> });
    }
  }

  // se modo somente cadastros, para aqui
  const routesOut: PlannedRouteRecord[] = [];
  const visitsOut: PlannedVisitRecord[] = [];
  const removedRouteIds: string[] = [];
  const removedVisitIds: string[] = [];

  if (syncMode !== "registry_only") {
    // ---- ROTAS + VISITAS ----
    // set das rotas geradas para diff com o snapshot
    const generatedRouteKeys = new Set<string>();
    const generatedVisitKeys = new Set<string>();

    // dedup de linhas do roteiro na própria planilha
    const seenRouteLine = new Set<string>();

    for (const line of parsed.routes) {
      if (!line.weekdays.length) continue;

      // resolve indústria
      const iRes = resolveIndustry(line.industryName, industriesOut.length ? industriesOut : Array.from(industryMap.values()));
      const sRes = resolveStore(line.storeName, line.uf ?? null, null, storesOut.length ? storesOut : Array.from(storeMap.values()));
      const pRes = resolvePromoter(line.promoterName, null, null, promotersOut.length ? promotersOut : Array.from(promoterMap.values()));

      // criar automaticamente entidades ausentes (se houver nome)
      let industry = iRes.match;
      if (!industry && !iRes.ambiguous && line.industryName) {
        industry = {
          name: line.industryName,
          nameNormalized: line.industryNormalized,
          monthlyContractedFrequency: null,
          monthlyEstimatedFrequency: null,
          frequencyDifference: null,
          frequencyStatus: "SEM META",
          weeksCount: null,
        };
        industryMap.set(industry.nameNormalized, industry);
        industriesOut.push(industry);
        counters.industriesCreated++;
        items.push({ sheet: line.sourceSheet, excelRow: line.excelRow, entityType: "industry", action: "create", payload: industry as unknown as Record<string, unknown>, warnings: ["Criado a partir do roteiro"] });
      }

      let store = sRes.match;
      if (!store && !sRes.ambiguous && line.storeName) {
        store = {
          chain: null, name: line.storeName,
          nameNormalized: line.storeNormalized, uf: line.uf ?? null,
        };
        storeMap.set(storeKey(store.nameNormalized, store.uf), store);
        storesOut.push(store);
        counters.storesCreated++;
        items.push({ sheet: line.sourceSheet, excelRow: line.excelRow, entityType: "store", action: "create", payload: store as unknown as Record<string, unknown>, warnings: ["Criado a partir do roteiro"] });
      }

      let promoter = pRes.match;
      if (!promoter && !pRes.ambiguous && line.promoterName) {
        promoter = {
          name: line.promoterName,
          nameNormalized: line.promoterNormalized,
        };
        promoterMap.set(promoter.nameNormalized, promoter);
        promotersOut.push(promoter);
        counters.promotersCreated++;
        items.push({ sheet: line.sourceSheet, excelRow: line.excelRow, entityType: "promoter", action: "create", payload: promoter as unknown as Record<string, unknown>, warnings: ["Criado a partir do roteiro"] });
      }

      if (iRes.ambiguous || sRes.ambiguous || pRes.ambiguous) {
        counters.ambiguous++;
        items.push({
          sheet: line.sourceSheet, excelRow: line.excelRow, entityType: "route", action: "ambiguous",
          payload: { industryName: line.industryName, storeName: line.storeName, promoterName: line.promoterName, weekdays: line.weekdays },
          warnings: [
            iRes.ambiguous ? "Indústria ambígua" : "",
            sRes.ambiguous ? "Loja ambígua" : "",
            pRes.ambiguous ? "Promotor ambíguo" : "",
          ].filter(Boolean),
        });
        continue;
      }

      if (!industry || !store || !promoter) {
        counters.invalid++;
        items.push({
          sheet: line.sourceSheet, excelRow: line.excelRow, entityType: "route", action: "invalid",
          payload: { industryName: line.industryName, storeName: line.storeName, promoterName: line.promoterName },
          warnings: ["Faltam dados obrigatórios (indústria/loja/promotor)"],
        });
        continue;
      }

      for (const weekday of line.weekdays) {
        const dedupKey = `${industry.nameNormalized}|${storeKey(store.nameNormalized, store.uf)}|${promoter.nameNormalized}|${weekday}`;
        if (seenRouteLine.has(dedupKey)) {
          counters.duplicates++;
          items.push({
            sheet: line.sourceSheet, excelRow: line.excelRow, entityType: "route", action: "duplicate",
            payload: { weekday }, warnings: ["Duplicado na planilha"],
          });
          continue;
        }
        seenRouteLine.add(dedupKey);

        const routeKey = logicalRouteKey(promoter, store, industry, weekday, operationMonth, operationYear);
        generatedRouteKeys.add(routeKey);

        const existingRoute = snapshot.plannedRoutes.find(
          (r) => logicalRouteKey(
            findById(promotersOut, snapshot.promoters, r.promoterId),
            findById(storesOut, snapshot.stores, r.storeId),
            findById(industriesOut, snapshot.industries, r.industryId),
            r.weekday, r.operationMonth, r.operationYear,
          ) === routeKey,
        );

        const record: PlannedRouteRecord = {
          id: existingRoute?.id,
          promoterId: promoter.id ?? `pending:${promoter.nameNormalized}`,
          storeId: store.id ?? `pending:${storeKey(store.nameNormalized, store.uf)}`,
          industryId: industry.id ?? `pending:${industry.nameNormalized}`,
          weekday: weekday as Weekday,
          operationMonth,
          operationYear,
          sourceSheet: line.sourceSheet,
        };
        routesOut.push(record);
        if (existingRoute) {
          counters.routesKept++;
          items.push({ sheet: line.sourceSheet, excelRow: line.excelRow, entityType: "route", action: "keep", payload: { weekday } });
        } else {
          counters.routesCreated++;
          items.push({ sheet: line.sourceSheet, excelRow: line.excelRow, entityType: "route", action: "create", payload: { weekday, industry: industry.name, store: store.name, promoter: promoter.name } });
        }

        // visitas do mês para este weekday
        const dates = datesForWeekdayInMonth(operationYear, operationMonth, weekday as Weekday);
        for (const date of dates) {
          const vKey = `${record.promoterId}|${record.storeId}|${record.industryId}|${date}`;
          if (generatedVisitKeys.has(vKey)) continue;
          generatedVisitKeys.add(vKey);
          const existingVisit = snapshot.plannedVisits.find(
            (v) => v.scheduledDate === date
              && (findById(promotersOut, snapshot.promoters, v.promoterId)?.nameNormalized === promoter!.nameNormalized)
              && (findById(storesOut, snapshot.stores, v.storeId)?.nameNormalized === store!.nameNormalized)
              && (findById(industriesOut, snapshot.industries, v.industryId)?.nameNormalized === industry!.nameNormalized),
          );
          if (existingVisit && existingVisit.status !== "planned") {
            counters.visitsPreserved++;
            items.push({ sheet: line.sourceSheet, entityType: "visit", action: "preserved", payload: { date, status: existingVisit.status } });
            continue;
          }
          visitsOut.push({
            id: existingVisit?.id,
            promoterId: record.promoterId,
            storeId: record.storeId,
            industryId: record.industryId,
            scheduledDate: date,
            status: "planned",
            sourceSheet: line.sourceSheet,
          });
          if (existingVisit) counters.visitsKept++;
          else counters.visitsCreated++;
        }
      }
    }

    // ---- REMOÇÕES (modo full) ----
    if (syncMode === "full") {
      // rotas presentes no snapshot mas não geradas
      for (const r of snapshot.plannedRoutes) {
        const key = logicalRouteKey(
          findById(promotersOut, snapshot.promoters, r.promoterId),
          findById(storesOut, snapshot.stores, r.storeId),
          findById(industriesOut, snapshot.industries, r.industryId),
          r.weekday, r.operationMonth, r.operationYear,
        );
        if (!generatedRouteKeys.has(key) && r.id) {
          removedRouteIds.push(r.id);
          counters.routesRemoved++;
          items.push({ sheet: "sistema", entityType: "route", action: "remove", payload: { routeId: r.id } });
        }
      }
      // visitas planejadas do mês que não estão no plano — remover
      // preservar realizadas (status != planned)
      const generatedVisitLogicalKeys = new Set(
        visitsOut.map((v) => `${resolveLogicalId(v.promoterId, promotersOut, snapshot.promoters)}|${resolveLogicalId(v.storeId, storesOut, snapshot.stores)}|${resolveLogicalId(v.industryId, industriesOut, snapshot.industries)}|${v.scheduledDate}`),
      );
      for (const v of snapshot.plannedVisits) {
        if (v.status !== "planned") continue;
        const key = `${findById(promotersOut, snapshot.promoters, v.promoterId)?.nameNormalized}|${findById(storesOut, snapshot.stores, v.storeId)?.nameNormalized}|${findById(industriesOut, snapshot.industries, v.industryId)?.nameNormalized}|${v.scheduledDate}`;
        if (!generatedVisitLogicalKeys.has(key) && v.id) {
          removedVisitIds.push(v.id);
          counters.visitsRemoved++;
        }
      }
    }
  }

  const preview: ImportPreview = {
    filename: parsed.filename,
    operationMonth,
    operationYear,
    syncMode,
    sheetsAnalyzed: parsed.sheetsAnalyzed,
    counters,
    items,
  };

  return {
    preview,
    toUpsert: {
      industries: industriesOut,
      stores: storesOut,
      promoters: promotersOut,
      routes: routesOut,
      visits: visitsOut,
    },
    toRemove: {
      routeIds: removedRouteIds,
      visitIds: removedVisitIds,
    },
  };
}

// ---- helpers ----
function storeKey(nameNormalized: string, uf: string | null | undefined): string {
  return `${nameNormalized}::${uf ?? ""}`;
}
function logicalRouteKey(
  promoter: PromoterRecord | undefined | null,
  store: StoreRecord | undefined | null,
  industry: IndustryRecord | undefined | null,
  weekday: number, month: number, year: number,
): string {
  return `${promoter?.nameNormalized ?? "?"}|${store?.nameNormalized ?? "?"}|${store?.uf ?? ""}|${industry?.nameNormalized ?? "?"}|${weekday}|${month}|${year}`;
}
function findById<T extends { id?: string }>(fresh: T[], snap: T[], id: string | undefined): T | undefined {
  if (!id) return undefined;
  return fresh.find((x) => x.id === id) ?? snap.find((x) => x.id === id);
}
function resolveLogicalId<T extends { id?: string; nameNormalized?: string }>(
  ref: string, fresh: T[], snap: T[],
): string | undefined {
  if (ref.startsWith("pending:")) return ref.slice("pending:".length);
  return (fresh.find((x) => x.id === ref) ?? snap.find((x) => x.id === ref))?.nameNormalized;
}
// silence linter about unused normalizeName import in future refactors
void normalizeName;
