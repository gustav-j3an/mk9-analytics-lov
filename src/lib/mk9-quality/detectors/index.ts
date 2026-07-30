export { projectionFrequencyDivergenceDetector } from "./projection-frequency-divergence";
export { frequencyWeeklyMonthlyInconsistencyDetector } from "./frequency-weekly-monthly-inconsistency";
export { frequencyOverlapGuardDetector } from "./frequency-overlap-guard";
export { legacyOperationalDataDetector } from "./legacy-operational-data";
export { probableStoreDuplicateDetector } from "./probable-store-duplicate";
export { operationPairIntegrityDetector } from "./operation-pair-integrity";
export { excelDatabaseDivergenceDetector } from "./excel-database-divergence";
export { pendingImportConflictDetector } from "./pending-import-conflict";
export { industryPeriodConfigDetector } from "./industry-period-config";
export { checklistValidationDetector } from "./checklist-validation";
export { incompleteStoreExecutionDetector } from "./incomplete-store-execution";

import { projectionFrequencyDivergenceDetector } from "./projection-frequency-divergence";
import { frequencyWeeklyMonthlyInconsistencyDetector } from "./frequency-weekly-monthly-inconsistency";
import { frequencyOverlapGuardDetector } from "./frequency-overlap-guard";
import { legacyOperationalDataDetector } from "./legacy-operational-data";
import { probableStoreDuplicateDetector } from "./probable-store-duplicate";
import { operationPairIntegrityDetector } from "./operation-pair-integrity";
import { excelDatabaseDivergenceDetector } from "./excel-database-divergence";
import { pendingImportConflictDetector } from "./pending-import-conflict";
import { industryPeriodConfigDetector } from "./industry-period-config";
import { checklistValidationDetector } from "./checklist-validation";
import { incompleteStoreExecutionDetector } from "./incomplete-store-execution";
import type { Mk9DataQualityDetector } from "../types";

/**
 * Registro central de detectores.
 *
 * Fase 2B.1 — três detectores técnicos (validação da arquitetura).
 * Fase 2B.2 — sete detectores operacionais do MVP, cobrindo os 10 problemas
 * priorizados na auditoria da Fase 2A (o detector de par consolida três deles
 * numa única ocorrência por indústria × loja).
 *
 * A ordem importa: cadastro primeiro (causa raiz), execução depois, técnico
 * por último.
 */
export const MK9_QUALITY_DETECTORS: Mk9DataQualityDetector[] = [
  probableStoreDuplicateDetector,
  incompleteStoreExecutionDetector,
  industryPeriodConfigDetector,
  operationPairIntegrityDetector,
  frequencyWeeklyMonthlyInconsistencyDetector,
  excelDatabaseDivergenceDetector,
  checklistValidationDetector,
  pendingImportConflictDetector,
  projectionFrequencyDivergenceDetector,
  frequencyOverlapGuardDetector,
  legacyOperationalDataDetector,
];
