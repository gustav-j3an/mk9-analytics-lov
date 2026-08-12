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
    // Buscamos a importação vigente para o período
    const { data: activeImports } = await supabaseAdmin
      .from("mk9_checklist_imports")
      .select("id")
      .eq("industry_id", industryId)
      .is("reverted_at", null)
      .eq("is_operational_current" as any, true)
      .gte("operation_year", Number(startDate.split("-")[0])) // Filtro grosseiro de período para performance
      .order('started_at', { ascending: false })
      .limit(1);

    activeImportIds = (activeImports ?? []).map((i) => i.id);

    // Se não há NENHUMA marcada como vigente, fallback para a última "done" do período 
    // (compatível com a v1.3.6 heuristic)
    if (activeImportIds.length === 0) {
      const { data: lastDone } = await supabaseAdmin
        .from("mk9_checklist_imports")
        .select("id")
        .eq("industry_id", industryId)
        .eq("status", "done")
        .is("reverted_at", null)
        .order('started_at', { ascending: false })
        .limit(1);
      
      activeImportIds = (lastDone ?? []).map((i) => i.id);
    }
  }

  // 2. Query de visitas
  let query = supabaseAdmin
    .from("mk9_actual_visits")
    .select(
      "id, industry_id, scheduled_date, store_id, source_import_id, store:mk9_stores(id,name,chain,uf)",
    )
    .eq("industry_id", industryId)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate);

  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  // REGRA DE OURO: Se temos uma importação ativa/específica, filtramos OBRIGATORIAMENTE por ela.
  // Visitas manuais (null) continuam entrando se não houver conflito de regra.
  if (activeImportIds.length > 0) {
    query = query.or(
      `source_import_id.is.null,source_import_id.in.(${activeImportIds.map((id) => `"${id}"`).join(",")})`,
    );
  } else {
    // Sem importação, apenas manuais
    query = query.is("source_import_id", null);
  }

  const { data, error } = await query.limit(40000);
  if (error) throw error;

  return (data || []).map((v) => ({
    ...v,
    visit_date: v.scheduled_date,
  }));
};

/**
 * Fonte ÚNICA de verdade para visitas operacionais realizadas.
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
  // Para performance em lote, buscamos a importação vigente ou a mais recente de cada indústria
  const { data: allRecentImports } = await supabaseAdmin
    .from("mk9_checklist_imports")
    .select("id, industry_id, is_operational_current, status, started_at")
    .in("industry_id", industryIds)
    .is("reverted_at", null)
    .in("status", ["done", "confirmed", "committing"])
    .order('started_at', { ascending: false });

  const activeImportIdsByIndustry = new Map<string, string[]>();
  for (const imp of allRecentImports ?? []) {
    const list = activeImportIdsByIndustry.get(imp.industry_id) || [];
    if (imp.is_operational_current) {
      list.push(imp.id);
    }
    activeImportIdsByIndustry.set(imp.industry_id, list);
  }

  // Fallback para quem não tem is_operational_current=true (usa a mais recente)
  for (const id of industryIds) {
    if (!activeImportIdsByIndustry.has(id) || activeImportIdsByIndustry.get(id)!.length === 0) {
      const last = allRecentImports?.find(i => i.industry_id === id);
      if (last) {
        activeImportIdsByIndustry.set(id, [last.id]);
      }
    }
  }

  const allActiveIds = Array.from(activeImportIdsByIndustry.values()).flat();



  // 2. Query de visitas em lote
  let query = supabaseAdmin
    .from("mk9_actual_visits")
    .select(
      "id, industry_id, scheduled_date, store_id, source_import_id, store:mk9_stores(id,name,chain,uf)",
    )
    .in("industry_id", industryIds)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate);

  if (activeImportIds.length > 0) {
    query = query.or(
      `source_import_id.is.null,source_import_id.in.(${activeImportIds.map((id) => `"${id}"`).join(",")})`,
    );
  } else {
    query = query.is("source_import_id", null);
  }

  const { data, error } = await query.limit(100000);
  if (error) throw error;

  return (data || []).map((v) => ({
    ...v,
    visit_date: v.scheduled_date,
  }));
}
