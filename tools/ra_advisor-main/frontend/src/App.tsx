import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { KpiCards } from './components/KpiCards';
import { BitmapVisualizer } from './components/BitmapVisualizer';
import { RecommendationPanel } from './components/RecommendationPanel';
import { TimingComparison } from './components/TimingComparison';
import { SessionBenchmark } from './components/SessionBenchmark';

import { LocalEngine } from './services/localEngine';

import {
  DefectArchetype,
  ExtractedFeatures,
  PredictionResult,
  EvaluateResponse,
  SessionSummary
} from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'loading'>('loading');

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('ra_advisor_theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('ra_advisor_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Bitmap and feature states
  const [bitmap, setBitmap] = useState<number[][]>(() =>
    Array(16).fill(0).map(() => Array(32).fill(0))
  );
  const [archetype, setArchetype] = useState<string>('random');
  const [features, setFeatures] = useState<ExtractedFeatures | null>(null);

  // Prediction and Spares
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [spareRows, setSpareRows] = useState<number>(4);
  const [spareCols, setSpareCols] = useState<number>(4);
  const [spareBlocks, setSpareBlocks] = useState<number>(1);

  // Session benchmark
  const [benchmarkData, setBenchmarkData] = useState<EvaluateResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    checkHealthAndInit();
  }, []);

  const checkHealthAndInit = async () => {
    try {
      const res = await fetch('/api/');
      if (res.ok) {
        setApiStatus('online');
        await runSimulation('random');
        await runBatchBenchmark(11);
      } else {
        setApiStatus('offline');
        runFallbackInit();
      }
    } catch {
      setApiStatus('offline');
      runFallbackInit();
    }
  };

  const runFallbackInit = () => {
    runSimulation('random');
    runBatchBenchmark(11);
  };

  const runSimulation = async (arch: DefectArchetype | 'random') => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archetype: arch, rows: 16, cols: 32 })
      });

      if (res.ok) {
        const data = await res.json();
        setBitmap(data.bitmap);
        setArchetype(data.archetype);
        setFeatures(data.extracted_features);
        await runPrediction(data.bitmap, spareRows, spareCols, spareBlocks);
        setIsLoading(false);
        return;
      }
    } catch {
      // Ignore network errors, fall through to client-side engine
    }

    // Client-side fallback for Vercel / static deployment
    const localDie = LocalEngine.generateBitmap(arch, 16, 32);
    const localFeats = LocalEngine.extractFeatures(localDie.bitmap);
    setBitmap(localDie.bitmap);
    setArchetype(localDie.archetype);
    setFeatures(localFeats);
    runLocalPrediction(localDie.bitmap, spareRows, spareCols, spareBlocks);
    setIsLoading(false);
  };

  const runPrediction = async (
    bm: number[][],
    sr: number,
    sc: number,
    sb: number
  ) => {
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bitmap: bm,
          spare_rows: sr,
          spare_cols: sc,
          spare_blocks: sb
        })
      });

      if (res.ok) {
        const data: PredictionResult = await res.json();
        setPrediction(data);
        return;
      }
    } catch {
      // Ignore network error
    }

    runLocalPrediction(bm, sr, sc, sb);
  };

  const runLocalPrediction = (bm: number[][], sr: number, sc: number, sb: number) => {
    const pred = LocalEngine.predictRepair(bm, sr, sc, sb);
    setPrediction(pred);
  };

  const handleToggleCell = (r: number, c: number) => {
    const newBitmap = bitmap.map((rowArr, ri) =>
      rowArr.map((val, ci) => (ri === r && ci === c ? (val === 1 ? 0 : 1) : val))
    );
    setBitmap(newBitmap);
    setArchetype('custom');
    
    // Extract new features locally
    const feats = LocalEngine.extractFeatures(newBitmap);
    setFeatures(feats);
    runPrediction(newBitmap, spareRows, spareCols, spareBlocks);
  };

  const handleUpdateSpares = (r: number, c: number, b: number) => {
    setSpareRows(r);
    setSpareCols(c);
    setSpareBlocks(b);
    runPrediction(bitmap, r, c, b);
  };

  const runBatchBenchmark = async (numDies: number) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ num_dies: numDies, rows: 16, cols: 32 })
      });

      if (res.ok) {
        const data: EvaluateResponse = await res.json();
        setBenchmarkData(data);
        setIsLoading(false);
        return;
      }
    } catch {
      // Fall through to local benchmark
    }

    const localBench = LocalEngine.evaluateSession(numDies, 16, 32);
    setBenchmarkData(localBench);
    setIsLoading(false);
  };

  const summary: SessionSummary = benchmarkData?.session_summary || {
    dies_processed: 11,
    top1_accuracy: 1.0,
    top1_accuracy_percent: '100.0%',
    retest_cycles_avoided: 6,
    cumulative_time_saved_ms: 248.0,
    fallback_count: 0,
    feasibility_miss_rate: 0.0,
    algorithm_distribution: { combo: 5, col: 2, row: 2, ecc: 1, cluster: 1 }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0B0D12] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex flex-1">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 p-6 space-y-6 overflow-y-auto max-w-[1600px] mx-auto">
          {/* Top KPI Cards */}
          <KpiCards summary={summary} />

          {/* Tab Views */}
          {(activeTab === 'overview' || activeTab === 'bitmap') && (
            <BitmapVisualizer
              bitmap={bitmap}
              archetype={archetype}
              features={features}
              onSelectArchetype={runSimulation}
              onToggleCell={handleToggleCell}
              isLoading={isLoading}
            />
          )}

          {(activeTab === 'overview' || activeTab === 'inference') && (
            <RecommendationPanel
              prediction={prediction}
              spareRows={spareRows}
              spareCols={spareCols}
              spareBlocks={spareBlocks}
              onUpdateSpares={handleUpdateSpares}
              isLoading={isLoading}
            />
          )}

          {(activeTab === 'overview' || activeTab === 'timing') && (
            <TimingComparison prediction={prediction} />
          )}

          {(activeTab === 'overview' || activeTab === 'benchmark') && (
            <SessionBenchmark
              onRunBenchmark={runBatchBenchmark}
              benchmarkData={benchmarkData}
              isLoading={isLoading}
            />
          )}
        </main>
      </div>
    </div>
  );
};
export default App;
