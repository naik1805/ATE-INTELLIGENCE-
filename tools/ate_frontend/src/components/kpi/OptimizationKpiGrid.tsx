"use client";

import type { ReactNode } from "react";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { OptimizationKpiCard } from "@/components/kpi/OptimizationKpiCard";
import {
  SHMOO_CAPABILITIES,
  TEST_TIME_CAPABILITIES,
} from "@/lib/kpiExternalPages";
import { useKpis } from "@/hooks/useKpis";
import { useLatestShmoo } from "@/hooks/useLatestShmoo";
import { useKpiStore } from "@/stores/kpiStore";

const ORDER = [
  "retest_reduction",
  "m_bist_shmoo",
  "test_time_reduction",
  "false_failure_reduction",
  "yield_improvement",
  "escape_prevention",
  "pattern_count_reduction",
];

/** Legacy / nested KPI ids — hide from the parent grid. */
const HIDDEN_KPI_IDS = new Set([
  "shmoo_yield_analysis",
  "shmoo_debugging",
  "shmoo_binning",
  "shmoo_characterization",
  "vector_memory_optimization",
]);

const DISPLAY_NAMES: Record<string, string> = {
  m_bist_shmoo: "SHMOO ML-Based Optimization",
  test_time_reduction: "Test Time Optimization",
};

function displayName(kpiId: string, fallback: string): string {
  return DISPLAY_NAMES[kpiId] ?? fallback;
}

export function OptimizationKpiGrid({
  children,
  dynamicTestLimits,
}: {
  children?: ReactNode;
  /** Rendered immediately after the Test Time Optimization card. */
  dynamicTestLimits?: ReactNode;
}) {
  const { kpis, isLoading, isError, refetch } = useKpis();
  useLatestShmoo(true);
  const kpisById = useKpiStore((s) => s.kpisById);

  const ordered = [...kpis]
    .filter((k) => !HIDDEN_KPI_IDS.has(k.id))
    .sort((a, b) => {
      const ia = ORDER.indexOf(a.id);
      const ib = ORDER.indexOf(b.id);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  if (isLoading && ordered.length === 0) {
    return <LoadingState label="Loading optimization KPIs…" />;
  }

  if (isError && ordered.length === 0) {
    return (
      <ErrorState
        message="Unable to load KPIs from the API."
        onRetry={() => void refetch()}
      />
    );
  }

  const shmooMetrics = SHMOO_CAPABILITIES.map((cap) => {
    const metric = kpisById[cap.metricKpiId] ?? kpis.find((k) => k.id === cap.metricKpiId);
    return {
      id: cap.id,
      label: cap.label,
      value: metric?.value ?? Number.NaN,
      unit: metric?.unit ?? "%",
      primaryLabel: cap.primaryLabel,
      secondaryLabel: cap.secondaryLabel,
      secondaryValue: cap.secondaryValue,
      secondaryUnit: cap.secondaryUnit,
    };
  });

  const testTimeMetrics = TEST_TIME_CAPABILITIES.map((cap) => {
    const metric = kpisById[cap.metricKpiId] ?? kpis.find((k) => k.id === cap.metricKpiId);
    return {
      id: cap.id,
      label: cap.label,
      value: metric?.value ?? Number.NaN,
      unit: metric?.unit ?? "%",
      primaryLabel: cap.primaryLabel,
    };
  });

  const falseFailureKpi = ordered.find((k) => k.id === "false_failure_reduction");
  const gridKpis = ordered.filter((k) => k.id !== "false_failure_reduction");

  return (
    <div className="mb-[26px] grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2">
      {gridKpis.flatMap((kpi) => [
        <OptimizationKpiCard
          key={kpi.id}
          kpi={{ ...kpi, name: displayName(kpi.id, kpi.name) }}
          shmooMetrics={kpi.id === "m_bist_shmoo" ? shmooMetrics : undefined}
          testTimeMetrics={kpi.id === "test_time_reduction" ? testTimeMetrics : undefined}
        />,
        ...(kpi.id === "test_time_reduction" && dynamicTestLimits
          ? [<div key="dynamic-test-limits-slot" className="contents">{dynamicTestLimits}</div>]
          : []),
      ])}
      {children}
      {falseFailureKpi ? (
        <OptimizationKpiCard
          key={falseFailureKpi.id}
          kpi={{ ...falseFailureKpi, name: displayName(falseFailureKpi.id, falseFailureKpi.name) }}
        />
      ) : null}
    </div>
  );
}
