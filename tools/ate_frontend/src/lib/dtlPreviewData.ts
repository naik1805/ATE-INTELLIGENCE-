export const DTL_PREVIEW_MONTHS = ["2026-01", "2026-02", "2026-03"] as const;

export const DTL_PREVIEW_MONTH_LABELS = [
  "January 2026",
  "February 2026",
  "March 2026",
] as const;

export type DtlPreviewRow = {
  parameter: string;
  unit: string;
  values: [number, number, number];
  featured?: boolean;
};

/** Demo matrix aligned with the DTL three-month executive view. */
export const DTL_PREVIEW_MATRIX: DtlPreviewRow[] = [
  { parameter: "IR_DROP_MV", unit: "mV", values: [50, 72, 55], featured: true },
  { parameter: "THERMAL_C", unit: "°C", values: [92, 92, 92] },
  { parameter: "VMIN", unit: "V", values: [1, 1, 1] },
  { parameter: "VMAX", unit: "V", values: [1.05, 1.05, 1.05] },
  { parameter: "IDDQ", unit: "uA", values: [100, 100, 100] },
  { parameter: "SUPPLY_CURRENT", unit: "mA", values: [200, 200, 200] },
  { parameter: "CONTACT_RESISTANCE", unit: "ohm", values: [10, 10, 10] },
  { parameter: "INTERCONNECT_RESISTANCE", unit: "ohm", values: [25, 25, 25] },
  { parameter: "ON_RESISTANCE", unit: "ohm", values: [50, 50, 50] },
];

export function formatDtlLimit(value: number, unit: string): string {
  const rounded =
    Number.isInteger(value) || unit === "V" || unit === "°C"
      ? String(value)
      : value.toFixed(2).replace(/\.?0+$/, "");
  return `${rounded} ${unit}`;
}

export function rowChangesAcrossMonths(values: number[]): boolean {
  const defined = values.filter((v) => Number.isFinite(v));
  return defined.length >= 2 && new Set(defined.map((v) => v.toFixed(12))).size > 1;
}

export type DtlThreeMonthBundle = {
  scorable_parameters?: string[];
  primary_recommendations?: Array<{
    parameter_display: string;
    production_month: string;
    recommended_limit: number | null;
    unit?: string | null;
  }>;
};

export function matrixFromBundle(bundle: DtlThreeMonthBundle | null | undefined): DtlPreviewRow[] {
  const params =
    bundle?.scorable_parameters?.length
      ? bundle.scorable_parameters
      : DTL_PREVIEW_MATRIX.map((r) => r.parameter);
  const primary = bundle?.primary_recommendations ?? [];

  return params.map((parameter) => {
    const cells = DTL_PREVIEW_MONTHS.map((month) =>
      primary.find((r) => r.parameter_display === parameter && r.production_month === month),
    );
    const values = cells.map((c) =>
      c?.recommended_limit != null ? Number(c.recommended_limit) : Number.NaN,
    ) as [number, number, number];
    const unit =
      cells.find((c) => c?.unit)?.unit ??
      DTL_PREVIEW_MATRIX.find((r) => r.parameter === parameter)?.unit ??
      "";
    const changes = rowChangesAcrossMonths(values);
    return {
      parameter,
      unit,
      values,
      featured: changes,
    };
  });
}
