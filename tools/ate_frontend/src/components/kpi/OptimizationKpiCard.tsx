"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { getAgentIdForKpi } from "@/lib/agentKpiLinks";
import { useAgentKpis } from "@/hooks/useAgentKpis";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { DeferredMount } from "@/components/kpi/DeferredMount";
import { KpiMetricTile } from "@/components/kpi/KpiMetricTile";
import { RetestFlashIcon } from "@/components/kpi/RetestFlashIcon";
import { RetestLiveFeed } from "@/components/kpi/RetestLiveFeed";
import { ShmooCapabilityTiles } from "@/components/kpi/ShmooCapabilityTiles";
import { ShmooPlotPreview } from "@/components/kpi/ShmooPlotPreview";
import { TestTimePreview } from "@/components/kpi/TestTimePreview";
import {
  RETEST_AI_RECOMMENDATIONS,
  type RetestAiRecommendation,
  type ShmooCapabilityMetric,
  type TestTimeCapabilityMetric,
} from "@/lib/kpiExternalPages";
import type { Kpi } from "@/types/kpi";

export interface OptimizationKpiCardProps {
  kpi: Kpi;
  onOpen?: (kpiId: string) => void;
  shmooMetrics?: ShmooCapabilityMetric[];
  testTimeMetrics?: TestTimeCapabilityMetric[];
  retestRecommendations?: RetestAiRecommendation[];
}

export function OptimizationKpiCard({
  kpi,
  shmooMetrics,
  retestRecommendations,
}: OptimizationKpiCardProps) {
  const digits = kpi.unit === "%" && kpi.value > 90 ? 2 : 1;
  const agentId = getAgentIdForKpi(kpi.id);
  const agent = useAgentKpis(agentId ?? "", { enabled: Boolean(agentId) });
  const agentLive = agent.data?.status === "running" ? agent.data : null;
  const agentValue = (id: string) => agentLive?.kpis.find((k) => k.id === id)?.value;
  const isShmoo = kpi.id === "m_bist_shmoo";
  const isRetest =
    kpi.id === "retest_reduction" || /retest\s*reduction/i.test(kpi.name ?? "");
  const isTestTime =
    kpi.id === "test_time_reduction" || /test\s*time\s*optimization/i.test(kpi.name ?? "");
  const isDense = isShmoo || isRetest || isTestTime;
  // Prefer the live agent's own recommendation split over the demo constants.
  const agentRecs: RetestAiRecommendation[] | null =
    isRetest && agentLive && agentValue("retest_events") !== undefined
      ? [
          {
            ...RETEST_AI_RECOMMENDATIONS[0],
            events: agentValue("retest_events") ?? 0,
            devices: agentValue("retest_devices") ?? 0,
          },
          {
            ...RETEST_AI_RECOMMENDATIONS[1],
            events: agentValue("dont_retest_events") ?? 0,
            devices: agentValue("dont_retest_devices") ?? 0,
          },
        ]
      : null;

  const aiRecs = isRetest
    ? (agentRecs ?? retestRecommendations ?? RETEST_AI_RECOMMENDATIONS)
    : [];

  // Headline comes from the local agent when it is running, else the dashboard API.
  const agentHeadline = isRetest ? agentValue("retest_reduction_pct") : undefined;
  const headlineValue = agentHeadline ?? kpi.value;

  let details: ReactNode = null;
  if (isShmoo) {
    details = (
      <div className="flex min-h-0 flex-col gap-1.5">
        <div className="grid shrink-0 grid-cols-2 gap-x-3 gap-y-1">
          <ShmooCapabilityTiles metrics={shmooMetrics} size="card" />
        </div>
        <DeferredMount minHeight={148}>
          <ShmooPlotPreview compact />
        </DeferredMount>
      </div>
    );
  } else if (isRetest && aiRecs.length > 0) {
    details = (
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {aiRecs.map((rec) => (
            <KpiMetricTile
              key={rec.id}
              icon={<RetestFlashIcon size={9} />}
              eyebrow="AI Recommended"
              title={rec.title}
              size="card"
              metrics={[
                { label: "Events", value: rec.events, color: rec.valueColor },
                { label: "Devices", value: rec.devices, color: rec.valueColor },
              ]}
            />
          ))}
        </div>
        <DeferredMount minHeight={190}>
          <RetestLiveFeed compact />
        </DeferredMount>
      </div>
    );
  } else if (isTestTime) {
    details = (
      <DeferredMount minHeight={200}>
        <TestTimePreview compact />
      </DeferredMount>
    );
  } else {
    details = (
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <KpiMetricTile
          size="card"
          eyebrow="Metric"
          title="Target"
          metrics={[
            {
              label: "Value",
              value: Number.isFinite(kpi.target) ? kpi.target : "—",
              unit: Number.isFinite(kpi.target) ? kpi.unit : undefined,
            },
          ]}
        />
        <KpiMetricTile
          size="card"
          eyebrow="Metric"
          title="Baseline"
          metrics={[
            {
              label: "Value",
              value: Number.isFinite(kpi.baseline) ? kpi.baseline : "—",
              unit: Number.isFinite(kpi.baseline) ? kpi.unit : undefined,
            },
          ]}
        />
      </div>
    );
  }

  const rootClassName = `vl-card relative flex h-full w-full flex-col overflow-hidden text-left ${
    isDense ? "min-h-[280px] gap-1.5 p-3.5" : "min-h-[260px] gap-3 p-5"
  }`;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div
          className={`font-semibold tracking-[0.01em] text-[var(--text-bright)] ${
            isDense ? "text-[12px]" : "text-[13px]"
          }`}
        >
          {kpi.name}
          {agentLive ? (
            <span className="ml-1.5 rounded bg-[var(--green-dim)] px-[5px] py-px text-[8px] font-semibold tracking-[0.06em] text-[var(--green)]">
              AGENT
            </span>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded px-[7px] py-0.5 text-[10px] font-semibold tracking-[0.04em] transition-[background-color,color] duration-200 ${
            kpi.trend === "up"
              ? "bg-[var(--green-dim)] text-[var(--green)]"
              : kpi.trend === "down"
                ? "bg-[var(--red-dim)] text-[var(--red)]"
                : "bg-[var(--cyan-dim)] text-[var(--cyan)]"
          }`}
        >
          {kpi.trend === "up" ? "▲" : kpi.trend === "down" ? "▼" : "■"} {kpi.trend}
        </span>
      </div>

      <div
        className={`font-display font-bold leading-none text-white ${
          isDense ? "text-[22px]" : "text-[34px]"
        }`}
      >
        <AnimatedNumber value={headlineValue} digits={digits} />
        <span
          className={`ml-1 font-medium text-[var(--text-soft)] ${
            isDense ? "text-[12px]" : "text-[15px]"
          }`}
        >
          {kpi.unit}
        </span>
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col border-t border-[rgba(107,193,242,0.14)] ${
          isDense ? "mt-1 pt-1.5" : "mt-2 pt-3"
        }`}
      >
        {details}
      </div>
    </>
  );

  if (agentId) {
    return (
      <Link href={`/agents/${agentId}`} className={`${rootClassName} no-underline`}>
        {body}
      </Link>
    );
  }

  return <div className={rootClassName}>{body}</div>;
}
