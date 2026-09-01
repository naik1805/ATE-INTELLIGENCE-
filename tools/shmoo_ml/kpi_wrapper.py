"""Read-only KPI/status sidecar for the M-BIST Shmoo ML agent.

Runs as a separate process on its own port. It never imports, starts, or
mutates the Shmoo Flask app -- it only reads artifacts the agent already
writes to uploads/ and reports/, and probes the agent's HTTP port for
liveness.

    python kpi_wrapper.py

Env:
    SHMOO_KPI_PORT    port for this sidecar        (default 8801)
    SHMOO_AGENT_URL   base URL of the Shmoo agent  (default http://127.0.0.1:5000)
"""

import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify

AGENT_ID = "shmoo_ml"
AGENT_NAME = "M-BIST Shmoo ML"

ROOT_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = ROOT_DIR / "uploads"
REPORT_DIR = ROOT_DIR / "reports"

PORT = int(os.environ.get("SHMOO_KPI_PORT", "8801"))
AGENT_URL = os.environ.get("SHMOO_AGENT_URL", "http://127.0.0.1:5000").rstrip("/")

# A run counts as "active" if the agent wrote an artifact this recently.
ACTIVE_WINDOW_SEC = 120

app = Flask(__name__)


@app.after_request
def _allow_cors(resp):
    """Hand-rolled so the sidecar has no dependency beyond Flask itself."""
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "*"
    return resp


def _iso(ts):
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def _artifacts():
    """List agent-produced files, ignoring .gitkeep placeholders."""
    uploads, reports, plots = [], [], []
    if UPLOAD_DIR.is_dir():
        for p in UPLOAD_DIR.iterdir():
            if not p.is_file() or p.name == ".gitkeep":
                continue
            (plots if p.name.endswith("_web.png") else uploads).append(p)
    if REPORT_DIR.is_dir():
        reports = [
            p for p in REPORT_DIR.iterdir()
            if p.is_file() and p.name.endswith("_report.pdf")
        ]
    return uploads, reports, plots


def _agent_reachable():
    try:
        req = urllib.request.Request(f"{AGENT_URL}/", method="GET")
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            return 200 <= resp.status < 500
    except (urllib.error.URLError, OSError):
        return False


def _snapshot():
    warnings = []
    uploads, reports, plots = _artifacts()

    if not UPLOAD_DIR.is_dir():
        warnings.append("uploads/ directory is missing; run counts will read as 0.")
    if not REPORT_DIR.is_dir():
        warnings.append("reports/ directory is missing; report counts will read as 0.")

    mtimes = [p.stat().st_mtime for p in uploads + reports + plots]
    last_activity = max(mtimes) if mtimes else None
    age = (time.time() - last_activity) if last_activity else None

    reachable = _agent_reachable()
    if not reachable:
        status = "error"
        warnings.append(f"Shmoo agent not reachable at {AGENT_URL}.")
    elif age is not None and age <= ACTIVE_WINDOW_SEC:
        status = "running"
    else:
        status = "idle"

    if not mtimes:
        warnings.append(
            "No analysis artifacts on disk yet. The agent keeps results in an "
            "in-memory sessions dict, so KPIs stay at 0 until an upload is run."
        )

    total_bytes = sum(p.stat().st_size for p in uploads + reports + plots)

    kpis = [
        {"id": "analysis_runs", "label": "Analysis Runs", "value": len(uploads),
         "unit": "", "trend": "flat", "precision": 0},
        {"id": "reports_generated", "label": "Reports Generated", "value": len(reports),
         "unit": "", "trend": "flat", "precision": 0},
        {"id": "plots_rendered", "label": "Shmoo Plots", "value": len(plots),
         "unit": "", "trend": "flat", "precision": 0},
        {"id": "artifact_size", "label": "Artifact Storage", "value": total_bytes / 1_048_576,
         "unit": "MB", "trend": "flat", "precision": 2},
    ]

    return {
        "agent_id": AGENT_ID,
        "name": AGENT_NAME,
        "status": status,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "last_activity_at": _iso(last_activity),
        "source": "filesystem: uploads/, reports/",
        "detail_url": AGENT_URL,
        "kpis": kpis,
        "warnings": warnings,
    }


@app.get(f"/api/agents/{AGENT_ID}/kpis")
def kpis():
    try:
        return jsonify(_snapshot())
    except Exception as exc:  # noqa: BLE001 - sidecar must never take the agent down
        return jsonify({
            "agent_id": AGENT_ID,
            "name": AGENT_NAME,
            "status": "error",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "last_activity_at": None,
            "source": "filesystem: uploads/, reports/",
            "detail_url": AGENT_URL,
            "kpis": [],
            "warnings": [f"KPI collection failed: {exc}"],
        }), 200


@app.get(f"/api/agents/{AGENT_ID}/status")
def status():
    try:
        return jsonify({"status": _snapshot()["status"]})
    except Exception:  # noqa: BLE001
        return jsonify({"status": "error"}), 200


if __name__ == "__main__":
    print(f"[{AGENT_ID}] KPI wrapper on http://127.0.0.1:{PORT} (agent: {AGENT_URL})")
    app.run(host="127.0.0.1", port=PORT, debug=False)
