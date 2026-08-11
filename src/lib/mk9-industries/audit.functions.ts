
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Motor de Auditoria MK9 — Classificação de Indústrias (Diagnóstico)
 * 
 * Verifica para cada indústria:
 * 1. Presença no roteiro planejado (mk9_planned_routes)
 * 2. Histórico de importações (mk9_checklist_imports)
 * 3. Frequências configuradas (mk9_industry_store_frequency_versions)
 * 4. Visitas operacionais (mk9_actual_visits)
 */
export const mk9RunIndustryAudit = createServerFn({ method: "POST" }).handler(async () => {
  const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
  await requireMk9Role(["ADMIN"]);

  // 1. Listar todas as indústrias
  // Nota: Usando 'any' temporariamente para evitar erros de tipos enquanto o schema cache não atualiza localmente
  const { data: industries, error: indErr } = await supabaseAdmin
    .from("mk9_industries")
    .select("id, name, control_mode, archived_at")
    .order("name", { ascending: true }) as any;

  if (indErr) throw new Error("Erro ao listar indústrias: " + indErr.message);

  const results = [];

  for (const ind of industries || []) {
    const industryId = ind.id;

    // A. Verificar roteiro planejado
    const { count: routeCount } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select("*", { count: 'exact', head: true })
      .eq("industry_id", industryId)
      .is("archived_at", null);

    // B. Verificar histórico de importações
    const { count: importCount } = await supabaseAdmin
      .from("mk9_checklist_imports")
      .select("*", { count: 'exact', head: true })
      .eq("industry_id", industryId)
      .in("status", ["done", "confirmed"]);

    // C. Verificar frequências versionadas
    const { count: freqCount } = await supabaseAdmin
      .from("mk9_industry_store_frequency_versions")
      .select("*", { count: 'exact', head: true })
      .eq("industry_id", industryId);

    // D. Verificar visitas reais (antiga mk9_actual_visits ou operacional)
    const { count: visitCount } = await supabaseAdmin
      .from("mk9_actual_visits")
      .select("*", { count: 'exact', head: true })
      .eq("industry_id", industryId);

    // E. Verificar se aparece em snapshots (Indústrias PDF)
    const { count: snapshotCount } = await supabaseAdmin
      .from("mk9_checklist_import_store_snapshots")
      .select("*", { count: 'exact', head: true })
      .eq("industry_id", industryId);

    const hasChecklistActivity = (importCount ?? 0) > 0 || (freqCount ?? 0) > 0 || (visitCount ?? 0) > 0 || (snapshotCount ?? 0) > 0;
    
    // Regra de Sugestão:
    // Se possui controle mensal real por checklist -> VISIT_CONTROLLED
    // Caso contrário -> FIXED_OPERATION
    const suggestedMode = hasChecklistActivity ? "VISIT_CONTROLLED" : "FIXED_OPERATION";

    results.push({
      id: industryId,
      name: ind.name,
      currentMode: ind.control_mode || "VISIT_CONTROLLED",
      suggestedMode,
      inRoute: (routeCount ?? 0) > 0,
      hasImports: (importCount ?? 0) > 0,
      hasFrequencies: (freqCount ?? 0) > 0,
      hasVisits: (visitCount ?? 0) > 0,
      hasSnapshots: (snapshotCount ?? 0) > 0,
      archived: !!ind.archived_at
    });
  }

  return {
    total: results.length,
    visitControlledCurrent: results.filter(r => r.currentMode === "VISIT_CONTROLLED").length,
    fixedOperationCurrent: results.filter(r => r.currentMode === "FIXED_OPERATION").length,
    suggestions: {
      visitControlled: results.filter(r => r.suggestedMode === "VISIT_CONTROLLED").map(r => r.name),
      fixedOperation: results.filter(r => r.suggestedMode === "FIXED_OPERATION").map(r => r.name),
    },
    fullReport: results
  };
});
