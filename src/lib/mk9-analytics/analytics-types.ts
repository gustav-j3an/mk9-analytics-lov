import { z } from "zod";

export const TrendStatusSchema = z.enum(["IMPROVING", "STABLE", "WORSENING"]);
export type TrendStatus = z.infer<typeof TrendStatusSchema>;

export const RiskScoreSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type RiskScore = z.infer<typeof RiskScoreSchema>;

export interface AnalyticsMetric {
  current: number;
  previous: number;
  delta: number;
  percentChange?: number;
}

export interface IndustryEvolution {
  industryId: string;
  industryName: string;
  coverage: AnalyticsMetric;
  zeroVisits: AnalyticsMetric;
  trend: TrendStatus;
  risk: RiskScore;
  reason?: string;
}

export interface UfPerformance {
  uf: string;
  stores: number;
  contracted: number;
  realized: number;
  coverage: number;
  zeroVisits: number;
  variationVsPrevious: number;
}

export interface RecurrenceRecord {
  storeId: string;
  storeName: string;
  uf: string;
  history: {
    period: string;
    realized: number;
    contracted: number;
    coverage: number;
  }[];
  status: "CRITICAL_RECURRENT" | "IMPROVING" | "STABLE";
}

export interface FrequencyExecutionGroup {
  frequency: string;
  stores: number;
  avgCoverage: number;
  completedCount: number;
  partialCount: number;
  zeroCount: number;
  extras: number;
}

export interface AnalyticsDashboardPayload {
  period: {
    current: string;
    previous: string;
    isClosed: boolean;
  };
  executive: {
    contracted: AnalyticsMetric;
    realized: AnalyticsMetric;
    pending: AnalyticsMetric;
    extras: AnalyticsMetric;
    coverage: AnalyticsMetric;
    zeroVisits: AnalyticsMetric;
  };
  industries: IndustryEvolution[];
  ufs: UfPerformance[];
  recurrence: RecurrenceRecord[];
  frequencies: FrequencyExecutionGroup[];
  projection?: {
    expectedFinalRealized: number;
    status: "ON_TRACK" | "AT_RISK";
    daysRemaining: number;
  };
  lastUpdate: string;
}
