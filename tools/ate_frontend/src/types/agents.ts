/** Shared response contract exposed by all four agent KPI wrappers. */

export type AgentStatus = "running" | "idle" | "error";

export interface AgentKpi {
  id: string;
  label: string;
  value: number;
  unit: string;
  trend: "up" | "down" | "flat";
  precision: number;
}

/** Live fail-bitmap face for RA Advisor KPI cards. */
export interface RaAdvisorSpatialFeatures {
  rows_above_thresh: number;
  cols_above_thresh: number;
  max_row_frac: number;
  max_col_frac: number;
  failing_density: number;
  compactness: number;
  total_fails: number;
  bbox_area: number;
}

export interface RaAdvisorPreview {
  archetype: string;
  rows: number;
  cols: number;
  bitmap: number[][];
  features: RaAdvisorSpatialFeatures;
  recommendation?: string | null;
  confidence?: number | null;
}

export interface AgentKpiSnapshot {
  agent_id: string;
  name: string;
  status: AgentStatus;
  generated_at: string;
  last_activity_at: string | null;
  /** Human-readable description of where these numbers were read from. */
  source: string;
  /** The agent's own UI, linked from its detail view. */
  detail_url: string;
  kpis: AgentKpi[];
  /** Caveats the wrapper wants surfaced rather than silently swallowed. */
  warnings: string[];
  /** Optional agent-specific live preview payload (RA Advisor fail-bitmap). */
  preview?: RaAdvisorPreview | null;
}

export interface AgentStatusResponse {
  status: AgentStatus;
}
