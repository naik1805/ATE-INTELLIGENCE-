"""Read-only KPI/status sidecar for the Dynamic Test Limits (DTL) agent.

Runs as a separate uvicorn process on its own port. It never imports the
dtl_agent package or mutates any artifact -- it probes the agent's existing
/health and /ready endpoints and reads the checked-in training metrics JSON.

    python -m uvicorn kpi_wrapper:app --host 127.0.0.1 --port 8803

Env:
    DTL_KPI_PORT     port for this sidecar        (default 8803)
    DTL_AGENT_URL    base URL of the DTL API      (default http://127.0.0.1:8010)
    DTL_API_PREFIX   agent route prefix           (default /api/v1)
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib import error, request

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

AGENT_ID = "dtl"
AGENT_NAME = "Dynamic Test Limits"

ROOT_DIR = Path(__file__).resolve().parent
METRICS_FILE = ROOT_DIR / "artifacts" / "temporal" / "shared" / "training" / "metrics.json"
ANALYSIS_DIR = ROOT_DIR / "artifacts" / "temporal" / "shared" / "phase_12_9_analysis"

PORT = int(os.environ.get("DTL_KPI_PORT", "8803"))
# 8010, not 8000: port 8000 stays reserved for the dashboard's own backend.
AGENT_URL = os.environ.get("DTL_AGENT_URL", "http://127.0.0.1:8010").rstrip("/")
API_PREFIX = os.environ.get("DTL_API_PREFIX", "/api/v1").rstrip("/")

app = FastAPI(title="DTL KPI Wrapper", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _get_json(path, timeout=2.5):
    try:
        with request.urlopen(f"{AGENT_URL}{path}", timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (error.URLError, OSError, ValueError):
        return None


def _load_training_metrics():
    if not METRICS_FILE.is_file():
        return None
    try:
        return json.loads(METRICS_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _snapshot():
    warnings = []
    kpis = []

    ready = _get_json(f"{API_PREFIX}/ready")
    reachable = ready is not None

    if not reachable:
        status = "error"
        warnings.append(f"DTL agent not reachable at {AGENT_URL}{API_PREFIX}/ready.")
    elif ready.get("status") == "ready":
        status = "running"
    else:
        status = "idle"
        warnings.append(
            f"Agent is up but not ready (reason: {ready.get('reason', 'unknown')})."
        )

    if not ANALYSIS_DIR.is_dir():
        warnings.append(
            "artifacts/temporal/shared/phase_12_9_analysis/ is absent, so the agent's "
            "cost-savings and three-month decision KPIs are unavailable. Showing "
            "checked-in model-quality metrics instead."
        )

    # Preferred source: the agent's own cost-savings aggregate, when artifacts exist.
    cost = _get_json(f"{API_PREFIX}/analysis/cost-savings", timeout=5.0)
    agg = (cost or {}).get("aggregate") if isinstance(cost, dict) else None
    if isinstance(agg, dict):
        kpis.extend([
            {"id": "tester_hours_saved", "label": "Tester Hours Saved",
             "value": float(agg.get("tester_hours_saved") or 0.0),
             "unit": "h", "trend": "up", "precision": 2},
            {"id": "time_saved_pct", "label": "Predicted Time Saved",
             "value": float(agg.get("predicted_time_saved_pct") or 0.0),
             "unit": "%", "trend": "up", "precision": 2},
            {"id": "records_evaluated", "label": "Records Evaluated",
             "value": float(agg.get("records_evaluated") or 0),
             "unit": "", "trend": "flat", "precision": 0},
        ])
        warnings.append(
            "Cost/time savings are counterfactual predictions from the agent's "
            "assumption-based estimator, not measured ATE savings."
        )
        source = f"agent GET {API_PREFIX}/analysis/cost-savings"
    else:
        source = "artifacts/temporal/shared/training/metrics.json"

    # Always include model-quality KPIs from the checked-in artifacts.
    metrics = _load_training_metrics()
    if metrics is None:
        warnings.append(f"Could not read {METRICS_FILE.name}; model-quality KPIs omitted.")
    else:
        test = metrics.get("test", {}) if isinstance(metrics, dict) else {}
        dataset = metrics.get("dataset", {}) if isinstance(metrics, dict) else {}
        kpis.extend([
            {"id": "spearman", "label": "Ranking Spearman",
             "value": float(test.get("spearman") or 0.0),
             "unit": "", "trend": "up", "precision": 4},
            {"id": "pairwise_accuracy", "label": "Pairwise Accuracy",
             "value": float(test.get("pairwise_accuracy") or 0.0) * 100.0,
             "unit": "%", "trend": "up", "precision": 2},
            {"id": "mae", "label": "Test MAE",
             "value": float(test.get("mae") or 0.0),
             "unit": "", "trend": "down", "precision": 4},
            {"id": "test_examples", "label": "Test Examples",
             "value": float(dataset.get("n_test") or 0),
             "unit": "", "trend": "flat", "precision": 0},
        ])
        warnings.append(
            "Model-quality figures come from checked-in training artifacts, not a "
            "live evaluation run."
        )

    return {
        "agent_id": AGENT_ID,
        "name": AGENT_NAME,
        "status": status,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "last_activity_at": None,
        "source": source,
        "detail_url": AGENT_URL,
        "kpis": kpis,
        "warnings": warnings,
    }


@app.get(f"/api/agents/{AGENT_ID}/kpis")
def get_kpis():
    try:
        return _snapshot()
    except Exception as exc:  # noqa: BLE001 - sidecar must degrade, never crash
        return {
            "agent_id": AGENT_ID,
            "name": AGENT_NAME,
            "status": "error",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "last_activity_at": None,
            "source": "unavailable",
            "detail_url": AGENT_URL,
            "kpis": [],
            "warnings": [f"KPI collection failed: {exc}"],
        }


@app.get(f"/api/agents/{AGENT_ID}/status")
def get_status():
    try:
        return {"status": _snapshot()["status"]}
    except Exception:  # noqa: BLE001
        return {"status": "error"}


if __name__ == "__main__":
    import uvicorn

    print(f"[{AGENT_ID}] KPI wrapper on http://127.0.0.1:{PORT} (agent: {AGENT_URL})")
    uvicorn.run(app, host="127.0.0.1", port=PORT)
