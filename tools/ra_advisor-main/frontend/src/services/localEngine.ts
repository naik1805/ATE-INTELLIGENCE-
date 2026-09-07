import { ExtractedFeatures, PredictionResult, EvaluateResponse, DieHistoryItem } from '../types';

export class LocalEngine {
  static generateBitmap(archetype: string, rows: number = 16, cols: number = 32): { bitmap: number[][]; archetype: string } {
    let chosen = archetype;
    if (chosen === 'random' || !chosen) {
      const archetypes = ['scattered', 'row_dominant', 'column_dominant', 'localized_cluster', 'mixed_row_column', 'near_clean'];
      chosen = archetypes[Math.floor(Math.random() * archetypes.length)];
    }

    const arr: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(0));

    if (chosen === 'scattered') {
      const numFails = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < numFails; i++) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        arr[r][c] = 1;
      }
    } else if (chosen === 'row_dominant') {
      const targetRow = Math.floor(Math.random() * rows);
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.95) arr[targetRow][c] = 1;
      }
    } else if (chosen === 'column_dominant') {
      const targetCol = Math.floor(Math.random() * cols);
      for (let r = 0; r < rows; r++) {
        if (Math.random() < 0.95) arr[r][targetCol] = 1;
      }
    } else if (chosen === 'localized_cluster') {
      const cr = 3, cc = 3;
      const startR = Math.floor(Math.random() * (rows - cr));
      const startC = Math.floor(Math.random() * (cols - cc));
      for (let r = startR; r < startR + cr; r++) {
        for (let c = startC; c < startC + cc; c++) {
          arr[r][c] = 1;
        }
      }
    } else if (chosen === 'mixed_row_column') {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      for (let ci = 0; ci < cols; ci++) if (Math.random() < 0.85) arr[r][ci] = 1;
      for (let ri = 0; ri < rows; ri++) if (Math.random() < 0.85) arr[ri][c] = 1;
    } else if (chosen === 'near_clean') {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      arr[r][c] = 1;
    }

    return { bitmap: arr, archetype: chosen };
  }

  static extractFeatures(bitmap: number[][]): ExtractedFeatures {
    const rows = bitmap.length;
    const cols = bitmap[0]?.length || 0;
    const totalCells = rows * cols;

    let totalFails = 0;
    let minR = rows, maxR = -1, minC = cols, maxC = -1;

    const rowCounts = Array(rows).fill(0);
    const colCounts = Array(cols).fill(0);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (bitmap[r][c] === 1) {
          totalFails++;
          rowCounts[r]++;
          colCounts[c]++;
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
        }
      }
    }

    if (totalFails === 0) {
      return {
        rows_above_thresh: 0,
        cols_above_thresh: 0,
        max_row_frac: 0,
        max_col_frac: 0,
        failing_density: 0,
        compactness: 0,
        total_fails: 0,
        bbox_area: 0
      };
    }

    const rowsAboveThresh = rowCounts.filter(cnt => cnt >= 0.55 * cols).length;
    const colsAboveThresh = colCounts.filter(cnt => cnt >= 0.55 * rows).length;

    const maxRowFrac = Math.max(...rowCounts) / cols;
    const maxColFrac = Math.max(...colCounts) / rows;
    const failingDensity = totalFails / totalCells;

    const bboxHeight = maxR - minR + 1;
    const bboxWidth = maxC - minC + 1;
    const bboxArea = bboxHeight * bboxWidth;
    const compactness = bboxArea > 0 ? totalFails / bboxArea : 0;

    return {
      rows_above_thresh: rowsAboveThresh,
      cols_above_thresh: colsAboveThresh,
      max_row_frac: maxRowFrac,
      max_col_frac: maxColFrac,
      failing_density: failingDensity,
      compactness: compactness,
      total_fails: totalFails,
      bbox_area: bboxArea
    };
  }

  static evaluateFeasibility(bitmap: number[][], spareRows = 4, spareCols = 4, spareBlocks = 1, maxEcc = 2) {
    const feats = this.extractFeatures(bitmap);
    const totalFails = feats.total_fails;

    // Check ECC
    const eccFeasible = totalFails <= maxEcc;

    // Check Row
    const rows = bitmap.length;
    const cols = bitmap[0].length;
    const failingRows = Array(rows).fill(0).map((_, r) => bitmap[r].some(val => val === 1) ? 1 : 0).reduce((a: number, b: number) => a + b, 0);
    const rowFeasible = failingRows <= spareRows;

    // Check Col
    const failingCols = Array(cols).fill(0).map((_, c) => bitmap.some(r => r[c] === 1) ? 1 : 0).reduce((a: number, b: number) => a + b, 0);
    const colFeasible = failingCols <= spareCols;

    // Check Combo
    const comboFeasible = (feats.rows_above_thresh <= spareRows) && (feats.cols_above_thresh <= spareCols);

    // Check Cluster
    const clusterFeasible = (feats.bbox_area <= 16 && spareBlocks >= 1) || totalFails <= 4;

    // Determine optimal label
    let optimal = 'combo';
    if (eccFeasible) optimal = 'ecc';
    else if (rowFeasible && failingRows <= failingCols) optimal = 'row';
    else if (colFeasible && failingCols <= failingRows) optimal = 'col';
    else if (clusterFeasible && feats.compactness > 0.6) optimal = 'cluster';
    else if (comboFeasible) optimal = 'combo';

    return {
      eccFeasible,
      rowFeasible,
      colFeasible,
      comboFeasible,
      clusterFeasible,
      optimal
    };
  }

  static predictRepair(bitmap: number[][], spareRows = 4, spareCols = 4, spareBlocks = 1): PredictionResult {
    const feats = this.extractFeatures(bitmap);
    const feas = this.evaluateFeasibility(bitmap, spareRows, spareCols, spareBlocks);

    // Calculate class probabilities using spatial scoring
    let scoreRow = feats.rows_above_thresh * 3.0 + feats.max_row_frac * 2.0 - feats.cols_above_thresh * 2.0;
    let scoreCol = feats.cols_above_thresh * 3.0 + feats.max_col_frac * 2.0 - feats.rows_above_thresh * 2.0;
    let scoreCombo = (feats.rows_above_thresh > 0 && feats.cols_above_thresh > 0 ? 3.0 : 0) + feats.failing_density * 4.0;
    let scoreCluster = feats.compactness * 4.0 - feats.rows_above_thresh * 1.5;
    let scoreEcc = feats.total_fails <= 2 ? 6.0 - feats.total_fails : -5.0;

    // Softmax
    const scores = [scoreEcc, scoreRow, scoreCol, scoreCombo, scoreCluster];
    const maxS = Math.max(...scores);
    const exps = scores.map(s => Math.exp(s - maxS));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map(e => e / sumExps);

    const classes = ['ecc', 'row', 'col', 'combo', 'cluster'];
    const rankedRecs = classes.map((c, i) => ({ algorithm: c, probability: probs[i] }))
      .sort((a, b) => b.probability - a.probability);

    const topRec = rankedRecs[0].algorithm;
    const confidence = rankedRecs[0].probability;

    // Check feasibility of topRec
    const isFeasibleMap: Record<string, boolean> = {
      ecc: feas.eccFeasible,
      row: feas.rowFeasible,
      col: feas.colFeasible,
      combo: feas.comboFeasible,
      cluster: feas.clusterFeasible
    };

    const isFeasible = isFeasibleMap[topRec] ?? true;
    const optimal = feas.optimal;
    const fallbackTriggered = !isFeasible;
    const finalAlgo = isFeasible ? topRec : optimal;

    // Timing calculation
    const legacyPasses = optimal === 'row' ? 1 : optimal === 'col' ? 2 : optimal === 'combo' ? 3 : 4;
    const legacyTimeMs = legacyPasses * 45.0;
    const aiPasses = fallbackTriggered ? (1 + legacyPasses) : 1;
    const aiTimeMs = 2.0 + (aiPasses * 45.0);
    const timeSavedMs = Math.max(0, legacyTimeMs - aiTimeMs);
    const retestCyclesAvoided = Math.max(0, legacyPasses - aiPasses);

    return {
      ml_recommendation: topRec,
      confidence: confidence,
      class_probabilities: {
        ecc: probs[0],
        row: probs[1],
        col: probs[2],
        combo: probs[3],
        cluster: probs[4]
      },
      ranked_recommendations: rankedRecs,
      is_feasible: isFeasible,
      matches_optimal: (topRec === optimal),
      optimal_algorithm: optimal,
      fallback_triggered: fallbackTriggered,
      final_used_algorithm: finalAlgo,
      legacy_passes: legacyPasses,
      ai_passes: aiPasses,
      retest_cycles_avoided: retestCyclesAvoided,
      legacy_time_ms: legacyTimeMs,
      ai_time_ms: aiTimeMs,
      time_saved_ms: timeSavedMs,
      extracted_features: feats
    };
  }

  static evaluateSession(numDies = 11, rows = 16, cols = 32): EvaluateResponse {
    let top1Correct = 0;
    let retestCyclesAvoided = 0;
    let cumulativeTimeSaved = 0;
    let fallbackCount = 0;

    const algoDist: Record<string, number> = {};
    const dieHistory: DieHistoryItem[] = [];

    for (let i = 0; i < numDies; i++) {
      const die = this.generateBitmap('random', rows, cols);
      const pred = this.predictRepair(die.bitmap);

      if (pred.matches_optimal) top1Correct++;
      if (pred.fallback_triggered) fallbackCount++;

      retestCyclesAvoided += pred.retest_cycles_avoided;
      cumulativeTimeSaved += pred.time_saved_ms;

      const algo = pred.ml_recommendation;
      algoDist[algo] = (algoDist[algo] || 0) + 1;

      dieHistory.push({
        die_index: i + 1,
        archetype: die.archetype,
        ai_pick: pred.ml_recommendation,
        confidence: pred.confidence,
        optimal: pred.optimal_algorithm,
        is_feasible: pred.is_feasible,
        matches_optimal: pred.matches_optimal,
        time_saved_ms: pred.time_saved_ms
      });
    }

    const top1Accuracy = top1Correct / numDies;
    const feasibilityMissRate = fallbackCount / numDies;

    return {
      session_summary: {
        dies_processed: numDies,
        top1_accuracy: top1Accuracy,
        top1_accuracy_percent: `${(top1Accuracy * 100).toFixed(1)}%`,
        retest_cycles_avoided: retestCyclesAvoided,
        cumulative_time_saved_ms: Math.round(cumulativeTimeSaved * 10) / 10,
        fallback_count: fallbackCount,
        feasibility_miss_rate: feasibilityMissRate,
        algorithm_distribution: algoDist
      },
      die_history: dieHistory
    };
  }
}
