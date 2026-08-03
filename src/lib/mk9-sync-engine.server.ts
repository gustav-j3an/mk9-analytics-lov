import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runChecklistPreview } from "@/lib/mk9-checklist/preview.server";
import { createChecklistDiagnostics } from "@/lib/mk9-checklist/diagnostics";
import { checklistCommit } from "@/lib/mk9-checklist.functions";

/**
 * Motor de Sincronização Automática (M2M)
 * Responsável por receber o arquivo do Google Drive/n8n e processar o fluxo homologado.
 */
export async function runChecklistSync(params: {
  syncId: string;
  buffer: ArrayBuffer;
  filename: string;
  externalFileId: string;
  expectedMonth?: number;
  expectedYear?: number;
}) {
  const diagnostics = createChecklistDiagnostics(`sync-${params.syncId}`);
  
  try {
    // 1. Resolver Indústria e Competência
    const { data: industries } = await supabaseAdmin
      .from("mk9_industries")
      .select("id, name, name_normalized")
      .eq("requires_checklist", true);
    
    const fileNameNorm = params.filename.toLowerCase();
    let matchedIndustry = industries?.find(i => fileNameNorm.includes(i.name_normalized));
    
    let month = params.expectedMonth;
    let year = params.expectedYear;
    
    if (!month || !year) {
      const months = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      const foundMonthIdx = months.findIndex(m => fileNameNorm.includes(m));
      if (foundMonthIdx !== -1) month = foundMonthIdx + 1;
      
      const yearMatch = params.filename.match(/20\d{2}/);
      if (yearMatch) year = parseInt(yearMatch[0]);
    }

    if (!matchedIndustry || !month || !year) {
      await supabaseAdmin
        .from("mk9_checklist_sync_files" as any)
        .update({
          status: "NEEDS_REVIEW",
          error_code: !matchedIndustry ? "INDUSTRY_NOT_FOUND" : "COMPETENCE_NOT_FOUND",
          error_message_sanitized: "Não foi possível identificar indústria ou competência automaticamente pelo nome do arquivo.",
          industry_id: matchedIndustry?.id,
          competence_month: month,
          competence_year: year
        } as any)
        .eq("id", params.syncId);
      return { status: "NEEDS_REVIEW" };
    }

    // 2. Executar Preview
    const { importId, preview } = await runChecklistPreview({
      buffer: params.buffer,
      filename: params.filename,
      fileSize: params.buffer.byteLength,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      industryId: matchedIndustry.id,
      operationMonth: month,
      operationYear: year,
    }, diagnostics);

    // 3. Avaliar Critérios de Auto-Importação
    const canAutoImport = 
      preview.counters.storesNew === 0 && 
      preview.counters.invalidDates === 0 &&
      preview.counters.duplicateStoreNames === 0;

    if (!canAutoImport) {
      await supabaseAdmin
        .from("mk9_checklist_sync_files" as any)
        .update({
          status: "NEEDS_REVIEW",
          error_code: "PREVIEW_ALERTS",
          error_message_sanitized: "O arquivo contém alertas que exigem revisão manual.",
          industry_id: matchedIndustry.id,
          competence_month: month,
          competence_year: year,
          checklist_import_id: importId
        } as any)
        .eq("id", params.syncId);
      return { status: "NEEDS_REVIEW" };
    }

    // 4. Executar Commit
    // Chamando a server function via handler diretamente para evitar problemas de tipos de middleware no servidor
    // @ts-ignore
    const commitResult = await (checklistCommit as any).handler({
      data: {
        importId,
        industryId: matchedIndustry.id,
        operationMonth: month,
        operationYear: year,
        items: preview.items.map(i => ({
          storeId: i.storeId,
          storeName: i.storeName,
          storeNormalized: i.storeNormalized,
          uf: i.uf as any,
          scheduledDate: i.scheduledDate,
          isNew: i.status === "new_store"
        }))
      }
    });

    // 5. Finalizar Sincronização
    const status = commitResult.validationError === "DUPLICATE_UNCHANGED" ? "SKIPPED_UNCHANGED" : "IMPORTED";
    
    await supabaseAdmin
      .from("mk9_checklist_sync_files" as any)
      .update({
        status,
        industry_id: matchedIndustry.id,
        competence_month: month,
        competence_year: year,
        checklist_import_id: importId,
        previous_import_id: (preview as any).previousImport?.id,
        processing_finished_at: new Date().toISOString(),
        counters: commitResult as any
      } as any)
      .eq("id", params.syncId);

    return { status, importId };

  } catch (err: any) {
    console.error(`[SYNC FATAL] ${params.syncId}`, err);
    await supabaseAdmin
      .from("mk9_checklist_sync_files" as any)
      .update({
        status: "FAILED",
        error_code: "RUNTIME_ERROR",
        error_message_sanitized: err.message?.slice(0, 500)
      } as any)
      .eq("id", params.syncId);
    throw err;
  }
}
