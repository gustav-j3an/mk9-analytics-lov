import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function findKing() {
  const { data: industries, error } = await supabaseAdmin
    .from('mk9_industries')
    .select('id, name')
    .ilike('name', '%KING%');

  if (error) {
    console.error('Error finding KING:', error);
    return;
  }

  console.log('Industries found:', JSON.stringify(industries, null, 2));

  if (industries && industries.length > 0) {
    const kingId = industries[0].id;
    const { data: imports, error: importError } = await supabaseAdmin
      .from('mk9_checklist_imports')
      .select('*')
      .eq('industry_id', kingId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (importError) {
      console.error('Error finding imports:', importError);
    } else {
      console.log('Latest imports for KING:', JSON.stringify(imports, null, 2));
    }
  }
}

findKing();
