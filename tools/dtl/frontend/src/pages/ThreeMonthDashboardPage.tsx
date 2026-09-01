import { useEffect, useMemo, useRef, useState } from "react";
import {
  ackCacheRestore,
  readAgentCache,
  writeAgentCache,
} from "../../../../shared/verilumenCache.js";

const DTL_AGENT_ID = "dtl";
import { ApiError } from "@/api/client";
import {
  DEFAULT_ANALYSIS_DIE,
  DEFAULT_ANALYSIS_LOT,
  DEFAULT_ANALYSIS_MONTH,
  DEFAULT_ANALYSIS_PARAMETER,
  type AnalysisCandidateRow,
  type AnalysisRecommendationRow,
  type DieLevelIdentities,
  type ObservedSummaryPayload,
  type ThreeMonthAnalysisBundle,
} from "@/api/analysisTypes";
import {
  getCostSavings,
  getThreeMonthAnalysis,
  getThreeMonthDieHistory,
  getThreeMonthDieRecommendation,
  getThreeMonthObserved,
  getUploadStatus,
  postAnalysisUpload,
  type AnalysisUploadResult,
  type AnalysisUploadStatus,
} from "@/api/endpoints";
import {
  CandidateComparisonTable,
  MlTieBreakInsightCard,
  MonthChangeCard,
  RecommendedTrendChart,
  YieldTrendTable,
} from "@/components/threeMonth/ComparisonPanels";
import { PredictedCostSavingsCard } from "@/components/threeMonth/CostSavingsCard";
import { UploadAnalysisPanel } from "@/components/threeMonth/UploadTestDataPanel";
import {
  TopSummaryCard,
  WhySelectedCard,
} from "@/components/threeMonth/DecisionPanels";
import { DieHierarchySelectors } from "@/components/threeMonth/DieHierarchySelectors";
import {
  ObservedDieSummary,
  SameDieThreeMonthHistory,
} from "@/components/threeMonth/DieLevelPanels";
import {
  ExecutiveMatrix,
  MonthSelector,
  ParameterSelector,
} from "@/components/threeMonth/SelectorsAndMeta";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { monthLabel } from "@/utils/analysisDisplay";
import type { CostSavingsConfig, CostSavingsPayload } from "@/api/analysisTypes";
import {
  readCostSavingsConfig,
  writeCostSavingsConfig,
} from "@/utils/costSavingsConfig";

function categoryForLot(identities: DieLevelIdentities | null | undefined, lotId: string): string {
  if (!identities?.lots_by_category) return "NORMAL";
  for (const [cat, lots] of Object.entries(identities.lots_by_category)) {
    if (lots.includes(lotId)) return cat;
  }
  return "NORMAL";
}

function firstLot(identities: DieLevelIdentities | null | undefined, category: string): string {
  return identities?.lots_by_category?.[category]?.[0] ?? DEFAULT_ANALYSIS_LOT;
}

function firstDie(identities: DieLevelIdentities | null | undefined, lotId: string): string {
  return identities?.dies_by_lot?.[lotId]?.[0] ?? DEFAULT_ANALYSIS_DIE;
}

function requestKey(
  month: string,
  category: string,
  lotId: string,
  dieId: string,
  parameter: string,
): string {
  return `${month}::${category}::${lotId}::${dieId}::${parameter}`;
}

function normalizeCandidates(
  month: string,
  lotId: string,
  dieId: string,
  parameter: string,
  cands: Array<Partial<AnalysisCandidateRow> & { candidate_limit: number }>,
): AnalysisCandidateRow[] {
  return cands.map((c) => ({
    production_month: month,
    lot_id: lotId,
    die_id: dieId,
    parameter: parameter,
    parameter_display: parameter,
    candidate_limit: c.candidate_limit,
    simulated_yield: c.simulated_yield ?? null,
    safety_status: c.safety_status ?? null,
    eligible: c.eligible,
    in_policy_gate_set: c.in_policy_gate_set ?? true,
    ml_score: c.ml_score ?? null,
    ml_rank: c.ml_rank ?? null,
    is_current: c.is_current,
    is_selected: c.is_selected,
    model_used: c.model_used ?? null,
    decision: c.decision ?? null,
  }));
}

