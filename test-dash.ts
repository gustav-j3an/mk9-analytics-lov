import { createClient } from "@supabase/supabase-js";
import { buildDashboardOverview } from "@/lib/mk9-dashboard/engine.server";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const t0 = Date.now();
const r = await buildDashboardOverview(sb, { year: 2026, month: 7 });
console.log("ms", Date.now() - t0);
console.log("kpis", r.kpis);
console.log("period", r.periodLabel, r.windowStart, r.windowEnd, "today", r.today, "imports", r.checklistImports);
console.log("industries", r.industries.map(i => `${i.industryName}: ${i.status} contr=${i.contratadas} exp=${i.expectedToDate} real=${i.realizadas} cob=${i.coberturaPct}% win=${i.windowStart}..${i.windowEnd}`));
console.log("series pts", r.series.length, r.series.at(-1));
console.log("alerts", r.alerts.slice(0,6).map(a => `${a.severity} ${a.title}`));
console.log("criticalStores", r.criticalStoresTotal, r.criticalStores.slice(0,3).map(s=>`${s.storeName}|${s.industryName}|${s.realizadas}/${s.contratadas}|${s.daysWithoutVisit}d|${s.promoterResolution}`));
console.log("promoters", r.promoters.slice(0,5).map(p=>`${p.promoterName}: ${p.realizadas}/${p.expectedToDate} ${p.coberturaPct}% off=${p.visitsOffSchedule} ${p.status}`));
console.log("dist", r.storeExecutionDistribution, r.industryStatusDistribution);
