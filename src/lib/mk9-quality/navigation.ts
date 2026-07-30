/**
 * MK9 — Fase 2B.2: destino de navegação das ocorrências ("ir para o problema").
 *
 * Módulo PURO. O alvo é gravado dentro da evidência (chave `navigationTarget`),
 * portanto não exige mudança de schema. Nunca carrega dado sensível: apenas
 * o módulo de destino e identificadores já visíveis na própria ocorrência.
 */
export type Mk9QualityModule =
  | "stores"
  | "routes"
  | "frequency"
  | "audit"
  | "imports"
  | "checklists"
  | "industries";

export interface Mk9NavigationTarget {
  module: Mk9QualityModule;
  industryId?: string | null;
  storeId?: string | null;
  importId?: string | null;
  peerStoreId?: string | null;
  month?: number | null;
  year?: number | null;
  [key: string]: string | number | null | undefined;
}

/** Remove chaves vazias — evidência canônica e estável entre execuções. */
export function navigationTarget(target: Mk9NavigationTarget): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(target)) {
    if (value === null || value === undefined || value === "") continue;
    out[key] = value as string | number;
  }
  return out;
}
