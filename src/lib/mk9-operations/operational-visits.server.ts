import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Retorna visitas operacionais (sem importação ou de importações vigentes)
 * usando filtragem em duas etapas para máxima confiabilidade e performance no PostgREST.
 * 
 * Regra Operacional:
 * 1. Visitas manuais (source_import_id IS NULL) são sempre operacionais.
 * 2. Visitas importadas só contam se a importação referenciada for a vigente (is_operational_current = true).
 */
export const getOperationalVisits = async (params: {
  industryId: string;
  startDate: string;
  endDate: string;
  storeId?: string | null;
}) => {
  const { industryId, startDate, endDate, storeId } = params;

  // 1. Buscar IDs de importações vigentes para o período
  // Nota: is_operational_current é uma coluna real no banco, mas pode não estar no gerado local do Typescript
  // se a sincronização de tipos estiver pendente. Usamos casting para bypassar o erro de tipo se necessário.
  const { data: activeImports } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("id")
    .eq("industry_id", industryId)
    .eq("is_operational_current" as any, true)
    .is("reverted_at", null);

  const activeImportIds = (activeImports ?? []).map(i => i.id);

  // 2. Construir a query de visitas
  let query = supabaseAdmin
    .from("mk9_actual_visits")
    .select("id, scheduled_date, store_id, source_import_id, store:mk9_stores(id,name,chain,uf)")
    .eq("industry_id", industryId)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate);

  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  // 3. Aplicar filtro operacional: source_import_id IS NULL OR source_import_id IN (...)
  // Usamos sintaxe PostgREST plana no .or() que não envolve joins para evitar parse errors.
  if (activeImportIds.length > 0) {
    // Lista de IDs vira string: (id1,id2,...)
    query = query.or(`source_import_id.is.null,source_import_id.in.(${activeImportIds.join(",")})`);
  } else {
    // Se não há importações vigentes, apenas as manuais (nulas) servem
    query = query.is("source_import_id", null);
  }

  const { data, error } = await query.limit(40000);
  if (error) throw error;
  return data || [];
};
