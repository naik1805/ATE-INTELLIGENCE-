"use client";

import { AGENTS, AGENT_IDS } from "../../../agents.config";
import { AgentKpiCard } from "@/components/agents/AgentKpiCard";

/** Integrated agent cards, laid out on the same two-column grid as OptimizationKpiGrid. */
export function AgentKpiSection() {
  return (
    <div className="mb-[26px] grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2">
      {AGENT_IDS.map((id) => (
        <AgentKpiCard key={id} config={AGENTS[id]} />
      ))}
    </div>
  );
}
