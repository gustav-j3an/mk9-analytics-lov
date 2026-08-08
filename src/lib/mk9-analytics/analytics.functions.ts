import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAnalyticsDashboard } from "./analytics-engine.server";

export const getMk9AnalyticsDashboardFn = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        year: z.number(),
        month: z.number(),
        compareYear: z.number().optional(),
        compareMonth: z.number().optional(),
        industryId: z.string().optional(),
        uf: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Acesso ao Supabase injetado via middleware (requireSupabaseAuth)
    const { supabase } = context as any;
    
    // O motor de analytics consome o core operacional
    return getAnalyticsDashboard(supabase, data);
  });
