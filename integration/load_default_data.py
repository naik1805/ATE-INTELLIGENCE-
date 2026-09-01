"""Pre-seed agent backends from files in data/<agent_id>/.

Run after agents are up (called from run_all.py or manually):

    python integration/load_default_data.py
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from paths import DATA_DIR, STATE_DIR, AGENT_IDS  # noqa: E402

SHMOO_URL = "http://127.0.0.1:5000/api/upload"
SHMOO_KEY = "vannakam-da-mapla"
DTL_URL = "http://127.0.0.1:8010/api/v1/analysis/upload"
DTL_STATUS_URL = "http://127.0.0.1:8010/api/v1/analysis/upload/status/{sid}"
RETEST_URL = "http://127.0.0.1:8020/analysis/upload-pre-retest"


def _save_state(agent_id: str, payload: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    out = STATE_DIR / f"{agent_id}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"  [state] {agent_id} -> {out.name}")


def _multipart(fields: dict, files: dict) -> tuple[bytes, str]:
    boundary = "----VerilumenDefaultData7MA4YWxk"
    lines: list[bytes] = []

    for name, value in fields.items():
        lines.append(f"--{boundary}\r\n".encode())
        lines.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        lines.append(f"{value}\r\n".encode())

    for name, (filename, content, content_type) in files.items():
        lines.append(f"--{boundary}\r\n".encode())
        lines.append(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
        )
        lines.append(f"Content-Type: {content_type}\r\n\r\n".encode())
        lines.append(content)
        lines.append(b"\r\n")

    lines.append(f"--{boundary}--\r\n".encode())
    body = b"".join(lines)
    return body, f"multipart/form-data; boundary={boundary}"


def _post_multipart(url: str, fields: dict, files: dict, headers: dict | None = None) -> dict:
    body, content_type = _multipart(fields, files)
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": content_type, "Accept": "application/json", **(headers or {})},
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _pick_file(folder: Path, patterns: tuple[str, ...]) -> Path | None:
    if not folder.is_dir():
        return None
    for path in sorted(folder.iterdir()):
        if not path.is_file():
            continue
        name = path.name.lower()
        if any(p in name for p in patterns):
            return path
    return None


def _first_data_file(folder: Path, suffixes: tuple[str, ...]) -> Path | None:
    if not folder.is_dir():
        return None
    for path in sorted(folder.iterdir()):
        if path.is_file() and path.suffix.lower() in suffixes:
            return path
    return None


def load_shmoo_ml() -> bool:
    folder = DATA_DIR / "shmoo_ml"
    data_file = _first_data_file(folder, (".csv", ".xlsx", ".xls"))
    if not data_file:
        print("  [skip] shmoo_ml — no CSV/XLSX in data/shmoo_ml/")
        return False
    try:
        content = data_file.read_bytes()
        ctype = (
            "text/csv"
            if data_file.suffix.lower() == ".csv"
            else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        result = _post_multipart(
            SHMOO_URL,
            {},
            {"file": (data_file.name, content, ctype)},
            headers={"X-API-Key": SHMOO_KEY},
        )
        _save_state("shmoo_ml", {"upload_response": result, "source_file": data_file.name})
        print(f"  [ok] shmoo_ml — uploaded {data_file.name}")
        return True
    except (urllib.error.URLError, OSError, ValueError) as exc:
        print(f"  [fail] shmoo_ml — {exc}")
        return False


def _poll_dtl_session(session_id: str, timeout_s: int = 180) -> dict | None:
    deadline = time.time() + timeout_s
    url = DTL_STATUS_URL.format(sid=session_id)
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=10) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, OSError, ValueError):
            time.sleep(2)
            continue
        status = payload.get("status")
        if status == "completed":
            return payload
        if status == "failed":
            raise RuntimeError(payload.get("error") or "DTL upload job failed")
        time.sleep(2)
    raise TimeoutError(f"DTL session {session_id} did not complete in {timeout_s}s")


def _content_type(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".zip":
        return "application/zip"
    if ext == ".csv":
        return "text/csv"
    return "application/octet-stream"


def _pick_month_file(folder: Path, month_patterns: tuple[str, ...]) -> Path | None:
    if not folder.is_dir():
        return None
    for path in sorted(folder.iterdir()):
        if not path.is_file() or path.name.startswith("."):
            continue
        name = path.name.lower()
        if path.suffix.lower() not in (".csv", ".zip"):
            continue
        if any(p in name for p in month_patterns):
            return path
    return None


def load_dtl() -> bool:
    folder = DATA_DIR / "dtl"
    jan = _pick_month_file(folder, ("january", "2026-01", "2026_01", "dtl_input_2026_01", "_01"))
    feb = _pick_month_file(folder, ("february", "2026-02", "2026_02", "dtl_input_2026_02", "_02"))
    mar = _pick_month_file(folder, ("march", "2026-03", "2026_03", "dtl_input_2026_03", "_03"))
    if not (jan and feb and mar):
        print("  [skip] dtl — need Jan/Feb/Mar CSV or ZIP files in data/dtl/")
        return False
    try:
        files = {
            "january": (jan.name, jan.read_bytes(), _content_type(jan)),
            "february": (feb.name, feb.read_bytes(), _content_type(feb)),
            "march": (mar.name, mar.read_bytes(), _content_type(mar)),
        }
        queued = _post_multipart(DTL_URL, {}, files)
        session_id = queued.get("analysis_session_id")
        if not session_id:
            raise RuntimeError("DTL upload did not return analysis_session_id")
        completed = _poll_dtl_session(session_id)
        _save_state(
            "dtl",
            {
                "analysis_session_id": session_id,
                "upload_result": completed,
                "source_files": {"january": jan.name, "february": feb.name, "march": mar.name},
            },
        )
        print(f"  [ok] dtl — analyzed {jan.name}, {feb.name}, {mar.name}")
        return True
    except (urllib.error.URLError, OSError, ValueError, RuntimeError, TimeoutError) as exc:
        print(f"  [fail] dtl — {exc}")
        return False


def _pick_pre_retest_file(folder: Path) -> Path | None:
    if not folder.is_dir():
        return None
    for path in sorted(folder.iterdir()):
        if not path.is_file() or path.suffix.lower() not in (".xlsx", ".xls"):
            continue
        if _is_pre_retest_name(path.name) or "upload" in path.name.lower():
            return path
    return _first_data_file(folder, (".xlsx", ".xls"))


def _is_pre_retest_name(name: str) -> bool:
    lowered = name.lower()
    return "pre_retest" in lowered or "pre-retest" in lowered


def _is_outcomes_name(name: str) -> bool:
    lowered = name.lower()
    if _is_pre_retest_name(lowered):
        return False
    return any(
        key in lowered
        for key in ("outcome", "post_retest", "private_validation", "validation_only", "validation")
    )


def _pick_outcomes_file(folder: Path) -> Path | None:
    if not folder.is_dir():
        return None
    for path in sorted(folder.iterdir()):
        if path.is_file() and path.suffix.lower() in (".xlsx", ".xls") and _is_outcomes_name(path.name):
            return path
    for name in ("outcomes.xlsx", "Month_12_PRIVATE_VALIDATION_ONLY.xlsx"):
        candidate = folder / name
        if candidate.is_file():
            return candidate
    return None


def load_retest_reduction() -> bool:
    folder = DATA_DIR / "retest_reduction"
    data_file = _pick_pre_retest_file(folder)
    if not data_file:
        print("  [skip] retest_reduction — no pre-retest XLSX in data/retest_reduction/")
        return False
    outcomes_file = _pick_outcomes_file(folder)
    try:
        content = data_file.read_bytes()
        result = _post_multipart(
            RETEST_URL,
            {"cost_per_hour": "350"},
            {
                "file": (
                    data_file.name,
                    content,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        state = {
            "records": result.get("records") or [],
            "cost_impact": result.get("cost_impact"),
            "source_file": data_file.name,
            "outcomes_available": outcomes_file is not None,
        }
        if outcomes_file:
            state["outcomes_file"] = outcomes_file.name
        _save_state("retest_reduction", state)
        extra = f" + outcomes {outcomes_file.name}" if outcomes_file else ""
        print(f"  [ok] retest_reduction — uploaded {data_file.name}{extra}")
        return True
    except (urllib.error.URLError, OSError, ValueError) as exc:
        print(f"  [fail] retest_reduction — {exc}")
        return False


def load_test_time_opt() -> bool:
    folder = DATA_DIR / "test_time_opt"
    files = _list_files(folder)
    if not files:
        print("  [skip] test_time_opt — no files in data/test_time_opt/")
        return False
    _save_state("test_time_opt", {"files": files, "ready": True})
    print(f"  [ok] test_time_opt — {len(files)} file(s) ready for browser autoload")
    return True


def _list_files(folder: Path) -> list[dict]:
    if not folder.is_dir():
        return []
    out: list[dict] = []
    for path in sorted(folder.rglob("*")):
        if path.is_file() and not path.name.startswith("."):
            rel = path.relative_to(folder).as_posix()
            out.append({"name": rel, "size": path.stat().st_size, "suffix": path.suffix.lower()})
    return out


def main() -> int:
    print("Loading default agent data from", DATA_DIR)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    results = {
        "shmoo_ml": load_shmoo_ml(),
        "test_time_opt": load_test_time_opt(),
        "dtl": load_dtl(),
        "retest_reduction": load_retest_reduction(),
    }
    ok = sum(1 for v in results.values() if v)
    print(f"Done — {ok}/{len(AGENT_IDS)} agents seeded.")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
