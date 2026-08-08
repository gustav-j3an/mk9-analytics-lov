// Camada única de métricas de visitas do MK9.
// Pura, sem I/O. Todas as telas (Conciliação, Dashboard, Relatório PDF,
// Relatório do Supervisor) devem usar estas funções para evitar regressão
// e garantir a mesma definição de contratadas / executadas / válidas /
// extras / pendências / cobertura.
//
// Definições:
//   contratadas: quantidade esperada de visitas no período (por loja =
//     entradas do roteiro planejado dentro do ciclo configurado).
//   executadas : todas as visitas importadas via checklist no período
//     (sem limite, inclui excedentes).
//   validas    : min(contratadas, executadas) por loja. É o que conta
//     para a cobertura contratual.
//   extras     : max(0, executadas - contratadas) por loja. Visitas que
//     excederam o contrato e NÃO compensam pendências de outras lojas.
//   pendencias : max(0, contratadas - validas) por loja.
//   coberturaPct: sum(validas) / sum(contratadas) * 100.

export interface VisitMetrics {
  contratadas: number;
  executadas: number;
  validas: number;
  extras: number;
  pendencias: number;
  coberturaPct: number;
}

/** Métrica para UMA loja (ou entidade agregada em nível 1:1). */
export function computeVisitMetrics(input: {
  contratadas: number;
  executadas: number;
}): VisitMetrics {
  const contratadas = Math.max(0, Math.round(input.contratadas ?? 0));
  const executadas = Math.max(0, Math.round(input.executadas ?? 0));
  const validas = Math.min(contratadas, executadas);
  const extras = Math.max(0, executadas - contratadas);
  const pendencias = Math.max(0, contratadas - validas);
  const coberturaPct = contratadas > 0 ? Math.round((validas / contratadas) * 100) : 0;
  return { contratadas, executadas, validas, extras, pendencias, coberturaPct };
}

/**
 * Agregação correta a partir de pares por loja. Somar "validas" DE CADA LOJA
 * é a única forma correta — nunca use min(sum(contratadas), sum(executadas)).
 */
export function aggregateVisitMetrics(
  perStore: Array<{ contratadas: number; executadas: number }>,
): VisitMetrics {
  let contratadas = 0;
  let executadas = 0;
  let validas = 0;
  let extras = 0;
  let pendencias = 0;
  for (const s of perStore) {
    const m = computeVisitMetrics(s);
    contratadas += m.contratadas;
    executadas += m.executadas;
    validas += m.validas;
    extras += m.extras;
    pendencias += m.pendencias;
  }
  const coberturaPct = contratadas > 0 ? Math.round((validas / contratadas) * 100) : 0;
  return { contratadas, executadas, validas, extras, pendencias, coberturaPct };
}
