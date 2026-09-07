import React from 'react';
import { Brain, CheckCircle2, AlertTriangle, ShieldCheck, Sliders } from 'lucide-react';
import { PredictionResult } from '../types';

interface RecommendationPanelProps {
  prediction: PredictionResult | null;
  spareRows: number;
  spareCols: number;
  spareBlocks: number;
  onUpdateSpares: (r: number, c: number, b: number) => void;
  isLoading: boolean;
}

const ALGO_LABELS: Record<string, string> = {
  row: 'Row Redundancy',
  col: 'Column Redundancy',
  combo: 'Row+Column Combinational',
  cluster: 'Local Block Redundancy',
  ecc: 'No Repair (ECC Covered)',
  unrepairable: 'Unrepairable / Scrap'
};

export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({
  prediction,
  spareRows,
  spareCols,
  spareBlocks,
  onUpdateSpares,
  isLoading
}) => {
  return (
    <div className="bg-white dark:bg-[#12162A] border border-slate-200 dark:border-[#233044] rounded-lg p-5 flex flex-col space-y-4 shadow-sm dark:shadow-none transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#233044]">
        <div className="flex items-center space-x-2">
          <Brain className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
            AI RECOMMENDATION & SAFETY FEASIBILITY
          </h3>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-slate-500 dark:text-slate-400">Deterministic Safety Engine:</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Active</span>
        </div>
      </div>

      {prediction ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Main Recommendation & Probability Breakdown */}
          <div className="lg:col-span-2 space-y-4">
            {/* Top Box: Recommended Algorithm */}
            <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#233044] rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                  RECOMMENDED REPAIR ALGORITHM
                </span>
                <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {ALGO_LABELS[prediction.ml_recommendation] || prediction.ml_recommendation}
                </h2>
                <div className="mt-2 flex items-center space-x-2 text-xs font-mono">
                  <span className="text-slate-500 dark:text-slate-400">Confidence:</span>
                  <span className="text-sky-600 dark:text-sky-400 font-bold text-sm">
                    {(prediction.confidence * 100).toFixed(1)}%
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">•</span>
                  <span className="text-slate-500 dark:text-slate-400">Optimal Target:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {ALGO_LABELS[prediction.optimal_algorithm] || prediction.optimal_algorithm}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex flex-col items-end space-y-2">
                {prediction.is_feasible ? (
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>FEASIBLE (MINIMAL SPARES)</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-mono font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>INFEASIBLE - FALLBACK ACTIVATED</span>
                  </div>
                )}

                <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-[#181E34] border border-slate-300 dark:border-[#26354F]">
                    {prediction.matches_optimal ? '✓ Matches Exhaustive Optimum' : '⚠ Non-Optimal Pair'}
                  </span>
                </div>
              </div>
            </div>

            {/* Candidate Algorithm Ranked Probabilities */}
            <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#233044] rounded-md p-4 space-y-3">
              <span className="text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                ALL CANDIDATE ALGORITHM PROBABILITIES
              </span>

              <div className="space-y-2.5">
                {prediction.ranked_recommendations.map((rec) => {
                  const probPct = (rec.probability * 100).toFixed(1);
                  const isTop = rec.algorithm === prediction.ml_recommendation;

                  return (
                    <div key={rec.algorithm} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className={isTop ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-600 dark:text-slate-400'}>
                          {ALGO_LABELS[rec.algorithm] || rec.algorithm}
                        </span>
                        <span className={`tabular-nums font-bold ${isTop ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {probPct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-[#181E34] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isTop ? 'bg-sky-500 shadow-sm shadow-sky-500/50' : 'bg-slate-400 dark:bg-slate-600'
                          }`}
                          style={{ width: `${probPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Col: Spare Configuration Inputs */}
          <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#233044] rounded-md p-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-200 dark:border-[#233044]">
                <Sliders className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span className="text-xs font-semibold tracking-wider text-slate-700 dark:text-slate-300 uppercase">
                  MEMORY SPARE BUDGET CONFIG
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                    <span>Spare Rows Budget:</span>
                    <span className="text-slate-900 dark:text-white font-bold">{spareRows}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    value={spareRows}
                    onChange={(e) => onUpdateSpares(Number(e.target.value), spareCols, spareBlocks)}
                    className="w-full accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                    <span>Spare Columns Budget:</span>
                    <span className="text-slate-900 dark:text-white font-bold">{spareCols}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    value={spareCols}
                    onChange={(e) => onUpdateSpares(spareRows, Number(e.target.value), spareBlocks)}
                    className="w-full accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                    <span>Spare Block Clusters:</span>
                    <span className="text-slate-900 dark:text-white font-bold">{spareBlocks}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={4}
                    value={spareBlocks}
                    onChange={(e) => onUpdateSpares(spareRows, spareCols, Number(e.target.value))}
                    className="w-full accent-sky-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-[#233044] text-[11px] text-slate-500 dark:text-slate-400">
              <p>Feasibility Engine dynamically recalculates optimal spare coverage upon parameter change.</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 font-mono">Run simulation to generate recommendation.</p>
      )}
    </div>
  );
};
