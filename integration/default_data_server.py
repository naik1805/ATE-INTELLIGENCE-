"""Serve default agent datasets and bootstrap state for dashboard autoload.

    python integration/default_data_server.py

Env:
    DEFAULT_DATA_PORT   port for this server (default 8810)
"""

from __future__ import annotations

import json
import mimetypes
import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from paths import AGENT_IDS, DATA_DIR, STATE_DIR  # noqa: E402

PORT = int(os.environ.get("DEFAULT_DATA_PORT", "8810"))

app = FastAPI(title="Default Agent Data", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _agent_dir(agent_id: str) -> Path:
    if agent_id not in AGENT_IDS:
        raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_id}")
    return DATA_DIR / agent_id


def _list_agent_files(agent_id: str) -> list[dict]:
    folder = _agent_dir(agent_id)
    if not folder.is_dir():
        return []
    out: list[dict] = []
    for path in sorted(folder.rglob("*")):
        if not path.is_file() or path.name.startswith("."):
            continue
        rel = path.relative_to(folder).as_posix()
        out.append(
            {
                "name": rel,
                "size": path.stat().st_size,
                "suffix": path.suffix.lower(),
            }
        )
    return out


def _read_state(agent_id: str) -> dict | None:
    state_file = STATE_DIR / f"{agent_id}.json"
    if not state_file.is_file():
        return None
    try:
        return json.loads(state_file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


@app.get("/health")
def health():
    return {"status": "ok", "data_dir": str(DATA_DIR)}


@app.get("/agents/{agent_id}/files")
def list_files(agent_id: str):
    return {"agent_id": agent_id, "files": _list_agent_files(agent_id)}


@app.get("/agents/{agent_id}/files/{file_path:path}")
def get_file(agent_id: str, file_path: str):
    folder = _agent_dir(agent_id)
    target = (folder / file_path).resolve()
    if not str(target).startswith(str(folder.resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    media_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    return FileResponse(target, media_type=media_type, filename=target.name)


@app.get("/agents/{agent_id}/bootstrap")
def bootstrap(agent_id: str):
    state = _read_state(agent_id) or {}
    files = _list_agent_files(agent_id)
    return {
        "agent_id": agent_id,
        "files": files,
        **state,
    }


if __name__ == "__main__":
    import uvicorn

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[default-data] serving {DATA_DIR} on http://127.0.0.1:{PORT}")
    uvicorn.run(app, host="127.0.0.1", port=PORT)
