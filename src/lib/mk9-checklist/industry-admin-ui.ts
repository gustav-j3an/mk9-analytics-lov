/**
 * MK9 — Superfície client-safe da gestão de indústrias de checklist.
 * Reexporta apenas regras puras/constantes: nenhum acesso a banco ou segredo.
 */
export {
  CHECKLIST_INDUSTRY_CACHE_KEYS,
  DISABLE_CONFIRMATION_MESSAGE,
  MISSING_PERIOD_WARNING,
  NON_ADMIN_DISABLED_MESSAGE,
  canManageChecklistIndustries,
  findSimilarIndustries,
  isChecklistChargeable,
} from "./industry-admin";
export { INDUSTRY_CHECKLIST_DISABLED } from "./industry-gate";
