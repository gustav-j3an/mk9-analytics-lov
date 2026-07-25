// Server functions da Auditoria de Execução MK9.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const scopeSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  industryId: z.string().uuid().nullish(),
  uf: z.string().nullish(),
  promoterId: z.string().uuid().nullish(),
});

export const auditByStoreFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => scopeSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditByStore } = await import("./mk9-audit/engine.server");
    return auditByStore(supabaseAdmin, {
      year: data.year,
      month: data.month,
      industryId: data.industryId ?? null,
      uf: data.uf ?? null,
      promoterId: data.promoterId ?? null,
    });
  });

export const auditByPromoterFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => scopeSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditByPromoter } = await import("./mk9-audit/engine.server");
    return auditByPromoter(supabaseAdmin, {
      year: data.year,
      month: data.month,
      industryId: data.industryId ?? null,
      uf: data.uf ?? null,
      promoterId: data.promoterId ?? null,
    });
  });

export const auditByIndustryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => scopeSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditByIndustry } = await import("./mk9-audit/engine.server");
    return auditByIndustry(supabaseAdmin, {
      year: data.year,
      month: data.month,
      industryId: data.industryId ?? null,
      uf: data.uf ?? null,
      promoterId: data.promoterId ?? null,
    });
  });
