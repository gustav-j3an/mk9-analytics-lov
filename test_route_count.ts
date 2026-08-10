import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function run() {
  const promoterId = "4431d267-4c97-44d3-9526-96805cf8ca28";
  const referenceDate = "2026-08-01";
  
  const { data: rows, error } = await supabaseAdmin
    .from("mk9_planned_routes")
    .select(`
      id, 
      weekday, 
      store:mk9_stores(id, name)
    `)
    .eq("promoter_id", promoterId)
    .eq("is_active", true)
    .is("archived_at", null)
    .lte("valid_from", referenceDate)
    .or(`valid_until.is.null,valid_until.gte.${referenceDate}`);
    
  if (error) {
    console.log(JSON.stringify({ error }));
  } else {
    console.log(JSON.stringify({ 
        count: rows.length,
        items: rows.map(r => ({ day: r.weekday, store: r.store?.name }))
    }, null, 2));
  }
}

run();
