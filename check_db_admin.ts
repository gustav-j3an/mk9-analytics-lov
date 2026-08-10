import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function run() {
  const promoterId = '4431d267-4c97-44d3-9526-96805cf8ca28';
  const referenceDate = '2026-08-01';
  
  const { data: rows, error } = await supabaseAdmin
    .from("mk9_planned_routes")
    .select(`
      id, 
      weekday, 
      store_id,
      valid_from,
      valid_until,
      is_active,
      archived_at,
      store:mk9_stores(name),
      industry:mk9_industries(name)
    `)
    .eq("promoter_id", promoterId);

  if (error) {
    console.log("ERROR:", error);
    return;
  }

  const active = rows.filter(r => 
    r.is_active === true && 
    r.archived_at === null &&
    r.valid_from <= referenceDate &&
    (r.valid_until === null || r.valid_until >= referenceDate)
  );

  const days = new Set(active.map(r => r.weekday));
  const stops = new Set(active.map(r => `${r.weekday}-${r.store_id}`));

  console.log("RESULT_START");
  console.log(JSON.stringify({
    total_found: rows.length,
    active_count: active.length,
    dias: days.size,
    paradas: stops.size,
    itens: active.length,
    ids: active.map(r => r.id).sort(),
    sample: active.slice(0, 2).map(r => ({
      wd: r.weekday,
      store: r.store.name,
      ind: r.industry.name
    }))
  }, null, 2));
  console.log("RESULT_END");
}

run();
