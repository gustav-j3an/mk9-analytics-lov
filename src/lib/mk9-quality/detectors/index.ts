export { projectionFrequencyDivergenceDetector } from "./projection-frequency-divergence";
export { frequencyOverlapGuardDetector } from "./frequency-overlap-guard";
export { legacyOperationalDataDetector } from "./legacy-operational-data";

import { projectionFrequencyDivergenceDetector } from "./projection-frequency-divergence";
import { frequencyOverlapGuardDetector } from "./frequency-overlap-guard";
import { legacyOperationalDataDetector } from "./legacy-operational-data";
import type { Mk9DataQualityDetector } from "../types";

/**
 * Registro central de detectores. A Fase 2B.1 entrega apenas os três
 * detectores técnicos que validam a arquitetura; o MVP virá depois.
 */
export const MK9_QUALITY_DETECTORS: Mk9DataQualityDetector[] = [
  projectionFrequencyDivergenceDetector,
  frequencyOverlapGuardDetector,
  legacyOperationalDataDetector,
];
