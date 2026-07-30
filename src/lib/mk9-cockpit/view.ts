/**
 * MK9 — Cockpit (Fase 3.1C): derivações PURAS para a interface.
 *
 * Nada aqui recalcula operação: tudo parte de linhas já produzidas pelo
 * núcleo compartilhado (`src/lib/mk9-operations`). São apenas recortes de
 * apresentação — promotores que exigem atenção e ações rápidas por papel.
 */
import { pct } from "@/lib/mk9-operations/periods";
import type { OperationStoreRow } from "@/lib/mk9-operations/types";

import type { Mk9PromoterAttention, Mk9QuickAction } from "./types";

/** Compartilhamento de roteiro ambíguo acima disto = atribuição pouco confiável. */
export const AMBIGUOUS_WARNING_THRESHOLD = 30;

export function buildPromoterAttention(
  rows: OperationStoreRow[],
  limit = 5,
): Mk9PromoterAttention[] {
  const acc = new Map<
    string,
    Mk9PromoterAttention & { ambiguousStores: number; totalStores: number }
  >();

  for (const row of rows) {
    if (!row.promoterId) continue;
    const cur =
      acc.get(row.promoterId) ??
      ({
        promoterId: row.promoterId,
        promoterName: row.promoterName ?? "—",
        contratadas: 0,
        realizadas: 0,
        pendentes: 0,
        coberturaPct: 0,
        lojasSemVisita: 0,
        lastVisit: null,
        ambiguousShare: 0,
        industries: [],
        ambiguousStores: 0,
        totalStores: 0,
      } as Mk9PromoterAttention & { ambiguousStores: number; totalStores: number });

    cur.contratadas += row.contratadas;
    cur.realizadas += row.realizadas;
    cur.pendentes += row.pendentes;
    cur.totalStores += 1;
    if (row.promoterResolution === "AMBIGUOUS_ROUTE") cur.ambiguousStores += 1;
    if (row.contratadas > 0 && row.realizadas === 0) cur.lojasSemVisita += 1;
    if (row.lastVisit && (!cur.lastVisit || row.lastVisit > cur.lastVisit)) cur.lastVisit = row.lastVisit;
    if (!cur.industries.includes(row.industryName)) cur.industries.push(row.industryName);

    acc.set(row.promoterId, cur);
  }

  return Array.from(acc.values())
    .map((p) => ({
      promoterId: p.promoterId,
      promoterName: p.promoterName,
      contratadas: p.contratadas,
      realizadas: p.realizadas,
      pendentes: p.pendentes,
      coberturaPct: p.contratadas > 0 ? Math.min(100, pct(p.realizadas, p.contratadas)) : 0,
      lojasSemVisita: p.lojasSemVisita,
      lastVisit: p.lastVisit,
      ambiguousShare: p.totalStores > 0 ? pct(p.ambiguousStores, p.totalStores) : 0,
      industries: p.industries.slice(0, 3),
    }))
    .filter((p) => p.pendentes > 0 || p.lojasSemVisita > 0)
    .sort(
      (a, b) =>
        b.pendentes - a.pendentes ||
        b.lojasSemVisita - a.lojasSemVisita ||
        a.promoterName.localeCompare(b.promoterName),
    )
    .slice(0, limit);
}

const ACTION_CATALOG: Record<string, Mk9QuickAction> = {
  IMPORT_BASE: { id: "IMPORT_BASE", label: "Importar Base", target: "/?module=importacoes" },
  IMPORT_CHECKLIST: { id: "IMPORT_CHECKLIST", label: "Importar Checklist", target: "/?module=checklists" },
  AUDIT: { id: "AUDIT", label: "Auditoria", target: "/?module=audit" },
  QUALITY: { id: "QUALITY", label: "Qualidade", target: "/?module=quality" },
  ROUTES: { id: "ROUTES", label: "Roteiros", target: "/?module=roteiros" },
  REPORTS: { id: "REPORTS", label: "Relatórios", target: "/?module=relatorio_industria" },
};

/** Ações rápidas decididas SEMPRE no servidor, a partir do papel efetivo. */
export function quickActionsForRole(role: string): Mk9QuickAction[] {
  const ids: Record<string, string[]> = {
    ADMIN: ["IMPORT_BASE", "IMPORT_CHECKLIST", "AUDIT", "QUALITY", "ROUTES", "REPORTS"],
    DEV: ["IMPORT_BASE", "IMPORT_CHECKLIST", "AUDIT", "QUALITY", "ROUTES", "REPORTS"],
    SUPERVISOR: ["AUDIT", "QUALITY", "ROUTES", "REPORTS"],
    AUDITOR: ["AUDIT", "QUALITY", "REPORTS"],
    CLIENTE: ["REPORTS"],
    PROMOTOR: ["ROUTES"],
  };
  return (ids[role] ?? ["REPORTS"]).map((id) => ACTION_CATALOG[id]);
}
