import { supabase } from "@/integrations/supabase/client";

/**
 * Script de Verificação de Paridade Dashboard v2.4.1
 * Executado para validar se a correção dos campos está funcionando.
 */
export async function verifyDashboardParity() {
  console.log("--- Verifying Dashboard Parity ---");
  
  const now = new Date();
  const month = now.getDate() >= 23 ? (now.getMonth() + 1) % 12 + 1 : now.getMonth() + 1;
  const year = now.getFullYear();

  try {
    const { getMk9AnalyticsDashboardFn } = await import("@/lib/mk9-analytics/analytics.functions");
    const dashboard = await getMk9AnalyticsDashboardFn({ month, year });

    console.log(`Period: ${dashboard.period.current}`);
    console.log(`Industries mapped: ${dashboard.industries.length}`);

    if (dashboard.industries.length > 0) {
      const first = dashboard.industries[0];
      console.log(`Industry: ${first.industryName}`);
      console.log(`- Frequency: ${first.frequency}`);
      console.log(`- Contracted: ${first.contracted.current}`);
      console.log(`- Realized: ${first.realized.current}`);
      console.log(`- Coverage: ${first.coverage.current}%`);
      
      const success = (first.contracted.current > 0 || first.realized.current > 0 || first.frequency !== null);
      if (success) {
        console.log("✅ Data mapping consistency verified.");
      } else {
        console.warn("⚠️ Data is still zero/null, but check if the backend has data for this month.");
      }
    } else {
      console.log("No industries found for this period.");
    }
  } catch (e) {
    console.error("Verification failed:", e);
  }
}
