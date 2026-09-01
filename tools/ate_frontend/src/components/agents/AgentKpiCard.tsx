"use client";

import Link from "next/link";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { KpiMetricTile } from "@/components/kpi/KpiMetricTile";
import { AgentStatusPill } from "@/components/agents/AgentStatusPill";
import { useAgentKpis } from "@/hooks/useAgentKpis";
import type { AgentEndpointConfig } from "../../../agents.config";

/**
 * One card per integrated agent, using the existing .vl-card pattern.
 * The whole card is the navigation target for the agent's detail route.
 */
export function AgentKpiCard({ config }: { config: AgentEndpointConfig }) {
  const { data, isLoading, isError } = useAgentKpis(config.agent_id);

  const status = isError ? "error" : (data?.status ?? "idle");
  const kpis = data?.kpis ?? [];
  const headline = kpis[0] ?? null;
  const rest = kpis.slice(1, 5);

  return (
    <Link
      href={`/agents/${config.agent_id}`}
      className="vl-card relative flex h-full w-full flex-col gap-3 overflow-hidden p-5 text-left no-underline"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] font-semibold tracking-[0.01em] text-[var(--text-bright)]">
          {data?.name ?? config.name}
        </div>
        <AgentStatusPill status={status} />
      </div>

      <div className="font-display text-[34px] font-bold leading-none text-white">
        {headline ? (
          <>
            <AnimatedNumber value={headline.value} digits={headline.precision} />
            {headline.unit ? (
              <span className="ml-1 text-[15px] font-medium text-[var(--text-soft)]">
                {headline.unit}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-[var(--text-soft)]">—</span>
        )}
      </div>
      {headline ? (
        <div className="vl-metric-label -mt-1.5 text-[8px]">{headline.label}</div>
      ) : null}

      <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-[rgba(107,193,242,0.14)] pt-3">
        {isError ? (
          <div className="text-[11px] text-[var(--red)]">
            Wrapper unreachable at {config.base_url}
          </div>
        ) : isLoading && !data ? (
          <div className="text-[11px] text-[var(--text-dim)]">Loading agent KPIs…</div>
        ) : rest.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {rest.map((kpi) => (
              <KpiMetricTile
                key={kpi.id}
                size="card"
                eyebrow="Metric"
                title={kpi.label}
                metrics={[
                  { label: "Value", value: kpi.value, unit: kpi.unit || undefined },
                ]}
              />
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-[var(--text-dim)]">
            No KPIs reported yet.
          </div>
        )}

        {data && data.warnings.length > 0 ? (
          <div className="mt-auto pt-2 text-[10px] text-[var(--text-dim)]">
            {data.warnings.length} caveat{data.warnings.length === 1 ? "" : "s"} — open for
            detail
          </div>
        ) : null}
      </div>
    </Link>
  );
}
