import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const revertInputSchema = z.object({
  importId: z.string().uuid(),
  reason: z.string().min(10).max(500),
});

const correctInputSchema = z.object({
  importId: z.string().uuid(),
  targetMonth: z.number().int().min(1).max(12),
  targetYear: z.number().int().min(2020).max(2100),
  reason: z.string().min(10).max(500),
});

export const getChecklistRevertPreview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ importId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("../mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);

    const { getRevertPreview } = await import("./revert.server");
    return getRevertPreview(data.importId);
  });

export const revertChecklistImport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => revertInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("../mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);

    const { executeRevert } = await import("./revert.server");
    return executeRevert(data.importId, {
      reason: data.reason,
      actorId: ctx.userId ?? undefined,
    });
  });

export const correctChecklistCompetence = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => correctInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("../mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);

    const { executeCorrection } = await import("./revert.server");
    return executeCorrection(data.importId, {
      targetMonth: data.targetMonth,
      targetYear: data.targetYear,
      reason: data.reason,
      actorId: ctx.userId ?? undefined,
    });
  });
