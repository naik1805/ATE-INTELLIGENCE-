"use client";

import { useQuery } from "@tanstack/react-query";
import { AGENT_POLL_INTERVAL_MS } from "../../agents.config";
import { fetchAgentKpis } from "@/services/agentsApi";
import type { AgentKpiSnapshot } from "@/types/agents";

/**
 * Polls one agent's KPI wrapper on the existing TanStack Query stack.
 * A wrapper being down is an expected state, not a dashboard error, so a
 * failed fetch resolves to a synthetic "error" snapshot instead of throwing.
 */
export function useAgentKpis(agentId: string, options?: { enabled?: boolean }) {
  return useQuery<AgentKpiSnapshot>({
    queryKey: ["agent-kpis", agentId],
    queryFn: () => fetchAgentKpis(agentId),
    enabled: options?.enabled ?? true,
    refetchInterval: AGENT_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    retry: 1,
  });
}
