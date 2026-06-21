import { getDbInstance } from "./core";

/**
 * Aggregation queries over `call_logs` extracted from route handlers.
 * Routes delegate here so raw SQL stays out of route modules.
 */

export interface ProviderMetricRow {
  provider: string;
  totalRequests: number;
  totalSuccesses: number;
  avgLatencyMs: number;
  lastRequestAt: string | null;
  lastErrorAt: string | null;
  lastStatus: number | null;
  lastErrorStatus: number | null;
}

export function getProviderMetrics(): ProviderMetricRow[] {
  const db = getDbInstance();
  return db
    .prepare(
      `SELECT
          c.provider,
          COUNT(*) as totalRequests,
          SUM(CASE WHEN status >= 200 AND status < 400 THEN 1 ELSE 0 END) as totalSuccesses,
          ROUND(AVG(duration)) as avgLatencyMs,
          MAX(timestamp) as lastRequestAt,
          MAX(
            CASE
              WHEN (status IS NOT NULL AND (status < 200 OR status >= 400))
                OR error_summary IS NOT NULL
              THEN timestamp
              ELSE NULL
            END
          ) as lastErrorAt,
          (
            SELECT c2.status
            FROM call_logs c2
            WHERE c2.provider = c.provider
            ORDER BY c2.timestamp DESC, c2.id DESC
            LIMIT 1
          ) as lastStatus,
          (
            SELECT c3.status
            FROM call_logs c3
            WHERE c3.provider = c.provider
              AND (
                (c3.status IS NOT NULL AND (c3.status < 200 OR c3.status >= 400))
                OR c3.error_summary IS NOT NULL
              )
            ORDER BY c3.timestamp DESC, c3.id DESC
            LIMIT 1
          ) as lastErrorStatus
        FROM call_logs c
        WHERE c.provider IS NOT NULL AND c.provider != '-'
        GROUP BY c.provider`
    )
    .all() as ProviderMetricRow[];
}

export interface FallbackStatsRow {
  total: number;
  with_requested: number;
  fallback_eligible: number;
  fallbacks: number;
}

export function getFallbackStats(
  whereClause: string,
  params: Record<string, string>
): FallbackStatsRow {
  const db = getDbInstance();
  const row = db
    .prepare(
      `
      SELECT
        SUM(CASE WHEN (combo_name IS NULL OR combo_name = '') THEN 1 ELSE 0 END) as total,
        SUM(CASE WHEN requested_model IS NOT NULL AND requested_model != '' AND (combo_name IS NULL OR combo_name = '') THEN 1 ELSE 0 END) as with_requested,
        SUM(CASE
          WHEN (combo_name IS NULL OR combo_name = '')
           AND requested_model IS NOT NULL
           AND requested_model != ''
           AND model IS NOT NULL
           AND model != ''
          THEN 1 ELSE 0 END
        ) as fallback_eligible,
        SUM(CASE
          WHEN (combo_name IS NULL OR combo_name = '')
           AND requested_model IS NOT NULL
           AND requested_model != ''
           AND model IS NOT NULL
           AND model != ''
           AND LOWER(CASE WHEN instr(requested_model, '/') > 0 THEN substr(requested_model, instr(requested_model, '/') + 1) ELSE requested_model END) != LOWER(model)
          THEN 1 ELSE 0 END
        ) as fallbacks
      FROM call_logs
      ${whereClause}
    `
    )
    .get(params) as FallbackStatsRow | undefined;
  return row ?? { total: 0, with_requested: 0, fallback_eligible: 0, fallbacks: 0 };
}
