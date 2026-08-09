/**
 * MK9 — Regras puras da gestão administrativa de indústrias (Etapas 1 e 2).
 *
 * Nada aqui faz I/O. Este módulo define:
 *  - os schemas de entrada (Zod `.strict()`), que recusam metadados administrativos;
 *  - a tradução dos erros técnicos das RPCs em mensagens seguras ao usuário;
 *  - o filtro de status (todas / ativas / arquivadas) usado pela tela.
 */
import { z } from "zod";

export const industryControlModeSchema = z.enum(["VISIT_CONTROLLED", "FIXED_OPERATION"]);
export type IndustryControlMode = z.infer<typeof industryControlModeSchema>;

const trimmed = (max: number) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(max));

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => {
      const t = v.trim();
      return t.length ? t : null;
    })
    .nullable()
    .optional();

/** Validação de CNPJ opcional. */
const cnpjSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 0 || v.length === 14, {
    message: "CNPJ deve ter 14 números.",
  })
  .nullable()
  .optional();

/** Cadastro manual. Nenhum metadado administrativo é aceito do navegador. */
export const createIndustrySchema = z
  .object({
    name: trimmed(120).pipe(z.string().min(2, "Informe o nome da indústria.")),
    displayName: optionalText(120),
    cnpj: cnpjSchema,
    notes: optionalText(1000),
    requiresChecklist: z.boolean().default(false),
    controlMode: industryControlModeSchema.default("VISIT_CONTROLLED"),
    periodType: z.enum(["CALENDAR_MONTH", "CUSTOM_CYCLE"]).default("CALENDAR_MONTH"),
    startDay: z.number().int().min(1).max(31).nullable().optional(),
    endDay: z.number().int().min(1).max(31).nullable().optional(),
    usesPreviousMonth: z.boolean().optional(),
    confirmed: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.periodType !== "CUSTOM_CYCLE" || (v.startDay != null && v.endDay != null), {
    message: "Informe o dia inicial e o dia final do período personalizado.",
    path: ["startDay"],
  });

/** Edição: somente campos cadastrais + concorrência otimista. */
export const updateIndustrySchema = z
  .object({
    industryId: z.string().uuid(),
    expectedUpdatedAt: z.string().min(1),
    name: trimmed(120).pipe(z.string().min(2, "Informe o nome da indústria.")),
    displayName: optionalText(120),
    cnpj: cnpjSchema,
    notes: optionalText(1000),
    requiresChecklist: z.boolean().optional(),
    controlMode: industryControlModeSchema.optional(),
    periodType: z.enum(["CALENDAR_MONTH", "CUSTOM_CYCLE"]).optional(),
    startDay: z.number().int().min(1).max(31).nullable().optional(),
    endDay: z.number().int().min(1).max(31).nullable().optional(),
    usesPreviousMonth: z.boolean().optional(),
  })
  .strict();

export const deleteIndustrySchema = z
  .object({
    industryId: z.string().uuid(),
  })
  .strict();

export const archiveIndustrySchema = z
  .object({
    industryId: z.string().uuid(),
    expectedUpdatedAt: z.string().min(1),
    reason: optionalText(500),
  })
  .strict();

export const reactivateIndustrySchema = z
  .object({
    industryId: z.string().uuid(),
    expectedUpdatedAt: z.string().min(1),
  })
  .strict();

export type CreateIndustryInput = z.infer<typeof createIndustrySchema>;
export type UpdateIndustryInput = z.infer<typeof updateIndustrySchema>;

/** Tradução determinística de erro técnico → mensagem do usuário. */
export const INDUSTRY_RPC_MESSAGES: Record<string, string> = {
  MK9_INDUSTRY_NOT_FOUND: "Indústria não encontrada.",
  MK9_INDUSTRY_NAME_INVALID: "Informe um nome válido para a indústria.",
  MK9_DUPLICATE_INDUSTRY: "Já existe uma indústria cadastrada com este nome.",
  MK9_CONCURRENT_UPDATE:
    "Este cadastro foi alterado por outra pessoa enquanto você editava. Recarregue e tente novamente.",
  MK9_INDUSTRY_ARCHIVED: "Esta indústria está arquivada. Reative-a antes de editar.",
  MK9_INDUSTRY_ALREADY_ARCHIVED: "Esta indústria já está arquivada.",
  MK9_INDUSTRY_NOT_ARCHIVED: "Esta indústria não está arquivada.",
};

export function industryRpcMessage(raw: string | null | undefined, fallback: string): string {
  const text = raw ?? "";
  for (const [code, message] of Object.entries(INDUSTRY_RPC_MESSAGES)) {
    if (text.includes(code)) return message;
  }
  return fallback;
}

export type IndustryStatusFilter = "all" | "active" | "archived";

export function matchesStatusFilter(
  industry: { archivedAt?: string | null },
  filter: IndustryStatusFilter,
): boolean {
  if (filter === "all") return true;
  const archived = !!industry.archivedAt;
  return filter === "archived" ? archived : !archived;
}

/** Caches invalidados após qualquer escrita administrativa de indústria. */
export const INDUSTRY_ADMIN_CACHE_KEYS = [
  "mk9-industries",
  "mk9-checklist-industries",
  "mk9-industry-operation-config",
  "mk9-cockpit",
  "mk9-dashboard",
  "mk9-quality",
  "mk9-reports",
] as const;
