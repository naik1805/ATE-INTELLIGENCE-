"""Read-only KPI/status sidecar for the ATE Retest Benefit Prediction agent.

Runs as a separate uvicorn process on its own port. It does not modify any
agent file. It calls the agent's existing pure-Python service layer
(MLService, which contains no Streamlit code) to read metrics the agent
already computes.

    python -m uvicorn kpi_wrapper:app --host 127.0.0.1 --port 8804

MLService trains on construction, so the model is warmed up on a background
thread at startup; until it finishes the agent reports "idle".

Env:
    RETEST_KPI_PORT        port for this sidecar   (default 8804)
    RETEST_AGENT_URL       agent UI/API URL shown as the detail link
                           (default http://127.0.0.1:8501)
    RETEST_COST_PER_HOUR   override ATE cost/hour  (default: agent's own constant)
"""

import os
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

AGENT_ID = "retest_reduction"
AGENT_NAME = "Retest Benefit Prediction"

PORT = int(os.environ.get("RETEST_KPI_PORT", "8804"))
AGENT_URL = os.environ.get("RETEST_AGENT_URL", "http://127.0.0.1:8501").rstrip("/")
_COST_OVERRIDE = os.environ.get("RETEST_COST_PER_HOUR")

CACHE_TTL_SEC = 60

app = FastAPI(title="Retest KPI Wrapper", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

_state = {
    "service": None,
    "init_error": None,
    "warming": True,
    "cache": None,
    "cache_at": 0.0,
}
_lock = threading.Lock()


def _warm_up():
    """Construct MLService once on a background thread (it trains on init)."""
    try:
        from retest_ai.models.service import MLService

        svc = MLService.get_instance()
        with _lock:
            _state["service"] = svc
    except Exception as exc:  # noqa: BLE001
        with _lock:
            _state["init_error"] = f"{type(exc).__name__}: {exc}"
    finally:
        with _lock:
            _state["warming"] = False


@app.on_event("startup")
def _on_startup():
    threading.Thread(target=_warm_up, daemon=True).start()


def _compute():
    warnings = []
    svc = _state["service"]

    df = svc.get_month_12_batch_table()
    total_events = int(len(df))
    devices = int(df["Device_ID"].nunique()) if "Device_ID" in df.columns else 0

    def _split(mask):
        sub = df[mask]
        devices_n = int(sub["Device_ID"].nunique()) if "Device_ID" in sub.columns else 0
        return int(len(sub)), devices_n

    retest_n = dont_retest_n = 0
    retest_devices = dont_retest_devices = 0
    if "AI_Recommendation" in df.columns:
        rec = df["AI_Recommendation"]
        retest_n, retest_devices = _split(rec == "RETEST")
        dont_retest_n, dont_retest_devices = _split(rec != "RETEST")
    else:
        warnings.append("AI_Recommendation column missing; recommendation split unavailable.")

    retest_pct = (retest_n / total_events * 100.0) if total_events else 0.0
    # Share of failure events the agent recommends skipping -- the "reduction".
    reduction_pct = 100.0 - retest_pct if total_events else 0.0

    cost_kwargs = {}
    if _COST_OVERRIDE:
        try:
            cost_kwargs["cost_per_hour"] = float(_COST_OVERRIDE)
        except ValueError:
            warnings.append(
                f"RETEST_COST_PER_HOUR={_COST_OVERRIDE!r} is not a number; "
                "using the agent's own constant."
            )
    cost = svc.get_cost_impact(df, **cost_kwargs) or {}

    roc_auc = 0.0
    try:
        roc_auc = float(
            svc.comparison_results["results"][svc.model_name]["calibrated_metrics"]["ROC-AUC"]
        )
    except (KeyError, TypeError, ValueError):
        warnings.append("ROC-AUC not available from the agent's comparison results.")

    warnings.append(
        "Savings are estimates: retest times are historical means and the ATE "
        "cost/hour is a configured constant, not a measured plant rate."
    )
    warnings.append(
        "ROC-AUC is the Month 6 temporal-holdout score, not live Month 12 performance."
    )
    warnings.append(
        "Ground-truth outcome file is absent, so accuracy/recall KPIs are omitted."
    )

    kpis = [
        {"id": "retest_reduction_pct", "label": "Retest Reduction",
         "value": reduction_pct, "unit": "%", "trend": "up", "precision": 1},
        {"id": "estimated_savings", "label": "Estimated Savings",
         "value": float(cost.get("estimated_savings") or 0.0),
         "unit": "USD", "trend": "up", "precision": 0},
        {"id": "retest_pct", "label": "Retest Recommended",
         "value": retest_pct, "unit": "%", "trend": "down", "precision": 1},
        {"id": "retest_events", "label": "Retest Events",
         "value": float(retest_n), "unit": "", "trend": "flat", "precision": 0},
        {"id": "retest_devices", "label": "Retest Devices",
         "value": float(retest_devices), "unit": "", "trend": "flat", "precision": 0},
        {"id": "dont_retest_events", "label": "Don't Retest Events",
         "value": float(dont_retest_n), "unit": "", "trend": "flat", "precision": 0},
        {"id": "dont_retest_devices", "label": "Don't Retest Devices",
         "value": float(dont_retest_devices), "unit": "", "trend": "flat", "precision": 0},
        {"id": "events_evaluated", "label": "Events Evaluated",
         "value": float(total_events), "unit": "", "trend": "flat", "precision": 0},
        {"id": "devices_evaluated", "label": "Devices Evaluated",
         "value": float(devices), "unit": "", "trend": "flat", "precision": 0},
        {"id": "roc_auc", "label": "Holdout ROC-AUC",
         "value": roc_auc, "unit": "", "trend": "up", "precision": 4},
    ]

    return {
        "agent_id": AGENT_ID,
        "name": AGENT_NAME,
        "status": "running",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "last_activity_at": None,
        "source": "retest_ai.models.service.MLService (in-process, read-only)",
        "detail_url": AGENT_URL,
        "kpis": kpis,
        "warnings": warnings,
    }


def _degraded(status, warning):
    return {
        "agent_id": AGENT_ID,
        "name": AGENT_NAME,
        "status": status,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "last_activity_at": None,
        "source": "retest_ai.models.service.MLService (in-process, read-only)",
        "detail_url": AGENT_URL,
        "kpis": [],
        "warnings": [warning],
    }


def _snapshot():
    with _lock:
        warming = _state["warming"]
        init_error = _state["init_error"]
        svc = _state["service"]
        cache, cache_at = _state["cache"], _state["cache_at"]

    if init_error:
        return _degraded("error", f"MLService failed to initialise: {init_error}")
    if warming or svc is None:
        return _degraded("idle", "Model is still warming up (MLService trains on startup).")

    if cache and (time.time() - cache_at) < CACHE_TTL_SEC:
        return cache

    snap = _compute()
    with _lock:
        _state["cache"] = snap
        _state["cache_at"] = time.time()
    return snap


@app.get(f"/api/agents/{AGENT_ID}/kpis")
def get_kpis():
    try:
        return _snapshot()
    except Exception as exc:  # noqa: BLE001 - sidecar must degrade, never crash
        return _degraded("error", f"KPI collection failed: {type(exc).__name__}: {exc}")


@app.get(f"/api/agents/{AGENT_ID}/status")
def get_status():
    try:
        return {"status": _snapshot()["status"]}
    except Exception:  # noqa: BLE001
        return {"status": "error"}


if __name__ == "__main__":
    import uvicorn

    print(f"[{AGENT_ID}] KPI wrapper on http://127.0.0.1:{PORT}")
    uvicorn.run(app, host="127.0.0.1", port=PORT)
