import React, { useState } from 'react';
import { Play, BarChart2, Table, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { EvaluateResponse } from '../types';

interface SessionBenchmarkProps {
  onRunBenchmark: (numDies: number) => Promise<void>;
  benchmarkData: EvaluateResponse | null;
  isLoading: boolean;
}

export const SessionBenchmark: React.FC<SessionBenchmarkProps> = ({
  onRunBenchmark,
  benchmarkData,
  isLoading
}) => {
  const [numDies, setNumDies] = useState<number>(11);

  const handleRun = () => {
    onRunBenchmark(numDies);
  };

  const summary = benchmarkData?.session_summary;
  const history = benchmarkData?.die_history || [];

  return (
    <div className="bg-white dark:bg-[#12162A] border border-slate-200 dark:border-[#233044] rounded-lg p-5 flex flex-col space-y-5 shadow-sm dark:shadow-none transition-colors">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-[#233044]">
        <div className="flex items-center space-x-2">
          <BarChart2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
            BATCH SESSION BENCHMARK & OBSERVABILITY ANALYTICS
          </h3>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-700 dark:text-slate-300">
            <span>Session Length:</span>
            <input
              type="number"
              min={5}
              max={100}
              value={numDies}
              onChange={(e) => setNumDies(Math.max(5, Math.min(100, Number(e.target.value))))}
              className="w-16 bg-slate-100 dark:bg-[#0B0D12] border border-slate-300 dark:border-[#233044] rounded px-2 py-1 text-center font-bold text-sky-600 dark:text-sky-400 focus:outline-none focus:border-sky-500"
            />
            <span>dies</span>
          </div>

          <button
            onClick={handleRun}
            disabled={isLoading}
            className="px-4 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center space-x-2 transition-all shadow-sm shadow-sky-600/30 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running Session...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Batch Session</span>
              </>
            )}
          </button>
        </div>
      </div>

      {summary && (
        <div className="space-y-5">
          {/* Top Session Summary Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
            <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#233044] rounded-md p-3">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">TOP-1 ACCURACY</span>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {summary.top1_accuracy_percent}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Matched Optimal Label</p>
            </div>

            <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#233044] rounded-md p-3">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">RETEST CYCLES SAVED</span>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                {summary.retest_cycles_avoided} <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">passes</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Saved Across Session</p>
            </div>

            <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#233044] rounded-md p-3">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">CUMULATIVE TIME SAVED</span>
              <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400 mt-1 tabular-nums">
                {summary.cumulative_time_saved_ms.toFixed(1)} <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">ms</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Total Time Delta</p>
            </div>

            <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#233044] rounded-md p-3">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">FEASIBILITY MISS RATE</span>
              <div className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-1 tabular-nums">
                {(summary.feasibility_miss_rate * 100).toFixed(1)}%
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">{summary.fallback_count} Fallbacks Triggered</p>
            </div>
          </div>

          {/* Algorithm Distribution Breakdown */}
          <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#233044] rounded-md p-4 space-y-3">
            <span className="text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              RECOMMENDED REPAIR ALGORITHM DISTRIBUTION ACROSS SESSION
            </span>

            <div className="space-y-2 font-mono text-xs">
              {Object.entries(summary.algorithm_distribution).map(([algo, count]) => {
                const pct = ((count / summary.dies_processed) * 100).toFixed(1);
                return (
                  <div key={algo} className="space-y-1">
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span className="uppercase font-semibold text-sky-600 dark:text-sky-400">{algo}</span>
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">{count} dies ({pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-[#181E34] rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Die History Table */}
          <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#233044] rounded-md p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <Table className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span className="text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                DIE SESSION HISTORY LOG
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#233044] text-slate-500 dark:text-slate-400 text-[11px]">
                    <th className="py-2 px-3">DIE #</th>
                    <th className="py-2 px-3">DEFECT ARCHETYPE</th>
                    <th className="py-2 px-3">AI PICK</th>
                    <th className="py-2 px-3">CONFIDENCE</th>
                    <th className="py-2 px-3">FEASIBLE?</th>
                    <th className="py-2 px-3">OPTIMAL TARGET</th>
                    <th className="py-2 px-3 text-right">TIME SAVED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1C2539]">
                  {history.map((item) => (
                    <tr key={item.die_index} className="hover:bg-slate-100 dark:hover:bg-[#12162A]/60">
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400 font-bold">#{item.die_index}</td>
                      <td className="py-2 px-3 text-slate-800 dark:text-slate-300 capitalize">{item.archetype.replace('_', ' ')}</td>
                      <td className="py-2 px-3 text-sky-600 dark:text-sky-400 font-semibold uppercase">{item.ai_pick}</td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-200 tabular-nums">{(item.confidence * 100).toFixed(1)}%</td>
                      <td className="py-2 px-3">
                        {item.is_feasible ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Yes</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-rose-600 dark:text-rose-400 font-semibold">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Fallback</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300 uppercase">{item.optimal}</td>
                      <td className="py-2 px-3 text-right text-cyan-600 dark:text-cyan-400 font-bold tabular-nums">
                        +{item.time_saved_ms.toFixed(1)} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
