import type { RaAdvisorPreview, RaAdvisorSpatialFeatures } from "@/types/agents";

const ARCHETYPES = [
  "mixed_row_column",
  "row_dominant",
  "column_dominant",
  "localized_cluster",
  "scattered",
] as const;

function emptyFeatures(): RaAdvisorSpatialFeatures {
  return {
    rows_above_thresh: 0,
    cols_above_thresh: 0,
    max_row_frac: 0,
    max_col_frac: 0,
    failing_density: 0,
    compactness: 0,
    total_fails: 0,
    bbox_area: 0,
  };
}

export function extractSpatialFeatures(bitmap: number[][]): RaAdvisorSpatialFeatures {
  const rows = bitmap.length;
  const cols = bitmap[0]?.length ?? 0;
  if (!rows || !cols) return emptyFeatures();

  const totalCells = rows * cols;
  const rowCounts = Array(rows).fill(0);
  const colCounts = Array(cols).fill(0);
  let totalFails = 0;
  let minR = rows;
  let maxR = -1;
  let minC = cols;
  let maxC = -1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (bitmap[r]?.[c] !== 1) continue;
      totalFails++;
      rowCounts[r]++;
      colCounts[c]++;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
  }

  if (totalFails === 0) return emptyFeatures();

  const bboxArea = (maxR - minR + 1) * (maxC - minC + 1);
  return {
    rows_above_thresh: rowCounts.filter((n) => n >= 0.55 * cols).length,
    cols_above_thresh: colCounts.filter((n) => n >= 0.55 * rows).length,
    max_row_frac: Math.max(...rowCounts) / cols,
    max_col_frac: Math.max(...colCounts) / rows,
    failing_density: totalFails / totalCells,
    compactness: bboxArea > 0 ? totalFails / bboxArea : 0,
    total_fails: totalFails,
    bbox_area: bboxArea,
  };
}

function generateBitmap(archetype: string, rows = 16, cols = 32): number[][] {
  const arr = Array.from({ length: rows }, () => Array(cols).fill(0));

  if (archetype === "scattered") {
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      arr[Math.floor(Math.random() * rows)][Math.floor(Math.random() * cols)] = 1;
    }
  } else if (archetype === "row_dominant") {
    const r = Math.floor(Math.random() * rows);
    for (let c = 0; c < cols; c++) if (Math.random() < 0.95) arr[r][c] = 1;
  } else if (archetype === "column_dominant") {
    const c = Math.floor(Math.random() * cols);
    for (let r = 0; r < rows; r++) if (Math.random() < 0.95) arr[r][c] = 1;
  } else if (archetype === "localized_cluster") {
    const startR = Math.floor(Math.random() * (rows - 3));
    const startC = Math.floor(Math.random() * (cols - 3));
    for (let r = startR; r < startR + 3; r++) {
      for (let c = startC; c < startC + 3; c++) arr[r][c] = 1;
    }
  } else {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    for (let ci = 0; ci < cols; ci++) if (Math.random() < 0.85) arr[r][ci] = 1;
    for (let ri = 0; ri < rows; ri++) if (Math.random() < 0.85) arr[ri][c] = 1;
  }

  return arr;
}

/** Client-side fallback so the card stays live if the KPI wrapper is mid-refresh. */
export function synthesizeRaAdvisorPreview(seed = 0): RaAdvisorPreview {
  const archetype = ARCHETYPES[Math.abs(seed) % ARCHETYPES.length];
  const bitmap = generateBitmap(archetype);
  return {
    archetype,
    rows: 16,
    cols: 32,
    bitmap,
    features: extractSpatialFeatures(bitmap),
    recommendation: null,
    confidence: null,
  };
}
