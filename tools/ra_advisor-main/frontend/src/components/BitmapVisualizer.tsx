import React from 'react';
import { Grid, Sparkles, RefreshCw, Layers } from 'lucide-react';
import { DefectArchetype, ExtractedFeatures } from '../types';

interface BitmapVisualizerProps {
  bitmap: number[][];
  archetype: string;
  features: ExtractedFeatures | null;
  onSelectArchetype: (arch: DefectArchetype | 'random') => void;
  onToggleCell: (r: number, c: number) => void;
  isLoading: boolean;
}

export const BitmapVisualizer: React.FC<BitmapVisualizerProps> = ({
  bitmap,
  archetype,
  features,
  onSelectArchetype,
  onToggleCell,
  isLoading
}) => {
  const archetypes: { id: DefectArchetype | 'random'; label: string }[] = [
    { id: 'random', label: 'Random Die' },
    { id: 'scattered', label: 'Scattered' },
    { id: 'row_dominant', label: 'Row Dominant' },
    { id: 'column_dominant', label: 'Column Dominant' },
    { id: 'localized_cluster', label: 'Localized Cluster' },
    { id: 'mixed_row_column', label: 'Mixed Row+Col' },
    { id: 'near_clean', label: 'Near Clean (ECC)' },
  ];

  const rows = bitmap.length;
  const cols = bitmap[0]?.length || 0;

  return (
    <div className="bg-white dark:bg-[#12162A] border border-slate-200 dark:border-[#233044] rounded-lg p-5 flex flex-col space-y-4 shadow-sm dark:shadow-none transition-colors">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#233044]">
        <div className="flex items-center space-x-2">
          <Grid className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
            FAIL BITMAP VISUALIZER
          </h3>
          <span className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#0B0D12] px-2 py-0.5 rounded border border-slate-300 dark:border-[#233044]">
            {rows} × {cols} Memory Array
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {archetypes.map((arch) => (
            <button
              key={arch.id}
              onClick={() => onSelectArchetype(arch.id)}
              disabled={isLoading}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center space-x-1 ${
                archetype === arch.id
                  ? 'bg-sky-600 text-white shadow-sm font-semibold'
                  : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 dark:bg-[#0B0D12] dark:text-slate-300 dark:border-[#233044] dark:hover:bg-[#1B2038] dark:hover:text-white'
              }`}
            >
              {arch.id === 'random' && <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-300" />}
              <span>{arch.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid View & Features split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: 2D Grid */}
        <div className="xl:col-span-2 flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#233044] rounded-md overflow-x-auto relative min-h-[300px]">
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-[#0B0D12]/80 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="flex items-center space-x-2 text-sky-600 dark:text-sky-400 font-mono text-xs">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Simulating Die Failure...</span>
              </div>
            </div>
          )}

          <div className="flex flex-col space-y-1">
            {bitmap.map((row, r) => (
              <div key={r} className="flex space-x-1">
                {row.map((val, c) => (
                  <button
                    key={c}
                    onClick={() => onToggleCell(r, c)}
                    title={`Cell R${r}, C${c}: ${val === 1 ? 'FAIL' : 'GOOD'}`}
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[2px] transition-all transform hover:scale-125 focus:outline-none ${
                      val === 1
                        ? 'bg-rose-500 shadow-sm shadow-rose-500/50 border border-rose-600 dark:border-rose-400'
                        : 'bg-slate-200 dark:bg-[#181E34] border border-slate-300 dark:border-[#26354F] hover:bg-slate-300 dark:hover:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center space-x-6 text-[11px] font-mono text-slate-600 dark:text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 bg-slate-200 dark:bg-[#181E34] border border-slate-300 dark:border-[#26354F] rounded-[2px]" />
              <span>Good Bit Cell (0)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 bg-rose-500 border border-rose-600 dark:border-rose-400 rounded-[2px]" />
              <span>Failing Bit Cell (1)</span>
            </div>
            <span className="text-slate-400 dark:text-slate-500">Click any cell to edit bitmap</span>
          </div>
        </div>

        {/* Right Col: Extracted Features */}
        <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#233044] rounded-md p-4 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-200 dark:border-[#233044]">
              <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span className="text-xs font-semibold tracking-wider text-slate-700 dark:text-slate-300 uppercase">
                EXTRACTED SPATIAL FEATURES
              </span>
            </div>

            {features ? (
              <div className="mt-3 space-y-2.5 font-mono text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-[#1C2539]">
                  <span className="text-slate-500 dark:text-slate-400">Rows ≥ 55% Fail:</span>
                  <span className="text-slate-900 dark:text-white font-bold tabular-nums">{features.rows_above_thresh}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-[#1C2539]">
                  <span className="text-slate-500 dark:text-slate-400">Cols ≥ 55% Fail:</span>
                  <span className="text-slate-900 dark:text-white font-bold tabular-nums">{features.cols_above_thresh}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-[#1C2539]">
                  <span className="text-slate-500 dark:text-slate-400">Max Row Fill:</span>
                  <span className="text-sky-600 dark:text-sky-400 font-bold tabular-nums">{(features.max_row_frac * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-[#1C2539]">
                  <span className="text-slate-500 dark:text-slate-400">Max Col Fill:</span>
                  <span className="text-sky-600 dark:text-sky-400 font-bold tabular-nums">{(features.max_col_frac * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-[#1C2539]">
                  <span className="text-slate-500 dark:text-slate-400">Failing Density:</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold tabular-nums">{(features.failing_density * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-[#1C2539]">
                  <span className="text-slate-500 dark:text-slate-400">Compactness:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">{features.compactness.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-[#1C2539]">
                  <span className="text-slate-500 dark:text-slate-400">Total Fails:</span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold tabular-nums">{features.total_fails} bits</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 dark:text-slate-400">Bounding Box:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold tabular-nums">{features.bbox_area} cells</span>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500 font-mono">No bitmap loaded.</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-[#233044] text-[11px] text-slate-500 dark:text-slate-400">
            <span>Features feed directly into LightGBM decision tree classifier.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
