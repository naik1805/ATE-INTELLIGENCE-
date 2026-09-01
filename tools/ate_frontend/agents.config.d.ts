export interface AgentEndpointConfig {
  agent_id: string;
  name: string;
  base_url: string;
  kpi_endpoint: string;
  status_endpoint: string;
  /** The agent's own UI, embedded in its detail view. */
  ui_url: string;
  /** The agent's own backend API base. */
  api_url: string;
  /** Name of the env var that overrides base_url. */
  env_var: string;
  /** True when the env var is unset and the inferred loopback port is in use. */
  using_fallback: boolean;
}

export declare const AGENTS: Record<string, AgentEndpointConfig>;
export declare const AGENT_IDS: string[];
export declare function getAgentConfig(agentId: string): AgentEndpointConfig | null;
export declare const AGENT_POLL_INTERVAL_MS: number;
export declare const DEFAULT_DATA_URL: string;
export declare function getAgentUiUrl(
  agentId: string,
  autoload?: boolean,
): string | null;
