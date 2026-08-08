import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Retorna visitas operacionais (manuais ou de importações vigentes)
 * usando filtragem em duas etapas para máxima confiabilidade e performance.
 * 
 * Regra Operacional MK9:
 * 1. Visitas manuais (source_import_id IS NULL) são sempre operacionais.
 * 2. Visitas importadas só contam se a importação referenciada for a vigente (is_operational_current = true).
 * 3. Importações revertidas (reverted_at NOT NULL) nunca são operacionais.
 * 4. Status INCONSISTENTE não bloqueia visitas já persistidas.
 */
export const getOperationalVisits = async (params: {
  industryId: string;
  startDate: string;
  endDate: string;
  storeId?: string | null;
  sourceImportId?: string | null;
}) => {
  const { industryId, startDate, endDate, storeId, sourceImportId } = params;

  // 1. Resolver IDs de importações vigentes (is_operational_current = true)
  let activeImportIds: string[] = [];
  
  if (sourceImportId) {
    activeImportIds = [sourceImportId];
  } else {
    const { data: activeImports } = await supabaseAdmin
      .from("mk9_checklist_imports")
      .select("id")
      .eq("industry_id", industryId)
      .eq("is_operational_current" as any, true)
      .is("reverted_at", null);
    
    activeImportIds = (activeImports ?? []).map(i => i.id);
  }

  // 2. Query de visitas
  let query = supabaseAdmin
    .from("mk9_actual_visits")
    .select("id, industry_id, scheduled_date, store_id, source_import_id, store:mk9_stores(id,name,chain,uf)")
    .eq("industry_id", industryId)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate);

  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  if (activeImportIds.length > 0) {
    // Regra: source_import_id é NULL OR source_import_id IN (activeIds)
    if (sourceImportId) {
      query = query.eq("source_import_id", sourceImportId);
    } else {
      query = query.or(`source_import_id.is.null,source_import_id.in.(${activeImportIds.map(id => `"${id}"`).join(",")})`);
    }

  } else {
    // Se não há importações vigentes e nenhuma específica foi pedida, apenas as manuais
    query = query.is("source_import_id", null);
  }

  const { data, error } = await query.limit(40000);
  if (error) throw error;
  
  return (data || []).map(v => ({
    ...v,
    visit_date: v.scheduled_date 
  }));
};

/**
 * Fonte ÚNICA de verdade para visitas operacionais realizadas.
 * Centraliza a lógica para Dashboard, PDF e Auditoria.
 */
export async function listOperationalActualVisits(params: {
  industryId: string;
  startDate: string;
  endDate: string;
  storeId?: string | null;
  sourceImportId?: string | null;
}) {
  return getOperationalVisits(params);
}

/**
 * Versão em lote de listOperationalActualVisits para evitar N+1 no motor core.
 */
export async function listBulkOperationalActualVisits(params: {
  industryIds: string[];
  startDate: string;
  endDate: string;
}) {
  const { industryIds, startDate, endDate } = params;
  if (!industryIds.length) return [];

  // 1. Resolver todas as importações vigentes das indústrias de uma vez
  const { data: activeImports } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("id, industry_id")
    .in("industry_id", industryIds)
    .eq("is_operational_current" as any, true)
    .is("reverted_at", null);

  const activeImportIds = (activeImports ?? []).map(i => i.id);
  
  // 2. Query de visitas em lote
  let query = supabaseAdmin
    .from("mk9_actual_visits")
    .select("id, industry_id, scheduled_date, store_id, source_import_id, store:mk9_stores(id,name,chain,uf)")
    .in("industry_id", industryIds)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate);

  if (activeImportIds.length > 0) {
    query = query.or(`source_import_id.is.null,source_import_id.in.(${activeImportIds.map(id => `"${id}"`).join(",")})`);
  } else {
    query = query.is("source_import_id", null);
  }

  const { data, error } = await query.limit(100000);
  if (error) throw error;
  
  return (data || []).map(v => ({
    ...v,
    visit_date: v.scheduled_date 
  }));
}
