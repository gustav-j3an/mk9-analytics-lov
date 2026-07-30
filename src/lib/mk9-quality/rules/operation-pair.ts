/**
 * MK9 — Fase 2B.2: regra PURA do "par de operação" (indústria × loja).
 *
 * Decisão de arquitetura da Fase 2A: em vez de três detectores gerando três
 * ocorrências para o MESMO par (sem frequência, sem roteiro, visita sem rota),
 * existe UMA ocorrência consolidada por par, com a lista de sintomas. Isso
 * evita inundar o painel com o mesmo problema repetido.
 *
 * Sem I/O — recebe os fatos já apurados e decide.
 */
import type { Mk9QualitySeverity } from "../types";

export type OperationPairSymptom =
  | "NO_FREQUENCY"
  | "ZERO_FREQUENCY"
  | "NO_ROUTE"
  | "VISITS_WITHOUT_ROUTE"
  | "ROUTE_WITHOUT_FREQUENCY";

export interface OperationPairFacts {
  industryId: string;
  storeId: string;
  /** possui vigência de frequência intersectando o período */
  hasFrequency: boolean;
  /** visitas contratadas calculadas para o período */
  contractedVisits: number;
  /** rotas ativas (vigentes) no período */
  routeCount: number;
  /** visitas realizadas registradas no período */
  executedVisits: number;
}

export interface OperationPairEvaluation {
  symptoms: OperationPairSymptom[];
  severity: Mk9QualitySeverity;
  title: string;
  description: string;
  suggestedAction: string;
}

const SYMPTOM_LABEL: Record<OperationPairSymptom, string> = {
  NO_FREQUENCY: "sem frequência contratada vigente",
  ZERO_FREQUENCY: "frequência vigente resulta em zero visitas no período",
  NO_ROUTE: "sem roteiro ativo",
  VISITS_WITHOUT_ROUTE: "visitas realizadas sem roteiro correspondente",
  ROUTE_WITHOUT_FREQUENCY: "roteiro ativo sem frequência contratada",
};

/**
 * Ordem de gravidade (a maior vence):
 *   BLOQUEANTE → execução acontecendo totalmente fora do contrato
 *   CRITICO    → contratado sem meio de executar (frequência sem roteiro)
 *   ATENCAO    → inconsistência de cadastro sem impacto imediato no número
 */
export function evaluateOperationPair(facts: OperationPairFacts): OperationPairEvaluation | null {
  const symptoms: OperationPairSymptom[] = [];

  if (!facts.hasFrequency) symptoms.push("NO_FREQUENCY");
  else if (facts.contractedVisits <= 0) symptoms.push("ZERO_FREQUENCY");

  if (facts.routeCount === 0) symptoms.push("NO_ROUTE");
  if (facts.routeCount === 0 && facts.executedVisits > 0) symptoms.push("VISITS_WITHOUT_ROUTE");
  if (facts.routeCount > 0 && !facts.hasFrequency) symptoms.push("ROUTE_WITHOUT_FREQUENCY");

  // Par saudável: frequência vigente + roteiro ativo.
  if (!symptoms.length) return null;

  // Par completamente vazio (sem frequência, sem rota, sem visita) não é um
  // problema: é apenas uma loja que não pertence a esta indústria no período.
  if (!facts.hasFrequency && facts.routeCount === 0 && facts.executedVisits === 0) return null;

  let severity: Mk9QualitySeverity = "ATENCAO";
  if (symptoms.includes("VISITS_WITHOUT_ROUTE")) severity = "BLOQUEANTE";
  else if (facts.hasFrequency && facts.contractedVisits > 0 && facts.routeCount === 0) severity = "CRITICO";
  else if (symptoms.includes("ROUTE_WITHOUT_FREQUENCY")) severity = "CRITICO";

  const description =
    `Par indústria × loja com inconsistência operacional: ` +
    symptoms.map((s) => SYMPTOM_LABEL[s]).join("; ") + ".";

  const suggestedAction = symptoms.includes("NO_FREQUENCY")
    ? "Cadastrar a vigência de frequência da loja nesta indústria ou remover a loja do roteiro."
    : symptoms.includes("NO_ROUTE")
      ? "Cadastrar o roteiro (promotor e dia) para atender a frequência contratada."
      : "Revisar o cadastro do par indústria × loja para o período.";

  return {
    symptoms,
    severity,
    title: "Par indústria × loja incompleto",
    description,
    suggestedAction,
  };
}
