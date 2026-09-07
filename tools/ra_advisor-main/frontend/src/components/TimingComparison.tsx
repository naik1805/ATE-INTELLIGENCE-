import React from 'react';
import { Clock, Zap, CornerDownRight } from 'lucide-react';
import { PredictionResult } from '../types';

interface TimingComparisonProps {
  prediction: PredictionResult | null;
}

export const TimingComparison: React.FC<TimingComparisonProps> = ({ prediction }) => {
  if (!prediction) return null;

  const legacyMax = Math.max(prediction.legacy_time_ms, prediction.ai_time_ms, 150);
  const legacyWidthPct = Math.min(100, (prediction.legacy_time_ms / legacyMax) * 100);
  const aiWidthPct = Math.min(100, (prediction.ai_time_ms / legacyMax) * 100);

  return (
    <div className="bg-white dark:bg-[#12162A] border border-slate-200 dark:border-[#233044] rounded-lg p-5 flex flex-col space-y-4 shadow-sm dark:shadow-none transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#233044]">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
            REPAIR TIMELINE: LEGACY SEQUENTIAL VS. AI-ASSISTED FLOW
          </h3>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-500/30 px-2.5 py-1 rounded">
          <Zap className="w-3.5 h-3.5" />
          <span>Time Saved: {prediction.time_saved_ms.toFixed(1)} ms ({prediction.retest_cycles_avoided} retest passes avoided)</span>
        </div>
      </div>

      {/* Side-by-side timeline visual */}
      <div className="space-y-4 font-mono text-xs">
        {/* Legacy Sequential Flow Row */}
        <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#233044] rounded-md p-4 space-y-2">
          <div className="flex justify-between items-center text-slate-800 dark:text-slate-300">
            <span className="font-semibold flex items-center space-x-2">
              <span>Legacy Sequential Trial-and-Error Flow</span>
              <span className="text-[10px] text-slate-500 font-normal">
                ({prediction.legacy_passes} repair/retest compute passes)
              </span>
            </span>
            <span className="text-amber-600 dark:text-amber-400 font-bold tabular-nums">
              {prediction.legacy_time_ms.toFixed(1)} ms
            </span>
          </div>

          {/* Timeline Bar */}
          <div className="h-7 w-full bg-slate-200 dark:bg-[#181E34] rounded flex items-center p-1 overflow-hidden relative">
            <div
              className="h-full bg-amber-200 dark:bg-amber-500/30 border border-amber-400 dark:border-amber-500/50 rounded flex items-center justify-center text-[11px] font-semibold text-amber-900 dark:text-amber-200"
              style={{ width: `${legacyWidthPct}%` }}
            >
              Sequential Attempts (Row → Col → Combo)
            </div>
          </div>
        </div>

        {/* AI-Assisted Flow Row */}
        <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#233044] rounded-md p-4 space-y-2">
          <div className="flex justify-between items-center text-slate-800 dark:text-slate-300">
            <span className="font-semibold flex items-center space-x-2">
              <span className="text-sky-600 dark:text-sky-400">RA Advisor AI-Assisted Flow</span>
              <span className="text-[10px] text-slate-500 font-normal">
                (Inference: 2.0ms + Direct Repair Pass: 45ms)
              </span>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
              {prediction.ai_time_ms.toFixed(1)} ms
            </span>
          </div>

          {/* Timeline Bar */}
          <div className="h-7 w-full bg-slate-200 dark:bg-[#181E34] rounded flex items-center p-1 overflow-hidden relative">
            <div
              className="h-full bg-emerald-200 dark:bg-emerald-500/30 border border-emerald-400 dark:border-emerald-500/50 rounded flex items-center justify-between px-3 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200"
              style={{ width: `${aiWidthPct}%` }}
            >
              <span>AI Direct Prediction ({prediction.ml_recommendation})</span>
              <span>2.0ms Inf + 45ms Repair</span>
            </div>
          </div>

          {prediction.fallback_triggered && (
            <div className="mt-2 flex items-center space-x-2 text-rose-600 dark:text-rose-400 text-[11px]">
              <CornerDownRight className="w-3.5 h-3.5" />
              <span>Safety Fallback Triggered: AI pick was infeasible; automatically executed legacy sequential search.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
