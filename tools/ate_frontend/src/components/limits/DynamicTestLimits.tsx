"use client";

import Link from "next/link";
import { DtlRecommendationsPreview } from "@/components/limits/DtlRecommendationsPreview";
import { useAgentKpis } from "@/hooks/useAgentKpis";

export function DynamicTestLimits() {
  const agent = useAgentKpis("dtl");
  const agentLive = agent.data?.status === "running";

  return (
    <div className="vl-card relative flex min-h-[280px] flex-col gap-2 overflow-hidden p-3.5">
      <Link
        href="/agents/dtl"
        className="absolute inset-0 z-[1] rounded-[inherit]"
        aria-label="Open Dynamic Test Limits agent"
      />
      <div className="relative z-[2] flex min-h-0 flex-1 flex-col gap-2 pointer-events-none">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[12px] font-semibold tracking-[0.01em] text-[var(--text-bright)]">
            Dynamic Test Limits
            {agentLive ? (
              <span className="ml-1.5 rounded bg-[var(--green-dim)] px-[5px] py-px text-[8px] font-semibold tracking-[0.06em] text-[var(--green)]">
                AGENT
              </span>
            ) : null}
          </div>
          <span className="shrink-0 rounded bg-[var(--cyan-dim)] px-[7px] py-0.5 text-[10px] font-semibold text-[var(--cyan)]">
            3 months
          </span>
        </div>

        <div className="min-h-0 flex-1">
          <DtlRecommendationsPreview live={agentLive} />
        </div>
      </div>
    </div>
  );
}
