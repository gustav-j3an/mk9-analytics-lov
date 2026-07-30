// Fase 1B.4 — script temporário de homologação (removido ao final).
import { supabaseAdmin as sb } from "@/integrations/supabase/client.server";
import { auditByIndustry, auditByStore } from "@/lib/mk9-audit/engine.server";
import { buildDashboardOverview } from "@/lib/mk9-dashboard/engine.server";
import { loadPeriodConfig, resolveWindow } from "@/lib/mk9-reports/period.server";
import { buildIndustryReport } from "@/lib/mk9-reports/industry-report.server";
import { renderIndustryReportPdf } from "@/lib/reports/industry-pdf.server";

const YEAR = 2026;
const MONTH = 7;
const now = () => Number(process.hrtime.bigint() / 1000000n);
async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = now();
  const r = await fn();
  return [r, now() - t0];
}

async function main() {
  const [byIndustry, tAudit] = await timed(() => auditByIndustry(sb, { year: YEAR, month: MONTH }));
  const [byStore, tStore] = await timed(() => auditByStore(sb, { year: YEAR, month: MONTH }));
  const [dash, tDash] = await timed(() => buildDashboardOverview(sb, { year: YEAR, month: MONTH } as any));

  const rows: any[] = [];
  const times: any = { tAudit, tStore, tDash, reports: [] as number[] };
  for (const ind of byIndustry) {
    const cfg = await loadPeriodConfig(sb as any, ind.industryId);
    const win = resolveWindow(cfg, YEAR, MONTH);
    const [rep, tRep] = await timed(() =>
      buildIndustryReport(sb, { industryId: ind.industryId, year: YEAR, month: MONTH }, win),
    );
    times.reports.push(tRep);
    const stores = byStore.stores.filter((s) => s.industryId === ind.industryId);
    const d = dash.industries.find((i: any) => i.industryId === ind.industryId);
    const { count: versoes } = await sb
      .from("mk9_industry_store_frequency_versions")
      .select("id", { count: "exact", head: true })
      .eq("industry_id", ind.industryId)
      .is("archived_at", null)
      .lte("valid_from", ind.window.endDate)
      .or(`valid_until.is.null,valid_until.gte.${ind.window.startDate}`);

    rows.push({
      industria: ind.industryName,
      lojas: ind.storesCount,
      periodo: `${ind.window.startDate}→${ind.window.endDate} (${ind.window.totalDays}d)`,
      versoes,
      audit: { c: ind.contratadas, r: ind.realizadas, p: ind.pendentes, cov: ind.coberturaPct },
      auditStores: {
        c: stores.reduce((a, s) => a + s.contratadas, 0),
        r: stores.reduce((a, s) => a + s.realizadas, 0),
        p: stores.reduce((a, s) => a + s.pendentes, 0),
        n: stores.length,
      },
      dashboard: d
        ? { c: d.contratadas, r: d.realizadas, p: d.pendentes, cov: d.coberturaPct, exp: d.expectedToDate, win: `${d.windowStart}→${d.windowEnd}` }
        : null,
      report: {
        c: rep.totals.contracted,
        r: rep.totals.actual,
        p: rep.totals.pending,
        extra: rep.totals.extra,
        cov: rep.totals.contractualCoveragePct,
        win: `${rep.window.startDate}→${rep.window.endDate}`,
        lojas: rep.totals.totalStores,
      },
      tRep,
    });
  }

  // PDF do KING — confere se o total impresso bate
  const king = byIndustry.find((i) => i.industryName.toUpperCase().includes("KING"));
  let pdfInfo: any = null;
  if (king) {
    const cfg = await loadPeriodConfig(sb as any, king.industryId);
    const win = resolveWindow(cfg, YEAR, MONTH);
    const rep = await buildIndustryReport(sb, { industryId: king.industryId, year: YEAR, month: MONTH }, win);
    const [bytes, tPdf] = await timed(async () => renderIndustryReportPdf(rep as any, YEAR, MONTH));
    pdfInfo = { bytes: (bytes as any).length ?? (bytes as any).byteLength, tPdf, contracted: rep.totals.contracted, actual: rep.totals.actual };
  }

  console.log(JSON.stringify({ rows, times, pdfInfo }, null, 2));
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
