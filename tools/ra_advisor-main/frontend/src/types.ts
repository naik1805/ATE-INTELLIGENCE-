export type DefectArchetype = 
  | 'scattered'
  | 'row_dominant'
  | 'column_dominant'
  | 'localized_cluster'
  | 'mixed_row_column'
  | 'near_clean';

export interface ExtractedFeatures {
  rows_above_thresh: number;
  cols_above_thresh: number;
  max_row_frac: number;
  max_col_frac: number;
  failing_density: number;
  compactness: number;
  total_fails: number;
  bbox_area: number;
}

export interface RankedRec {
  algorithm: string;
  probability: number;
}

export interface PredictionResult {
  ml_recommendation: string;
  confidence: number;
  class_probabilities: Record<string, number>;
  ranked_recommendations: RankedRec[];
  is_feasible: boolean;
  matches_optimal: boolean;
  optimal_algorithm: string;
  fallback_triggered: boolean;
  final_used_algorithm: string;
  legacy_passes: number;
  ai_passes: number;
  retest_cycles_avoided: number;
  legacy_time_ms: number;
  ai_time_ms: number;
  time_saved_ms: number;
  extracted_features: ExtractedFeatures;
}

export interface DieHistoryItem {
  die_index: number;
  archetype: string;
  ai_pick: string;
  confidence: number;
  optimal: string;
  is_feasible: boolean;
  matches_optimal: boolean;
  time_saved_ms: number;
}

export interface SessionSummary {
  dies_processed: number;
  top1_accuracy: number;
  top1_accuracy_percent: string;
  retest_cycles_avoided: number;
  cumulative_time_saved_ms: number;
  fallback_count: number;
  feasibility_miss_rate: number;
  algorithm_distribution: Record<string, number>;
}

export interface EvaluateResponse {
  session_summary: SessionSummary;
  die_history: DieHistoryItem[];
}
