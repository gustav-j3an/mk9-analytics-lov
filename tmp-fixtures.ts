// Fase 1B.4 — fixtures temporárias de múltiplas vigências (removidas no final).
import { supabaseAdmin as sb } from "@/integrations/supabase/client.server";
import { loadFrequencyVersionsForPeriod, freqKey } from "@/lib/mk9-frequency/versions.server";
import {
  contractedVisitsForFrequencySegments as contracted,
  describeFrequencySegments,
  expectedVisitsUntil,
} from "@/lib/mk9-frequency/segments";

const P = { operationPeriodStart: "2026-08-01", operationPeriodEnd: "2026-08-31" };
const out: any = {};
let industryId = "";
let storeId = "";
const created: string[] = [];
const archived: string[] = [];

async function insert(row: any) {
  const { data, error } = await sb
    .from("mk9_industry_store_frequency_versions")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  created.push(data!.id);
  return data!.id;
}

async function main() {
  const { data: ind } = await sb.from("mk9_industries").select("id").eq("name", "KING").single();
  industryId = ind!.id;
  const { data: st } = await sb
    .from("mk9_industry_store_frequency_versions")
    .select("store_id")
    .eq("industry_id", industryId)
    .limit(1)
    .single();
  storeId = st!.store_id;

  // arquiva temporariamente as vigências que colidem com agosto/2026
  const { data: colidem } = await sb
    .from("mk9_industry_store_frequency_versions")
    .select("id")
    .eq("industry_id", industryId)
    .eq("store_id", storeId)
    .is("archived_at", null)
    .lte("valid_from", P.operationPeriodEnd)
    .or(`valid_until.is.null,valid_until.gte.${P.operationPeriodStart}`);
  for (const r of colidem ?? []) {
    await sb
      .from("mk9_industry_store_frequency_versions")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", r.id);
    archived.push(r.id);
  }

  const base = { industry_id: industryId, store_id: storeId, source_type: "MANUAL" as const };
  await insert({ ...base, weekly_frequency: 1, valid_from: "2026-08-01", valid_until: "2026-08-15" });
  await insert({ ...base, weekly_frequency: 2, valid_from: "2026-08-16", valid_until: null });

  // T2 — sobreposição deve falhar
  const ovl = await sb
    .from("mk9_industry_store_frequency_versions")
    .insert({ ...base, weekly_frequency: 9, valid_from: "2026-08-10", valid_until: "2026-08-20" })
    .select("id");
  out.sobreposicaoBloqueada = { erro: ovl.error?.code ?? null, mensagem: ovl.error?.message?.slice(0, 90) ?? null };
  if (!ovl.error && ovl.data?.[0]) created.push(ovl.data[0].id);

  // T3 — escrita direta na projeção deve falhar
  const w = await sb
    .from("mk9_industry_store_frequency")
    .update({ weekly_frequency: 99 })
    .eq("industry_id", industryId)
    .eq("store_id", storeId);
  out.projecaoBloqueada = { erro: w.error?.code ?? null, mensagem: w.error?.message?.slice(0, 90) ?? null };

  // T4 — leitura pelo carregador oficial
  const map = await loadFrequencyVersionsForPeriod(sb, {
    industryIds: [industryId],
    storeIds: [storeId],
    periodStart: P.operationPeriodStart,
    periodEnd: P.operationPeriodEnd,
  });
  const segs = map.get(freqKey(industryId, storeId)) ?? [];
  const r = contracted({ ...P, segments: segs });
  out.segmentos = segs.map((s) => ({ de: s.validFrom, ate: s.validUntil, sem: s.weeklyFrequency }));
  out.contratadas = { raw: Number(r.raw.toFixed(4)), final: r.contratadas, multiplas: r.hasMultipleSegments };
  out.rotulo = describeFrequencySegments(r, { start: P.operationPeriodStart, end: P.operationPeriodEnd });
  out.esperadoAte15 = expectedVisitsUntil({ ...P, segments: segs, untilDate: "2026-08-15" });
  out.esperadoAte31 = expectedVisitsUntil({ ...P, segments: segs, untilDate: "2026-08-31" });

  // T5 — escopo: versões fora do escopo não vazam
  const foraEscopo = await loadFrequencyVersionsForPeriod(sb, {
    industryIds: [industryId],
    storeIds: [storeId],
    periodStart: P.operationPeriodStart,
    periodEnd: P.operationPeriodEnd,
    accessScope: { allowedIndustryIds: ["00000000-0000-0000-0000-000000000000"] },
  });
  out.escopoIndustriaBloqueado = foraEscopo.size === 0;
  const foraUf = await loadFrequencyVersionsForPeriod(sb, {
    industryIds: [industryId],
    storeIds: [storeId],
    periodStart: P.operationPeriodStart,
    periodEnd: P.operationPeriodEnd,
    accessScope: { allowedUfs: ["ZZ"] },
  });
  out.escopoUfBloqueado = foraUf.size === 0;
}

main()
  .then(() => console.log(JSON.stringify(out, null, 2)))
  .catch((e) => {
    out.erro = String(e);
    console.log(JSON.stringify(out, null, 2));
  })
  .finally(async () => {
    // ---- REMOÇÃO DAS FIXTURES ----
    for (const id of created) await sb.from("mk9_industry_store_frequency_versions").delete().eq("id", id);
    for (const id of archived)
      await sb.from("mk9_industry_store_frequency_versions").update({ archived_at: null }).eq("id", id);
    const { count } = await sb
      .from("mk9_industry_store_frequency_versions")
      .select("id", { count: "exact", head: true })
      .eq("industry_id", industryId)
      .eq("store_id", storeId)
      .is("archived_at", null);
    console.log("FIXTURES REMOVIDAS — vigências ativas restantes:", count);
  });
