import { getAgentConfig } from "../../agents.config";
import type { AgentKpiSnapshot, AgentStatusResponse } from "@/types/agents";

/**
 * Agent wrappers are separate origins with permissive CORS, so these calls go
 * direct rather than through the existing /api catch-all proxy (which targets
 * the wafer-yield backend).
 */
async function getJson<T>(url: string, timeoutMs = 6000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Agent request failed (${res.status}): ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAgentKpis(agentId: string): Promise<AgentKpiSnapshot> {
  const cfg = getAgentConfig(agentId);
  if (!cfg) throw new Error(`Unknown agent id: ${agentId}`);
  return getJson<AgentKpiSnapshot>(cfg.kpi_endpoint);
}

export async function fetchAgentStatus(agentId: string): Promise<AgentStatusResponse> {
  const cfg = getAgentConfig(agentId);
  if (!cfg) throw new Error(`Unknown agent id: ${agentId}`);
  return getJson<AgentStatusResponse>(cfg.status_endpoint, 4000);
}
