import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { reprocessOperationalPromotion } from "./mk9-checklist/promotion.server";

export const reprocessChecklistPromotion = createServerFn({ method: "POST" })
  .validator(async (data: unknown) => 
    z.object({ importId: z.string().uuid() }).parse(data)
  )
  .handler(async ({ data }) => {
    const { requireMk9Role, logAudit } = await import("./mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    
    const result = await reprocessOperationalPromotion(data.importId);
    
    if (result.success) {
      await logAudit(ctx, "mk9.admin.reprocess_promotion", "mk9_checklist_imports", data.importId, {
        industryId: result.industryId,
        previousImportId: result.previousImportId
      });
    }
    
    return result;
  });
