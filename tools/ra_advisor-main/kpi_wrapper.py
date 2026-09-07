"""Read-only KPI/status sidecar for the RA Advisor agent.

Probes the agent health endpoint and caches a short evaluate session for
dashboard KPI tiles. Does not mutate agent source.

    python -m uvicorn kpi_wrapper:app --host 127.0.0.1 --port 8805

Env:
    RA_ADVISOR_KPI_PORT   sidecar port (default 8805)
    RA_ADVISOR_AGENT_URL  agent base URL (default http://127.0.0.1:8030)
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from urllib import error, request

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

AGENT_ID = "ra_advisor"
AGENT_NAME = "RA Advisor"

PORT = int(os.environ.get("RA_ADVISOR_KPI_PORT", "8805"))
AGENT_URL = os.environ.get("RA_ADVISOR_AGENT_URL", "http://127.0.0.1:8030").rstrip("/")

CACHE_TTL_SEC = 90
PREVIEW_TTL_SEC = 12
PREVIEW_ARCHETYPES = (
    "mixed_row_column",
    "row_dominant",
    "column_dominant",
    "localized_cluster",
    "scattered",
)

app = FastAPI(title="RA Advisor KPI Wrapper", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

_cache: dict | None = None
_cache_at = 0.0
_preview: dict | None = None
_preview_at = 0.0
_preview_idx = 0


def _get_json(path: str, timeout: float = 3.0):
    try:
        with request.urlopen(f"{AGENT_URL}{path}", timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (error.URLError, OSError, ValueError, TimeoutError):
        return None


def _post_json(path: str, body: dict, timeout: float = 60.0):
    try:
        payload = json.dumps(body).encode("utf-8")
        req = request.Request(
            f"{AGENT_URL}{path}",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (error.URLError, OSError, ValueError, TimeoutError):
        return None


def _degraded(status: str, warning: str):
    return {
        "agent_id": AGENT_ID,
        "name": AGENT_NAME,
        "status": status,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "last_activity_at": None,
        "source": f"agent GET {AGENT_URL}/health",
        "detail_url": AGENT_URL,
        "kpis": [],
        "warnings": [warning],
        "preview": None,
    }


def _fetch_preview() -> dict | None:
    """Simulate one die + predict so the KPI card can show a live fail-bitmap face."""
    global _preview_idx

    archetype = PREVIEW_ARCHETYPES[_preview_idx % len(PREVIEW_ARCHETYPES)]
    _preview_idx += 1

    sim = _post_json(
        "/api/simulate",
        {"archetype": archetype, "rows": 16, "cols": 32},
        timeout=20.0,
    )
    if not isinstance(sim, dict) or not isinstance(sim.get("bitmap"), list):
        return None

    features = sim.get("extracted_features")
    if not isinstance(features, dict):
        features = {}

    recommendation = None
    confidence = None
    pred = _post_json("/api/predict", {"bitmap": sim["bitmap"]}, timeout=20.0)
    if isinstance(pred, dict):
        recommendation = pred.get("ml_recommendation") or pred.get("final_used_algorithm")
        try:
            confidence = float(pred.get("confidence")) if pred.get("confidence") is not None else None
        except (TypeError, ValueError):
            confidence = None
        if isinstance(pred.get("extracted_features"), dict):
            features = pred["extracted_features"]

    return {
        "archetype": sim.get("archetype") or archetype,
        "rows": int(sim.get("rows") or 16),
        "cols": int(sim.get("cols") or 32),
        "bitmap": sim["bitmap"],
        "features": {
            "rows_above_thresh": float(features.get("rows_above_thresh") or 0),
            "cols_above_thresh": float(features.get("cols_above_thresh") or 0),
            "max_row_frac": float(features.get("max_row_frac") or 0),
            "max_col_frac": float(features.get("max_col_frac") or 0),
            "failing_density": float(features.get("failing_density") or 0),
            "compactness": float(features.get("compactness") or 0),
            "total_fails": float(features.get("total_fails") or 0),
            "bbox_area": float(features.get("bbox_area") or 0),
        },
        "recommendation": recommendation,
        "confidence": confidence,
    }


def _ensure_preview() -> dict | None:
    global _preview, _preview_at
    now = time.time()
    if _preview and (now - _preview_at) < PREVIEW_TTL_SEC:
        return _preview
    fresh = _fetch_preview()
    if fresh is not None:
        _preview = fresh
        _preview_at = now
        return _preview
    return _preview


def _snapshot():
    global _cache, _cache_at

    health = _get_json("/health") or _get_json("/api/")
    if health is None:
        return _degraded("error", f"RA Advisor not reachable at {AGENT_URL}/health.")

    model_trained = bool(health.get("model_trained"))
    if not model_trained:
        return _degraded("idle", "Model is still training on startup.")

    preview = _ensure_preview()

    if _cache and (time.time() - _cache_at) < CACHE_TTL_SEC:
        # Keep KPI numbers cached but refresh the live bitmap face.
        refreshed = dict(_cache)
        refreshed["preview"] = preview
        refreshed["generated_at"] = datetime.now(timezone.utc).isoformat()
        return refreshed

    warnings: list[str] = []
    summary = None
    evaluate = _post_json("/api/evaluate", {"num_dies": 11, "rows": 16, "cols": 32})
    if isinstance(evaluate, dict):
        summary = evaluate.get("session_summary")
    else:
        warnings.append("Could not run evaluate session; showing health-only KPIs.")

    kpis = []
    if isinstance(summary, dict):
        top1 = float(summary.get("top1_accuracy") or 0.0) * 100.0
        kpis = [
            {
                "id": "top1_accuracy",
                "label": "Top-1 Accuracy",
                "value": top1,
                "unit": "%",
                "trend": "up",
                "precision": 1,
            },
            {
                "id": "retest_cycles_avoided",
                "label": "Retest Cycles Avoided",
                "value": float(summary.get("retest_cycles_avoided") or 0),
                "unit": "",
                "trend": "up",
                "precision": 0,
            },
            {
                "id": "time_saved_ms",
                "label": "Time Saved",
                "value": float(summary.get("cumulative_time_saved_ms") or 0.0),
                "unit": "ms",
                "trend": "up",
                "precision": 1,
            },
            {
                "id": "dies_processed",
                "label": "Dies Processed",
                "value": float(summary.get("dies_processed") or 0),
                "unit": "",
                "trend": "flat",
                "precision": 0,
            },
            {
                "id": "feasibility_miss_rate",
                "label": "Feasibility Miss Rate",
                "value": float(summary.get("feasibility_miss_rate") or 0.0) * 100.0,
                "unit": "%",
                "trend": "down",
                "precision": 1,
            },
        ]
        warnings.append(
            "KPIs are from a short synthetic evaluate session on the agent, not live ATE production."
        )
        source = "agent POST /api/evaluate + /api/simulate"
    else:
        archetypes = health.get("supported_archetypes") or []
        kpis = [
            {
                "id": "model_ready",
                "label": "Model Ready",
                "value": 1.0,
                "unit": "",
                "trend": "up",
                "precision": 0,
            },
            {
                "id": "archetypes",
                "label": "Defect Archetypes",
                "value": float(len(archetypes)),
                "unit": "",
                "trend": "flat",
                "precision": 0,
            },
        ]
        source = f"agent GET {AGENT_URL}/health"

    if preview is None:
        warnings.append("Live fail-bitmap preview unavailable from /api/simulate.")

    snap = {
        "agent_id": AGENT_ID,
        "name": AGENT_NAME,
        "status": "running",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "last_activity_at": None,
        "source": source,
        "detail_url": AGENT_URL,
        "kpis": kpis,
        "warnings": warnings,
        "preview": preview,
    }
    _cache = snap
    _cache_at = time.time()
    return snap


@app.get(f"/api/agents/{AGENT_ID}/kpis")
def get_kpis():
    try:
        return _snapshot()
    except Exception as exc:  # noqa: BLE001
        return _degraded("error", f"KPI collection failed: {type(exc).__name__}: {exc}")


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
