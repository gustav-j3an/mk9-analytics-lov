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
 * Volume a partir do qual "visita sem roteiro" deixa de ser exceção
 * operacional e passa a distorcer o número do período.
 */
export const VISITS_WITHOUT_ROUTE_CRITICAL_VOLUME = 4;

const SEVERITY_WEIGHT: Record<Mk9QualitySeverity, number> = {
  INFO: 1, AVISO: 2, ATENCAO: 3, CRITICO: 4, BLOQUEANTE: 5,
};

function worst(a: Mk9QualitySeverity, b: Mk9QualitySeverity): Mk9QualitySeverity {
  return SEVERITY_WEIGHT[b] > SEVERITY_WEIGHT[a] ? b : a;
}

/**
 * REGRA FINAL DE GRAVIDADE (Fase 2B.3 — item 0.A).
 *
 * Visita sem roteiro NÃO é automaticamente BLOQUEANTE: na operação real é o
 * sintoma mais comum e classificá-lo sempre como bloqueante torna o painel
 * inútil. A regra passa a ser graduada, e a gravidade final é a PIOR entre
 * os sintomas presentes:
 *
 *   ATENCAO    → sintoma isolado de cadastro, sem impacto imediato no número
 *                (ex.: frequência zerada, poucas visitas sem roteiro dentro de
 *                um par que tem contrato).
 *   CRITICO    → contratado sem meio de executar (frequência sem roteiro);
 *                roteiro ativo sem frequência contratada;
 *                volume de visitas sem roteiro ≥ 4 no período (distorce o
 *                indicador de execução do período).
 *   BLOQUEANTE → execução acontecendo TOTALMENTE fora do contrato: existem
 *                visitas realizadas, não existe roteiro e não existe
 *                frequência vigente. Nesse cenário a importação/conciliação
 *                não consegue decidir a que contrato a visita pertence, o que
 *                gera divergência de dados — por isso bloqueia.
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
  if (facts.hasFrequency && facts.contractedVisits > 0 && facts.routeCount === 0) {
    severity = worst(severity, "CRITICO");
  }
  if (symptoms.includes("ROUTE_WITHOUT_FREQUENCY")) severity = worst(severity, "CRITICO");
  if (symptoms.includes("VISITS_WITHOUT_ROUTE")) {
    severity = worst(
      severity,
      !facts.hasFrequency
        ? "BLOQUEANTE"
        : facts.executedVisits >= VISITS_WITHOUT_ROUTE_CRITICAL_VOLUME
          ? "CRITICO"
          : "ATENCAO",
    );
  }


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
