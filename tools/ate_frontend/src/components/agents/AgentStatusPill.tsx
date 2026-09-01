"use client";

import type { AgentStatus } from "@/types/agents";

const STYLES: Record<AgentStatus, { className: string; glyph: string }> = {
  running: { className: "bg-[var(--green-dim)] text-[var(--green)]", glyph: "▲" },
  idle: { className: "bg-[var(--cyan-dim)] text-[var(--cyan)]", glyph: "■" },
  error: { className: "bg-[var(--red-dim)] text-[var(--red)]", glyph: "▼" },
};

/** Mirrors the trend pill styling used by OptimizationKpiCard. */
export function AgentStatusPill({ status }: { status: AgentStatus }) {
  const style = STYLES[status] ?? STYLES.idle;
  return (
    <span
      className={`shrink-0 rounded px-[7px] py-0.5 text-[10px] font-semibold tracking-[0.04em] transition-[background-color,color] duration-200 ${style.className}`}
    >
      {style.glyph} {status}
    </span>
  );
}
