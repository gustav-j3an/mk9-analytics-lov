/**
 * MK9 — Etapas 3 a 5: regras PURAS da gestão manual de frequências contratadas.
 *
 * Nada aqui toca banco. O servidor valida com estes mesmos schemas e as RPCs
 * revalidam concorrência, sobreposição e permissão dentro da transação.
 */
import { z } from "zod";

import { evaluateFrequencyConsistency } from "./canonical";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use aaaa-mm-dd).");

const justification = z
  .string()
  .trim()
  .max(500, "Justificativa muito longa (máx. 500 caracteres).");

const freqValue = z
  .number()
  .min(0, "Frequência não pode ser negativa.")
  .max(60, "Frequência acima do limite operacional.")
  .nullable();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
export const listFrequenciesSchema = z
  .object({
    industryId: z.string().uuid(),
    search: z.string().trim().max(80).optional().nullable(),
    uf: z.string().trim().length(2).optional().nullable(),
    status: z.enum(["all", "current", "future", "ended"]).default("all"),
    source: z.enum(["all", "IMPORT", "MANUAL", "MIGRATION", "SYSTEM"]).default("all"),
    page: z.number().int().min(1).max(500).default(1),
    pageSize: z.number().int().min(5).max(100).default(20),
  })
  .strict();

export const frequencyHistorySchema = z
  .object({ industryId: z.string().uuid(), storeId: z.string().uuid() })
  .strict();

export const setFrequencySchema = z
  .object({
    industryId: z.string().uuid(),
    storeId: z.string().uuid(),
    weeklyFrequency: freqValue,
    monthlyFrequency: freqValue,
    effectiveDate: isoDate,
    reason: justification.optional().nullable(),
    /** Confirma combinação semanal × mensal fora do padrão comercial. */
    confirmInconsistent: z.boolean().default(false),
    /** Confirma alteração retroativa (competência já encerrada). */
    confirmRetroactive: z.boolean().default(false),
    /** updated_at da versão vigente na data de efeito (null = nenhuma). */
    expectedUpdatedAt: z.string().nullable().default(null),
  })
  .strict()
  .refine((d) => d.weeklyFrequency !== null || d.monthlyFrequency !== null, {
    message: "Informe a frequência semanal ou a mensal.",
    path: ["weeklyFrequency"],
  });

export const closeFrequencySchema = z
  .object({
    versionId: z.string().uuid(),
    endDate: isoDate,
    reason: justification.min(3, "Justificativa obrigatória."),
    expectedUpdatedAt: z.string(),
  })
  .strict();

export type SetFrequencyInput = z.infer<typeof setFrequencySchema>;

// ---------------------------------------------------------------------------
// Status de vigência
// ---------------------------------------------------------------------------
export type FrequencyVersionStatus = "current" | "future" | "ended";

export function frequencyVersionStatus(
  row: { validFrom: string; validUntil?: string | null },
  today: string,
): FrequencyVersionStatus {
  if (row.validFrom > today) return "future";
  if (row.validUntil && row.validUntil < today) return "ended";
  return "current";
}

export const FREQUENCY_STATUS_LABEL: Record<FrequencyVersionStatus, string> = {
  current: "Vigente",
  future: "Futura",
  ended: "Encerrada",
};

/** Competência encerrada = anterior ao primeiro dia do mês corrente. */
export function isRetroactiveChange(effectiveDate: string, today: string): boolean {
  const monthStart = `${today.slice(0, 7)}-01`;
  return effectiveDate < monthStart;
}

// ---------------------------------------------------------------------------
// Validação da combinação semanal × mensal
// ---------------------------------------------------------------------------
export interface FrequencyCombinationCheck {
  ok: boolean;
  needsConfirmation: boolean;
  needsJustification: boolean;
  warning: string | null;
  isBiweekly: boolean;
}

export function checkFrequencyCombination(
  weekly: number | null,
  monthly: number | null,
  opts?: { confirmed?: boolean; reason?: string | null },
): FrequencyCombinationCheck {
  const state = evaluateFrequencyConsistency(weekly, monthly);
  if (!state.evaluable || state.consistent) {
    return {
      ok: true,
      needsConfirmation: false,
      needsJustification: false,
      warning: null,
      isBiweekly: state.isBiweekly,
    };
  }
  const confirmed = opts?.confirmed === true;
  const reason = (opts?.reason ?? "").trim();
  const warning = `Combinação divergente: ${state.weekly}x/semana normalmente corresponde a ${state.expectedMonthly}x/mês (informado: ${state.monthly}x/mês).`;
  return {
    ok: confirmed && reason.length >= 3,
    needsConfirmation: !confirmed,
    needsJustification: reason.length < 3,
    warning,
    isBiweekly: false,
  };
}

// ---------------------------------------------------------------------------
// Erros de RPC → mensagens seguras
// ---------------------------------------------------------------------------
export const FREQUENCY_ERROR_MESSAGES: Record<string, string> = {
  MK9_FREQUENCY_CONCURRENT_MODIFICATION:
    "Esta frequência foi alterada por outra pessoa enquanto você editava. Recarregue e tente novamente.",
  MK9_FREQUENCY_OVERLAP:
    "Já existe uma vigência para esta loja no período informado. Encerre a vigência atual antes de criar outra.",
  MK9_FREQUENCY_RETROACTIVE_CONFIRMATION: "Alteração retroativa exige confirmação e justificativa.",
  MK9_FREQUENCY_VALUE_REQUIRED: "Informe a frequência semanal ou a mensal.",
  MK9_FREQUENCY_VALUE_INVALID: "Frequência inválida.",
  MK9_FREQUENCY_END_BEFORE_START:
    "A data de encerramento não pode ser anterior ao início da vigência.",
  MK9_FREQUENCY_NOT_FOUND: "Frequência não encontrada.",
};

/** Nunca devolve SQL, constraint ou caminho interno ao navegador. */
export function frequencyRpcMessage(raw: string | null | undefined, fallback: string): string {
  const text = raw ?? "";
  for (const [code, message] of Object.entries(FREQUENCY_ERROR_MESSAGES)) {
    if (text.includes(code)) return message;
  }
  if (/mk9_frequency_overlap|exclusion|23P01/i.test(text)) {
    return FREQUENCY_ERROR_MESSAGES.MK9_FREQUENCY_OVERLAP;
  }
  return fallback;
}

/** Caches invalidados após qualquer escrita de frequência. */
export const FREQUENCY_ADMIN_CACHE_KEYS = [
  "mk9-industry-frequencies",
  "mk9-frequency-history",
  "mk9-industries",
  "mk9-dashboard",
  "mk9-cockpit",
  "mk9-audit",
  "mk9-reports",
  "mk9-quality",
] as const;
