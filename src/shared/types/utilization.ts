export interface QuotaSnapshotRow {
  id: number;
  provider: string;
  connection_id: string;
  window_key: string;
  remaining_percentage: number | null;
  is_exhausted: number;
  next_reset_at: string | null;
  window_duration_ms: number | null;
  raw_data: string | null;
  created_at: string;
}

export interface ProviderUtilizationPoint {
  timestamp: string;
  provider: string;
  remainingPct: number;
  isExhausted: boolean;
  windowKey: string;
}

export interface ComboHealthMetrics {
  comboId: string;
  comboName: string;
  strategy: string;
  models: string[];
  targetHealth?: Array<{
    executionKey: string;
    stepId: string;
    model: string;
    provider: string;
    connectionId: string | null;
    label: string | null;
    requests: number;
    successRate: number;
    avgLatencyMs: number;
    lastStatus: "ok" | "error" | null;
    lastUsedAt: string | null;
    quotaRemainingPct: number | null;
    quotaIsExhausted: boolean | null;
    quotaTrend: "improving" | "stable" | "declining" | null;
    quotaScope: "connection" | "provider" | "none";
  }>;
  quotaHealth: {
    providers: Array<{
      provider: string;
      remainingPct: number;
      isExhausted: boolean;
      trend: "improving" | "stable" | "declining";
    }>;
    worstRemainingPct: number;
  };
  usageSkew: {
    modelDistribution: Array<{
      model: string;
      requestShare: number;
      tokenShare: number;
    }>;
    giniCoefficient: number;
  };
  performance: {
    avgLatencyMs: number;
    successRate: number;
    totalRequests: number;
  };
}

export interface ComboHealthResponse {
  timeRange: "1h" | "24h" | "7d" | "30d";
  combos: ComboHealthMetrics[];
}

export interface ComboRecord {
  id?: string;
  name?: string;
  strategy?: string;
  models?: unknown[];
}

export type UtilizationTimeRange = "1h" | "24h" | "7d" | "30d";
