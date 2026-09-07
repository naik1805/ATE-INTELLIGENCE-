"use client";

import { useEffect, useMemo, useState } from "react";
import type { RaAdvisorPreview, RaAdvisorSpatialFeatures } from "@/types/agents";

type FeatureTone = "white" | "cyan" | "yellow" | "green" | "red";

const FEATURE_ROWS: {
  key: keyof RaAdvisorSpatialFeatures;
  label: string;
  format: (v: number) => string;
  tone: FeatureTone;
}[] = [
  {
    key: "rows_above_thresh",
    label: "Rows ≥ 55% Fail",
    format: (v) => String(Math.round(v)),
    tone: "white",
  },
  {
    key: "cols_above_thresh",
    label: "Cols ≥ 55% Fail",
    format: (v) => String(Math.round(v)),
    tone: "white",
  },
  {
    key: "max_row_frac",
    label: "Max Row Fill",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    tone: "cyan",
  },
  {
    key: "max_col_frac",
    label: "Max Col Fill",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    tone: "cyan",
  },
  {
    key: "failing_density",
    label: "Failing Density",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    tone: "yellow",
  },
  {
    key: "compactness",
    label: "Compactness",
    format: (v) => v.toFixed(3),
    tone: "green",
  },
  {
    key: "total_fails",
    label: "Total Fails",
    format: (v) => `${Math.round(v)} bits`,
    tone: "red",
  },
  {
    key: "bbox_area",
    label: "Bounding Box",
    format: (v) => `${Math.round(v)} cells`,
    tone: "white",
  },
];

const TONE_CLASS: Record<FeatureTone, string> = {
  white: "text-white",
  cyan: "text-[var(--cyan)]",
  yellow: "text-[#f5d76e]",
  green: "text-[var(--green)]",
  red: "text-[var(--red)]",
};

/**
 * Compact live face matching the RA Advisor fail-bitmap + spatial features panel.
 */
export function RaAdvisorLivePreview({
  preview,
  compact = true,
}: {
  preview: RaAdvisorPreview;
  compact?: boolean;
}) {
  const [pulse, setPulse] = useState(false);
  const [scan, setScan] = useState(0);

  const rows = preview.bitmap.length || preview.rows || 16;
  const cols = preview.bitmap[0]?.length || preview.cols || 32;
  const failCount = useMemo(
    () => preview.bitmap.flat().filter((v) => v === 1).length,
    [preview.bitmap],
  );

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    setPulse(true);
    const flash = window.setTimeout(() => setPulse(false), 420);
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = ((now - start) % 2800) / 2800;
      setScan(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.clearTimeout(flash);
      cancelAnimationFrame(raf);
    };
  }, [preview.bitmap]);

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${compact ? "gap-1.5" : "gap-2.5"}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_0.95fr] gap-2">
        <div className="relative flex min-h-0 flex-col">
          <div
            className={`relative overflow-hidden rounded-[4px] border border-[rgba(107,193,242,0.22)] bg-[#0a1628] p-1 transition-[box-shadow,opacity] duration-300 ${
              pulse ? "opacity-95 shadow-[0_0_0_1px_rgba(240,102,122,0.35)]" : "opacity-100"
            }`}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
              gap: 1,
              aspectRatio: `${cols} / ${rows}`,
            }}
            aria-label={`Fail bitmap ${rows} by ${cols}, ${failCount} failing cells`}
          >
            {preview.bitmap.map((row, r) =>
              row.map((cell, c) => (
                <span
                  key={`${r}-${c}`}
                  className={
                    cell === 1
                      ? "rounded-[0.5px] bg-[#ff3b4a] shadow-[0_0_4px_rgba(255,59,74,0.55)]"
                      : "rounded-[0.5px] bg-[#152a4a]"
                  }
                  style={
                    cell === 1
                      ? {
                          opacity: 0.72 + 0.28 * Math.sin((scan * Math.PI * 2) + r * 0.35 + c * 0.12),
                        }
                      : undefined
                  }
                />
              )),
            )}
            <div
              className="pointer-events-none absolute inset-x-0 h-[18%] bg-gradient-to-b from-transparent via-[rgba(107,193,242,0.08)] to-transparent"
              style={{ top: `${scan * 100}%`, transform: "translateY(-50%)" }}
              aria-hidden
            />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[8px] text-[var(--text-dim)]">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-[1px] bg-[#152a4a]" />
              Good (0)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-[1px] bg-[#ff3b4a]" />
              Fail (1)
            </span>
            <span className="ml-auto font-mono text-[var(--text-soft)]">
              {preview.archetype.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-[4px] border border-[rgba(107,193,242,0.16)] bg-[rgba(8,16,30,0.72)] px-2 py-1.5">
          <div className="mb-1 text-[8px] font-semibold tracking-[0.08em] text-[var(--text-soft)]">
            EXTRACTED SPATIAL FEATURES
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-between gap-0.5">
            {FEATURE_ROWS.map((row) => (
              <div key={row.key} className="flex items-baseline justify-between gap-2 leading-none">
                <span className="truncate text-[8px] text-[var(--text-dim)]">{row.label}</span>
                <span
                  className={`shrink-0 font-mono text-[10px] font-semibold tabular-nums ${TONE_CLASS[row.tone]}`}
                >
                  {row.format(preview.features[row.key] ?? 0)}
                </span>
              </div>
            ))}
          </div>
          {preview.recommendation ? (
            <div className="mt-1 truncate border-t border-[rgba(107,193,242,0.12)] pt-1 text-[8px] text-[var(--cyan)]">
              AI pick · {preview.recommendation}
              {preview.confidence != null
                ? ` · ${(preview.confidence * 100).toFixed(0)}%`
                : ""}
            </div>
          ) : (
            <div className="mt-1 border-t border-[rgba(107,193,242,0.12)] pt-1 text-[7px] leading-snug text-[var(--text-dim)]">
              Features feed LightGBM classifier
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
