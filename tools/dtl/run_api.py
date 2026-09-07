"""Launch DTL FastAPI on port 8010 (desktop / run_all.py).

Embeddable Python on Windows often ignores PYTHONPATH; this script puts
``tools/dtl/src`` on sys.path before uvicorn loads the app factory.
"""
from __future__ import annotations

import os
import sys

_SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("API_HOST", "127.0.0.1")
    port = int(os.environ.get("API_PORT", "8010"))
    uvicorn.run(
        "dtl_agent.api.app:create_app",
        factory=True,
        host=host,
        port=port,
        log_level=os.environ.get("LOG_LEVEL", "info").lower(),
    )
