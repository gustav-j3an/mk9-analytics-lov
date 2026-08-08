import { describe, it, expect } from 'vitest';
import { supabaseAdmin } from './src/integrations/supabase/client.server';
import { listOperationalActualVisits } from './src/lib/mk9-operations/operational-visits.server';
import { loadOperationCore } from './src/lib/mk9-operations/core.server';
import { buildIndustryReport } from './src/lib/mk9-reports/industry-report.server';
import { resolveWindow, loadPeriodConfig } from './src/lib/mk9-reports/period.server';

/**
 * TESTES DE REGRESSÃO E CONTRATO — MK9 ANALYTICS
 * 
 * Este arquivo garante que as visitas realizadas nunca divirjam entre
 * os diferentes módulos do sistema (Dashboard, PDF e Auditoria).
 */

describe('Contrato de Sincronia de Visitas Realizadas', () => {
  const industryId = '6f36bb9d-e679-4538-9b58-e6adeb6638e2'; // KING
  const year = 2026;
  const month = 8;

  it('TESTE 1: Paridade total entre Dashboard, PDF e Motor Operacional', async () => {
    // 1. Configuração de Janela
    const cfg = await loadPeriodConfig(supabaseAdmin, industryId);
    const window = resolveWindow(cfg, year, month);

    // 2. Coletar dados de todas as fontes
    const operationalVisits = await listOperationalActualVisits({
      industryId,
      startDate: window.startDate,
      endDate: window.endDate
    });

    const core = await loadOperationCore(supabaseAdmin, {
      industryId,
      year,
      month
    });

    const report = await buildIndustryReport(supabaseAdmin, {
      industryId,
      year,
      month
    }, window);

    const dashboardRealized = core.industryRows[0]?.realizadas || 0;
    const pdfRealized = report.totals.actual;
    const operationalCount = operationalVisits.length;

    console.log(`[CONTRATO] Operacional: ${operationalCount} | Dashboard: ${dashboardRealized} | PDF: ${pdfRealized}`);

    // Validação de Contrato
    expect(dashboardRealized).toBe(operationalCount);
    expect(pdfRealized).toBe(operationalCount);
    expect(dashboardRealized).toBe(146); // Valor auditado da KING Ago/2026
  });

  it('TESTE 2 & 3: Regra de Vigência e Reversão', async () => {
    // Verificar se importações revertidas são ignoradas
    const { data: revertedImports } = await supabaseAdmin
      .from('mk9_checklist_imports')
      .select('id')
      .eq('industry_id', industryId)
      .not('reverted_at', 'is', null);

    if (revertedImports && revertedImports.length > 0) {
      const operationalWithReverted = await listOperationalActualVisits({
        industryId,
        startDate: '2000-01-01',
        endDate: '2099-12-31',
        sourceImportId: revertedImports[0].id
      });
      
      // Se pedirmos explicitamente uma revertida, ela vem (para auditoria de histórico)
      // Mas no fluxo normal (sem sourceImportId), ela deve sumir.
      const operationalNormal = await listOperationalActualVisits({
        industryId,
        startDate: '2000-01-01',
        endDate: '2099-12-31'
      });
      
      const containsReverted = operationalNormal.some(v => v.source_import_id === revertedImports[0].id);
      expect(containsReverted).toBe(false);
    }
  });

  it('TESTE 4: Visitas manuais (source_import_id IS NULL)', async () => {
    const { data: manualVisits } = await supabaseAdmin
      .from('mk9_actual_visits')
      .select('id')
      .eq('industry_id', industryId)
      .is('source_import_id', null)
      .limit(1);

    if (manualVisits && manualVisits.length > 0) {
      const operational = await listOperationalActualVisits({
        industryId,
        startDate: '2000-01-01',
        endDate: '2099-12-31'
      });
      
      const foundManual = operational.some(v => v.source_import_id === null);
      expect(foundManual).toBe(true);
    }
  });

  it('TESTE 5 & 6: Filtro de Data (Janela Cruzada)', async () => {
    const startDate = '2026-07-23';
    const endDate = '2026-08-22';
    
    const visits = await listOperationalActualVisits({
      industryId,
      startDate,
      endDate
    });

    // Validar que nenhuma visita está fora do range
    visits.forEach(v => {
      expect(v.scheduled_date >= startDate).toBe(true);
      expect(v.scheduled_date <= endDate).toBe(true);
    });
  });

  it('TESTE 7: Importações com Alerta (INCONSISTENT/ALERTS)', async () => {
    const { data: inconsistent } = await supabaseAdmin
      .from('mk9_checklist_imports')
      .select('id')
      .eq('industry_id', industryId)
      .in('status', ['INCONSISTENT', 'COMPLETED_WITH_ALERTS'])
      .eq('is_operational_current' as any, true)
      .limit(1);

    if (inconsistent && inconsistent.length > 0) {
      const visits = await listOperationalActualVisits({
        industryId,
        startDate: '2000-01-01',
        endDate: '2099-12-31'
      });
      
      const hasVisitsFromInconsistent = visits.some(v => v.source_import_id === inconsistent[0].id);
      expect(hasVisitsFromInconsistent).toBe(true);
    }
  });
});