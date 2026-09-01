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
}

export interface AgentStatusResponse {
  status: AgentStatus;
}
