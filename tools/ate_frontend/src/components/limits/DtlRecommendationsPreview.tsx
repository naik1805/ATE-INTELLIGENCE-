"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AGENTS } from "../../../agents.config";
import {
  DTL_PREVIEW_MATRIX,
  DTL_PREVIEW_MONTH_LABELS,
  formatDtlLimit,
  matrixFromBundle,
  rowChangesAcrossMonths,
  type DtlPreviewRow,
  type DtlThreeMonthBundle,
} from "@/lib/dtlPreviewData";

async function fetchDtlThreeMonth(): Promise<DtlThreeMonthBundle | null> {
  try {
    const bootRes = await fetch("/api/default-data/agents/dtl/bootstrap", {
      cache: "no-store",
    });
    const boot = bootRes.ok ? ((await bootRes.json()) as { analysis_session_id?: string }) : {};
    const sid = boot.analysis_session_id ? String(boot.analysis_session_id) : "";
    const url = sid
      ? `${AGENTS.dtl.api_url}/analysis/three-month?analysis_session_id=${encodeURIComponent(sid)}`
      : `${AGENTS.dtl.api_url}/analysis/three-month`;
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as DtlThreeMonthBundle;
  } catch {
    return null;
  }
}

export function DtlRecommendationsPreview({ live }: { live?: boolean }) {
  const { data: bundle } = useQuery({
    queryKey: ["dtl-three-month-preview"],
    queryFn: fetchDtlThreeMonth,
    enabled: live,
    staleTime: 30_000,
    retry: 1,
  });

  const rows = useMemo(() => {
    const fromAgent = live && bundle ? matrixFromBundle(bundle) : null;
    if (fromAgent?.some((r) => r.values.some((v) => Number.isFinite(v)))) return fromAgent;
    return DTL_PREVIEW_MATRIX;
  }, [bundle, live]);

  return (
    <div className="relative overflow-hidden rounded-[10px] border border-[rgba(107,193,242,0.22)] bg-[linear-gradient(165deg,rgba(8,22,42,0.92)_0%,rgba(4,12,26,0.98)_100%)] p-2.5 shadow-[inset_0_1px_0_rgba(107,193,242,0.12),0_0_24px_rgba(56,189,248,0.08)]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.22)_0%,transparent_70%)]" />
      <div className="relative">
        <div className="mb-2 border-b border-[rgba(107,193,242,0.16)] pb-2">
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--cyan)]">
            AI Recommended Dynamic Test Limits
          </div>
          <p className="mt-0.5 text-[9.5px] leading-snug text-[var(--muted)]">
            Recommended limits across January, February, and March 2026.
          </p>
        </div>

        <div className="overflow-hidden rounded-[6px] border border-[rgba(107,193,242,0.12)]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[rgba(107,193,242,0.06)] text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="px-2 py-1.5">Parameter</th>
                {DTL_PREVIEW_MONTH_LABELS.map((label) => (
                  <th key={label} className="px-1 py-1.5 text-right">
                    {label.split(" ")[0]?.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <MatrixRow key={row.parameter} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MatrixRow({ row }: { row: DtlPreviewRow }) {
  const changes = row.featured ?? rowChangesAcrossMonths(row.values);
  const featured = changes;

  return (
    <tr
      className={`border-t border-[rgba(107,193,242,0.1)] transition-colors ${
        featured
          ? "bg-[var(--cyan)] shadow-[0_0_18px_rgba(56,189,248,0.35)]"
          : "hover:bg-[rgba(107,193,242,0.04)]"
      }`}
    >
      <td className="px-2 py-1">
        <span
          className={`font-mono text-[9px] font-semibold ${
            featured ? "text-[#031018]" : "text-[var(--text-bright)]"
          }`}
        >
          {row.parameter}
        </span>
      </td>
      {row.values.map((value, idx) => {
        const text = Number.isFinite(value) ? formatDtlLimit(value, row.unit) : "—";
        return (
          <td key={idx} className="px-1.5 py-1 text-right">
            <span
              className={`font-mono text-[9px] ${
                featured
                  ? "font-bold text-[#031018]"
                  : changes
                    ? "font-semibold text-[var(--cyan)]"
                    : "text-[var(--text-soft)]"
              }`}
            >
              {text}
            </span>
          </td>
        );
      })}
    </tr>
  );
}
