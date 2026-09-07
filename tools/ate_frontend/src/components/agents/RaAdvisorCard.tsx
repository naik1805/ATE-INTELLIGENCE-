"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DeferredMount } from "@/components/kpi/DeferredMount";
import { RaAdvisorLivePreview } from "@/components/kpi/RaAdvisorLivePreview";
import { useAgentKpis } from "@/hooks/useAgentKpis";
import { synthesizeRaAdvisorPreview } from "@/lib/raAdvisorPreview";

/** Occupies the former Yield Improvement slot in Optimization Parameters. */
export function RaAdvisorCard() {
  const { data, dataUpdatedAt, isLoading } = useAgentKpis("ra_advisor");
  const status = data?.status === "error" ? "idle" : (data?.status ?? "idle");
  const live = status === "running";
  const accuracy = data?.kpis?.find((k) => k.id === "top1_accuracy");

  const preview = useMemo(() => {
    const fromAgent = data?.preview;
    if (fromAgent?.bitmap?.length) return fromAgent;
    // Keep a live-looking face even while the wrapper is warming up.
    return synthesizeRaAdvisorPreview(Math.floor(dataUpdatedAt / 12_000) || 0);
  }, [data?.preview, dataUpdatedAt]);

  return (
    <Link
      href="/agents/ra_advisor"
      className="vl-card relative flex min-h-[220px] flex-col gap-2 overflow-hidden p-3.5 text-left no-underline"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] font-semibold tracking-[0.01em] text-[var(--text-bright)]">
          RA Advisor
          {live ? (
            <span className="ml-1.5 rounded bg-[var(--green-dim)] px-[5px] py-px text-[8px] font-semibold tracking-[0.06em] text-[var(--green)]">
              LIVE
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {accuracy ? (
            <span className="rounded bg-[rgba(107,193,242,0.1)] px-[6px] py-0.5 font-mono text-[10px] font-semibold text-[var(--cyan)]">
              {accuracy.value.toFixed(accuracy.precision)}
              {accuracy.unit}
            </span>
          ) : null}
          <span className="rounded bg-[var(--cyan-dim)] px-[7px] py-0.5 text-[10px] font-semibold text-[var(--cyan)]">
            {live ? "running" : isLoading ? "…" : "idle"}
          </span>
        </div>
      </div>

      <DeferredMount className="flex min-h-0 flex-1 flex-col" minHeight={148}>
        <RaAdvisorLivePreview preview={preview} compact />
      </DeferredMount>
    </Link>
  );
}