export function ThreeMonthDashboardPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadMeta, setUploadMeta] = useState<AnalysisUploadResult | AnalysisUploadStatus | null>(null);
  const [bundle, setBundle] = useState<ThreeMonthAnalysisBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [jobStage, setJobStage] = useState<string | null>(null);
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [month, setMonth] = useState(DEFAULT_ANALYSIS_MONTH);
  const [parameter, setParameter] = useState(DEFAULT_ANALYSIS_PARAMETER);
  const [category, setCategory] = useState("NORMAL");
  const [lotId, setLotId] = useState(DEFAULT_ANALYSIS_LOT);
  const [dieId, setDieId] = useState(DEFAULT_ANALYSIS_DIE);

  const [dieRow, setDieRow] = useState<AnalysisRecommendationRow | undefined>();
  const [dieCandidates, setDieCandidates] = useState<AnalysisCandidateRow[]>([]);
  const [dieHistory, setDieHistory] = useState<AnalysisRecommendationRow[]>([]);
  const [observed, setObserved] = useState<ObservedSummaryPayload | null>(null);
  const [dieLoading, setDieLoading] = useState(false);
  const [dieError, setDieError] = useState<string | null>(null);
  const [costSavings, setCostSavings] = useState<CostSavingsPayload | null>(null);
  const [costSavingsLoading, setCostSavingsLoading] = useState(false);
  const [costSavingsError, setCostSavingsError] = useState<string | null>(null);
  const [costSavingsConfig, setCostSavingsConfig] = useState<CostSavingsConfig>(() =>
    readCostSavingsConfig(),
  );
  const engineeringDetailRef = useRef<HTMLDivElement>(null);

  const updateCostSavingsConfig = (patch: Partial<CostSavingsConfig>) => {
    setCostSavingsConfig((prev) => {
      const next = { ...prev, ...patch };
      writeCostSavingsConfig(next);
      return next;
    });
  };

  const selectParameter = (next: string) => {
    setParameter(next);
    requestAnimationFrame(() => {
      engineeringDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const onSessionReady = (result: AnalysisUploadResult) => {
    setUploadMeta(result);
    setBundle(null);
    setError(null);
    setErrorCode(null);
    setAnalyzing(true);

    if (result.status === "completed" || result.status === "ready") {
      setSessionId(result.analysis_session_id);
    } else {
      setJobStage(result.stage || "Queued for analysis processing");
      setProgressPct(result.progress_pct ?? 5);

      const sid = result.analysis_session_id;
      const interval = setInterval(async () => {
        try {
          const statusResult = await getUploadStatus(sid);
          if (statusResult.status === "processing" || statusResult.status === "queued") {
            setJobStage(statusResult.stage || "Processing analysis...");
            setProgressPct(statusResult.progress_pct ?? 50);
          } else if (statusResult.status === "completed") {
            clearInterval(interval);
            setUploadMeta(statusResult);
            setSessionId(sid);
            setJobStage(null);
            setProgressPct(null);
          } else if (statusResult.status === "failed") {
            clearInterval(interval);
            setAnalyzing(false);
            setError(statusResult.error || "Upload processing failed.");
            setJobStage(null);
            setProgressPct(null);
          }
        } catch (err: unknown) {
          clearInterval(interval);
          setAnalyzing(false);
          if (err instanceof ApiError) {
            setError(err.message);
          } else if (err instanceof Error) {
            setError(err.message);
          } else {
            setError("Server restarted or lost connection while processing. Please re-upload dataset.");
          }
          setJobStage(null);
          setProgressPct(null);
        }
      }, 2000);
    }
  };

  const applyBundle = (data: ThreeMonthAnalysisBundle) => {
    setBundle(data);
    const ids = data.die_level_identities;
    const primary = data.executive_summary?.primary_die;
    if (ids && primary?.lot_id && primary?.die_id) {
      const cat = categoryForLot(ids, primary.lot_id);
      setCategory(cat);
      setLotId(primary.lot_id);
      setDieId(primary.die_id);
    } else if (ids) {
      const cat =
        (ids.categories ?? []).find((c) => (ids.lots_by_category?.[c] ?? []).length > 0) ??
        "NORMAL";
      const lot = firstLot(ids, cat);
      setCategory(cat);
      setLotId(lot);
      setDieId(firstDie(ids, lot));
    }
    const params = data.scorable_parameters ?? [];
    if (params.length) {
      setParameter((current) => (params.includes(current) ? current : params[0]!));
    }
    setLoading(false);
    setAnalyzing(false);
  };

  const restoreDtlCache = (payload: Record<string, unknown> | null | undefined): boolean => {
    if (!payload?.bundle || !payload?.sessionId) return false;
    setSessionId(String(payload.sessionId));
    setUploadMeta((payload.uploadMeta as AnalysisUploadResult) ?? null);
    if (payload.month) setMonth(String(payload.month));
    if (payload.parameter) setParameter(String(payload.parameter));
    if (payload.category) setCategory(String(payload.category));
    if (payload.lotId) setLotId(String(payload.lotId));
    if (payload.dieId) setDieId(String(payload.dieId));
    applyBundle(payload.bundle as ThreeMonthAnalysisBundle);
    return true;
  };

  useEffect(() => {
    if (!bundle || !sessionId) return;
    writeAgentCache(DTL_AGENT_ID, {
      sessionId,
      uploadMeta,
      bundle,
      month,
      parameter,
      category,
      lotId,
      dieId,
    });
  }, [bundle, sessionId, uploadMeta, month, parameter, category, lotId, dieId]);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("autoload")) return;
    const base =
      new URLSearchParams(window.location.search).get("dataBase") ||
      "http://localhost:3000/api/default-data";
    let cancelled = false;

    const cached = readAgentCache(DTL_AGENT_ID);
    if (cached && restoreDtlCache(cached)) {
      ackCacheRestore(DTL_AGENT_ID);
      return;
    }

    const pickMonthFromPayload = (
      payloads: Array<{ name: string; type?: string; buffer: ArrayBuffer }>,
      patterns: string[],
    ) => {
      const meta = payloads.find((f) => patterns.some((p) => f.name.toLowerCase().includes(p)));
      if (!meta) return null;
      const name = meta.name.split("/").pop() || meta.name;
      const lower = meta.name.toLowerCase();
      const mime = lower.endsWith(".zip")
        ? "application/zip"
        : lower.endsWith(".csv")
          ? "text/csv"
          : meta.type || "application/octet-stream";
      return new File([meta.buffer], name, { type: mime });
    };

    const runAutoload = async (
      boot: Record<string, unknown>,
      injectedFiles: Array<{ name: string; type?: string; buffer: ArrayBuffer }> = [],
    ) => {
      if (injectedFiles.length >= 3) {
        const january = pickMonthFromPayload(injectedFiles, [
          "january",
          "2026-01",
          "2026_01",
          "dtl_input_2026_01",
          "_01",
        ]);
        const february = pickMonthFromPayload(injectedFiles, [
          "february",
          "2026-02",
          "2026_02",
          "dtl_input_2026_02",
          "_02",
        ]);
        const march = pickMonthFromPayload(injectedFiles, [
          "march",
          "2026-03",
          "2026_03",
          "dtl_input_2026_03",
          "_03",
        ]);
        if (january && february && march) {
          const result = await postAnalysisUpload({ january, february, march });
          if (!cancelled) onSessionReady(result);
          return;
        }
      }

      const files: Array<{ name: string }> = (boot.files as Array<{ name: string }>) || [];
      if (files.length >= 3) {
        const fetchMonth = async (patterns: string[]) => {
          const meta = files.find((f) =>
            patterns.some((p) => f.name.toLowerCase().includes(p)),
          );
          if (!meta) return null;
          const blob = await fetch(
            `${base}/agents/dtl/files/${encodeURIComponent(meta.name)}`,
          ).then((r) => r.blob());
          const name = meta.name.split("/").pop() || meta.name;
          const lower = meta.name.toLowerCase();
          const mime = lower.endsWith(".zip")
            ? "application/zip"
            : lower.endsWith(".csv")
              ? "text/csv"
              : blob.type || "application/octet-stream";
          return new File([blob], name, { type: mime });
        };
        const january = await fetchMonth(["january", "2026-01", "2026_01", "dtl_input_2026_01", "_01"]);
        const february = await fetchMonth(["february", "2026-02", "2026_02", "dtl_input_2026_02", "_02"]);
        const march = await fetchMonth(["march", "2026-03", "2026_03", "dtl_input_2026_03", "_03"]);
        if (january && february && march) {
          const result = await postAnalysisUpload({ january, february, march });
          if (!cancelled) onSessionReady(result);
          return;
        }
      }

      if (boot.analysis_session_id && boot.upload_result) {
        onSessionReady(boot.upload_result as AnalysisUploadResult);
        return;
      }

      const data = await getThreeMonthAnalysis();
      if (!cancelled) applyBundle(data);
    };

    const onMessage = (ev: MessageEvent) => {
      if (ev.data?.type === "verilumen-cache-restore" && ev.data.agentId === DTL_AGENT_ID) {
        if (restoreDtlCache(ev.data.payload)) ackCacheRestore(DTL_AGENT_ID);
        return;
      }
      if (ev.data?.type !== "verilumen-autoload" || ev.data.agentId !== "dtl") return;
      void runAutoload(ev.data.bootstrap || {}, ev.data.files || []).catch((err) => {
        if (!cancelled) console.warn("dtl parent autoload failed", err);
      });
    };
    window.addEventListener("message", onMessage);

    (async () => {
      try {
        const boot = await fetch(`${base}/agents/dtl/bootstrap`).then((r) => r.json());
        if (cancelled) return;
        await runAutoload(boot);
      } catch (err) {
        if (!cancelled) {
          console.warn("dtl autoload failed", err);
          try {
            const data = await getThreeMonthAnalysis();
            if (!cancelled) applyBundle(data);
          } catch {
            /* keep upload prompt */
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    getThreeMonthAnalysis(ctrl.signal, sessionId)
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setBundle(data);
        const ids = data.die_level_identities;
        const primary = data.executive_summary?.primary_die;
        if (ids && primary?.lot_id && primary?.die_id) {
          const cat = categoryForLot(ids, primary.lot_id);
          setCategory(cat);
          setLotId(primary.lot_id);
          setDieId(primary.die_id);
        } else if (ids) {
          const cat =
            (ids.categories ?? []).find((c) => (ids.lots_by_category?.[c] ?? []).length > 0) ??
            "NORMAL";
          const lot = firstLot(ids, cat);
          setCategory(cat);
          setLotId(lot);
          setDieId(firstDie(ids, lot));
        }
        const params = data.scorable_parameters ?? [];
        if (params.length && !params.includes(parameter)) {
          setParameter(params[0]!);
        }
        setLoading(false);
        setAnalyzing(false);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof ApiError) {
          setError(err.message);
          setErrorCode(err.code);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to load three-month analysis.");
        }
        setLoading(false);
        setAnalyzing(false);
      });
    return () => ctrl.abort();
  }, [sessionId]);

  useEffect(() => {
    if (!bundle || !sessionId || !lotId || !dieId) return;
    const ctrl = new AbortController();
    setCostSavings(null);
    setCostSavingsLoading(true);
    setCostSavingsError(null);
    getCostSavings(
      {
        include_per_device: false,
        analysis_session_id: sessionId,
        lot_id: lotId,
        die_id: dieId,
        production_month: month !== "all" ? month : undefined,
      },
      ctrl.signal,
    )
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setCostSavings(data);
        setCostSavingsLoading(false);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof ApiError) {
          setCostSavingsError(err.message);
        } else if (err instanceof Error) {
          setCostSavingsError(err.message);
        } else {
          setCostSavingsError("Failed to load cost-savings estimate.");
        }
        setCostSavingsLoading(false);
      });
    return () => ctrl.abort();
  }, [bundle, sessionId, lotId, dieId, month]);

  const identities = bundle?.die_level_identities;
  const selectionKey = requestKey(month, category, lotId, dieId, parameter);

  useEffect(() => {
    if (!bundle || !sessionId) return;

    const ctrl = new AbortController();
    const keyAtStart = selectionKey;
    setDieLoading(true);
    setDieError(null);
    setDieRow(undefined);
    setDieCandidates([]);
    setDieHistory([]);

    Promise.all([
      getThreeMonthDieRecommendation(
        {
          production_month: month,
          lot_id: lotId,
          die_id: dieId,
          parameter,
          analysis_session_id: sessionId,
        },
        ctrl.signal,
      ),
      getThreeMonthDieHistory(
        { lot_id: lotId, die_id: dieId, parameter, analysis_session_id: sessionId },
        ctrl.signal,
      ),
      getThreeMonthObserved(
        { lot_id: lotId, die_id: dieId, analysis_session_id: sessionId },
        ctrl.signal,
      ),
    ])
      .then(([rec, hist, obs]) => {
        if (ctrl.signal.aborted) return;
        if (keyAtStart !== requestKey(month, category, lotId, dieId, parameter)) return;
        const row = rec.recommendation;
        if (
          row.production_month !== month ||
          row.lot_id !== lotId ||
          row.die_id !== dieId
        ) {
          setDieRow(undefined);
          setDieCandidates([]);
          setDieHistory([]);
          setDieError("Recommendation unavailable: identity mismatch in response.");
          setDieLoading(false);
          return;
        }
        setDieRow(row);
        setDieCandidates(
          normalizeCandidates(month, lotId, dieId, parameter, rec.candidates ?? []),
        );
        setDieHistory(hist.history ?? []);
        setObserved(obs);
        setDieLoading(false);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setDieRow(undefined);
        setDieCandidates([]);
        setDieHistory([]);
        setObserved(null);
        if (err instanceof ApiError) {
          setDieError(`Recommendation unavailable: ${err.message}`);
        } else if (err instanceof Error) {
          setDieError(`Recommendation unavailable: ${err.message}`);
        } else {
          setDieError("Recommendation unavailable");
        }
        setDieLoading(false);
      });
    return () => ctrl.abort();
  }, [bundle, sessionId, selectionKey, month, category, lotId, dieId, parameter]);

  const primaryRows = bundle?.primary_recommendations ?? [];

  const changeRow = useMemo(
    () =>
      (bundle?.temporal_changes ?? []).find(
        (c) => c.parameter_display === parameter && c.recommendation_changed === true,
      ),
    [bundle, parameter],
  );

  const tieProof = useMemo(() => {
    const proofs = bundle?.policy_proofs?.ml_tie_break_proofs ?? [];
    return (
      proofs.find(
        (p) =>
          p.parameter_display === parameter &&
          p.production_month === month &&
          p.lot_id === lotId &&
          p.die_id === dieId,
      ) ?? bundle?.executive_summary.ml_tie_break_proof_example
    );
  }, [bundle, parameter, month, lotId, dieId]);

  const onCategoryChange = (c: string) => {
    setCategory(c);
    const lot = firstLot(identities, c);
    setLotId(lot);
    setDieId(firstDie(identities, lot));
  };

  const onLotChange = (lot: string) => {
    setLotId(lot);
    setDieId(firstDie(identities, lot));
    setCategory(categoryForLot(identities, lot));
  };

  const onMonthChange = (m: string) => {
    setMonth(m);
    if (identities) {
      const lots = identities.lots_by_category?.[category] ?? [];
      if (!lots.includes(lotId)) {
        const lot = firstLot(identities, category);
        setLotId(lot);
        setDieId(firstDie(identities, lot));
      } else {
        const dies = identities.dies_by_lot?.[lotId] ?? [];
        if (!dies.includes(dieId)) {
          setDieId(firstDie(identities, lotId));
        }
      }
    }
  };

  return (
    <div className="space-y-5" data-testid="three-month-dashboard">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">DTL Recommendation</h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Upload test data, then review AI-recommended Dynamic Test Limits generated from your uploads.
        </p>
      </div>

      <UploadAnalysisPanel
        onSessionReady={onSessionReady}
        analyzing={analyzing || loading}
        jobStage={jobStage}
        progressPct={progressPct}
      />

      {!sessionId ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-6 text-center shadow-sm">
          <p className="text-xs text-[var(--text-muted)] font-mono" data-testid="upload-prompt">
            Upload Jan, Feb and Mar test data to begin analysis.
          </p>
        </div>
      ) : null}

      {sessionId && (analyzing || loading) ? (
        <div data-testid="analyzing-uploaded" className="space-y-2">
          <LoadingState message="Analyzing uploaded Jan/Feb/Mar data..." />
        </div>
      ) : null}

      {sessionId && error ? <ErrorState message={error} code={errorCode} /> : null}

      {sessionId && bundle && !loading && !error ? (
        <>
          <div
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel-secondary)] px-3.5 py-2 text-xs font-mono text-[var(--text-secondary)] flex items-center justify-between shadow-sm"
            data-testid="upload-provenance"
          >
            <span>
              {bundle.data_provenance ??
                uploadMeta?.data_provenance ??
                "Analysis generated from uploaded test data"}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">● Verified Dataset</span>
          </div>

          <ExecutiveMatrix
            primaryRows={primaryRows}
            parameters={bundle.scorable_parameters}
            selectedParameter={parameter}
            onSelectParameter={selectParameter}
          />

          <PredictedCostSavingsCard
            payload={costSavings}
            loading={costSavingsLoading}
            error={costSavingsError}
            config={costSavingsConfig}
            onConfigChange={updateCostSavingsConfig}
          />

          <MonthSelector value={month} onChange={onMonthChange} />
          <DieHierarchySelectors
            identities={identities}
            category={category}
            lotId={lotId}
            dieId={dieId}
            parameter={parameter}
            parameters={bundle.scorable_parameters}
            onCategoryChange={onCategoryChange}
            onLotChange={onLotChange}
            onDieChange={setDieId}
            onParameterChange={setParameter}
          />
          <ParameterSelector
            value={parameter}
            options={bundle.scorable_parameters}
            onChange={setParameter}
            nonScorable={bundle.non_scorable_parameters}
            nonScorableNote={bundle.non_scorable_note}
          />

          <div
            ref={engineeringDetailRef}
            className="space-y-5 scroll-mt-4"
            data-testid="engineering-detail"
          >
            {dieLoading ? (
              <div
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-3 text-xs text-[var(--text-secondary)] shadow-sm"
                data-testid="die-loading"
              >
                <p className="font-semibold text-[var(--text-primary)]">Generating recommendation...</p>
                <ul className="mt-2 space-y-0.5 font-mono text-[var(--text-muted)]">
                  <li>{monthLabel(month)}</li>
                  <li>{lotId}</li>
                  <li>{dieId}</li>
                  <li>{parameter}</li>
                </ul>
              </div>
            ) : null}
            {dieError ? (
              <p className="text-xs font-medium text-amber-500" data-testid="die-error">
                {dieError}
              </p>
            ) : null}

            {!dieLoading && !dieError ? (
              <>
                <TopSummaryCard
                  month={month}
                  row={dieRow}
                  lotId={lotId}
                  dieId={dieId}
                  parameter={parameter}
                  category={category}
                />
                <WhySelectedCard row={dieRow} />

                <SameDieThreeMonthHistory dieId={dieId} history={dieHistory} loading={dieLoading} />
                <div className="grid gap-5 lg:grid-cols-2">
                  <RecommendedTrendChart history={dieHistory} />
                  <YieldTrendTable history={dieHistory} />
                </div>

                <MonthChangeCard change={changeRow} history={dieHistory} />
                <CandidateComparisonTable candidates={dieCandidates} />
                <MlTieBreakInsightCard row={dieRow} proof={tieProof} />
                <ObservedDieSummary payload={observed} />
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
