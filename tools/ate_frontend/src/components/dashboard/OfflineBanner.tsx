"use client";

/** Slim offline notice — does not reorder dashboard sections. */
export function OfflineBanner() {
  return (
    <div className="mb-6 rounded-[8px] border border-[rgba(107,193,242,0.28)] bg-[rgba(107,193,242,0.06)] px-4 py-2.5 text-[12px] leading-relaxed text-[var(--muted)]">
      <span className="font-semibold text-[var(--cyan)]">Offline desktop mode.</span>{" "}
      Live wafer telemetry requires the cloud backend. Integrated agents below run locally with
      sample data pre-loaded.
    </div>
  );
}
