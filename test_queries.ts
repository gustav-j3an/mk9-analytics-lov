import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function test() {
  const industryIds = ["6f36bb9d-e679-4538-9b58-e6adeb6638e2"];
  const globalStart = "2026-07-23";
  const globalEnd = "2026-08-22";

  console.log("--- Multi Industry Query (Dashboard Style) ---");
  const { data: multi, error: e1 } = await supabaseAdmin
    .from("mk9_actual_visits")
    .select(
      "industry_id, store_id, scheduled_date, source_import_id, store:mk9_stores(id,name,chain,uf)",
    )
    .in("industry_id", industryIds)
    .gte("scheduled_date", globalStart)
    .lte("scheduled_date", globalEnd)
    .limit(10);

  if (e1) console.error(e1);
  console.log("Multi count sample:", multi?.length);
  if (multi && multi.length > 0) {
    console.log("Sample visit:", JSON.stringify(multi[0], null, 2));
  }
}
test();
