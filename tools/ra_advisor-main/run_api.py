"""Launch RA Advisor FastAPI (API + SPA) on a fixed desktop port.

    python run_api.py

Env:
    API_HOST  (default 127.0.0.1)
    API_PORT  (default 8030)
"""
from __future__ import annotations

import os
import sys

_ROOT = os.path.dirname(os.path.abspath(__file__))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("RA_ADVISOR_HOST") or os.environ.get("API_HOST") or "127.0.0.1"
    # Do not reuse generic API_PORT — DTL also uses that env var (8010).
    port = int(os.environ.get("RA_ADVISOR_PORT") or "8030")
    uvicorn.run(
        "api.main:app",
        host=host,
        port=port,
        log_level=os.environ.get("LOG_LEVEL", "info").lower(),
    )
