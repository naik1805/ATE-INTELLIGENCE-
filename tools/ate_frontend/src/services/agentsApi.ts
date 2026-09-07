import { getAgentConfig } from "../../agents.config";
import type { AgentKpiSnapshot, AgentStatusResponse } from "@/types/agents";

/**
 * Agent wrappers are separate origins with permissive CORS, so these calls go
 * direct rather than through the existing /api catch-all proxy (which targets
 * the wafer-yield backend).
 */
async function getJson<T>(url: string, timeoutMs = 20_000): Promise<T> {
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

function startingSnapshot(agentId: string, name: string, uiUrl: string, kpiEndpoint: string): AgentKpiSnapshot {
  return {
    agent_id: agentId,
    name,
    // "idle" while wrappers warm up — never surface port/connection errors in the UI.
    status: "idle",
    generated_at: new Date().toISOString(),
    last_activity_at: null,
    source: kpiEndpoint,
    detail_url: uiUrl,
    kpis: [],
    warnings: [],
  };
}

export async function fetchAgentKpis(agentId: string): Promise<AgentKpiSnapshot> {
  const cfg = getAgentConfig(agentId);
  if (!cfg) {
    return startingSnapshot(agentId, agentId, "", "");
  }
  try {
    return await getJson<AgentKpiSnapshot>(cfg.kpi_endpoint);
  } catch {
    return startingSnapshot(agentId, cfg.name, cfg.ui_url, cfg.kpi_endpoint);
  }
}

export async function fetchAgentStatus(agentId: string): Promise<AgentStatusResponse> {
  const cfg = getAgentConfig(agentId);
  if (!cfg) return { status: "idle" };
  try {
    return await getJson<AgentStatusResponse>(cfg.status_endpoint, 4000);
  } catch {
    return { status: "idle" };
  }
}
