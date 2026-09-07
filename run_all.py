"""Launch the whole integrated suite on a conflict-free port map.

Every port below is applied from the OUTSIDE -- via CLI flags or env vars --
so no agent source file needs to change. Two collisions are resolved here:

  * DTL's API and the retest agent's API both default to 8000. DTL is moved
    to 8010 and retest to 8020.
  * RA Advisor (api + SPA) runs on 8030; its KPI wrapper is on 8805.
  * Port 8000 is deliberately left free, because the dashboard expects its
    own wafer-yield backend there (that backend is not part of this repo).
  * DTL's frontend and test_time_opt's frontend both default to Vite 5173.
    DTL's is moved to 5174, matching what run_suite.py already did.

The retest agent's FastAPI hardcodes 127.0.0.1:8000, but only inside its
`if __name__ == "__main__"` block -- launching it through the uvicorn CLI
bypasses that entirely without editing the file.

    python run_all.py              # everything
    python run_all.py --wrappers   # KPI sidecars + dashboard only
"""

import os
import shutil
import signal
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime

ROOT = os.path.dirname(os.path.abspath(__file__))

DASHBOARD_URL = "http://127.0.0.1:3000"

DESKTOP_ENV = {
    "OFFLINE_DESKTOP": "1",
    "NEXT_PUBLIC_OFFLINE_DESKTOP": "1",
    "NEXT_PUBLIC_DEFAULT_DATA_URL": "http://127.0.0.1:3000/api/default-data",
    "API_PROXY_TARGET": "http://127.0.0.1:8810",
    # Packaged desktop: avoid multiprocessing worker crashes on Windows.
    "OMP_NUM_THREADS": "1",
    "MKL_NUM_THREADS": "1",
    "OPENBLAS_NUM_THREADS": "1",
    "LOKY_MAX_CPU_COUNT": "1",
    "JOBLIB_MULTIPROCESSING": "0",
}

DESKTOP_PORTS = (
    3000, 3011, 5000, 5173, 5174, 5175, 8010, 8020, 8030, 8787,
    8801, 8802, 8803, 8804, 8805, 8810, 8501,
)


def resolve_python():
    """Prefer a Python that can actually import agent deps.

    Bundled embeddable Python is used only when fastapi/pandas/uvicorn import.
    Broken copies (no pip/site-packages) are skipped so the suite does not hang.
    """
    def _runs(path: str) -> bool:
        try:
            r = subprocess.run(
                [path, "-c", "import sys; print(sys.executable)"],
                capture_output=True,
                timeout=20,
                check=False,
            )
            if r.returncode != 0:
                return False
            combined = ((r.stderr or b"") + (r.stdout or b"")).decode("utf-8", errors="replace").lower()
            return "did not find executable" not in combined
        except Exception:
            return False

    def _has_agent_deps(path: str) -> bool:
        if not _runs(path):
            return False
        try:
            r = subprocess.run(
                [path, "-c", "import fastapi, uvicorn, pandas"],
                capture_output=True,
                timeout=30,
                check=False,
            )
            return r.returncode == 0
        except Exception:
            return False

    embed = os.path.join(ROOT, ".portable", "python", "python.exe")
    venv = os.path.join(ROOT, ".portable", "venv", "Scripts", "python.exe")
    from_env = (os.environ.get("ATE_PYTHON") or "").strip()
    desktop_embed = os.path.join(
        os.environ.get("LOCALAPPDATA") or "",
        "Programs", "ATE Intelligence", "resources", "app",
        ".portable", "python", "python.exe",
    )
    d_drive_embed = r"D:\New folder\New folder\ATE Intelligence\resources\app\.portable\python\python.exe"

    if os.path.isfile(venv) and not _runs(venv):
        try:
            shutil.rmtree(os.path.join(ROOT, ".portable", "venv"), ignore_errors=True)
        except Exception:
            pass

    candidates = [from_env, d_drive_embed, desktop_embed, embed, venv, sys.executable]
    for path in candidates:
        if path and os.path.isfile(path) and _has_agent_deps(path):
            return path

    for path in (embed, venv, sys.executable):
        if path and os.path.isfile(path) and _runs(path):
            return path
    return sys.executable


def verify_agent_python(py) -> bool:
    """Confirm bundled Python can import everything the agents need."""
    dtl_src = os.path.join(ROOT, "tools", "dtl", "src")
    env = {**os.environ, **portable_path_env()}
    try:
        r = subprocess.run(
            [
                py,
                "-c",
                "import sys; "
                f"sys.path.insert(0, {dtl_src!r}); "
                "import pandas, uvicorn, fastapi, torch; "
                "import dtl_agent.api.app; print('ok')",
            ],
            capture_output=True,
            timeout=90,
            check=False,
            env=env,
            cwd=ROOT,
        )
        return r.returncode == 0
    except Exception:
        return False


def wait_for_url(url, timeout=90):
    import urllib.error
    import urllib.request

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as resp:
                if 200 <= resp.status < 500:
                    return True
        except (urllib.error.URLError, OSError, ValueError):
            pass
        time.sleep(2)
    return False


def start_dtl_api(py, base_env, quiet):
    """Launch (or relaunch) the DTL API on port 8010."""
    entry = None
    for item in build_agents(py):
        if item[0].startswith("dtl api"):
            entry = item
            break
    if entry:
        launch([entry], base_env, quiet=quiet, log_labels=("dashboard", "default", "dtl", "shmoo"))


def portable_path_env():
    """Ensure bundled Node/npm are on PATH for child processes."""
    env = {}
    node_dir = os.path.join(ROOT, ".portable", "node")
    if os.path.isdir(node_dir):
        env["PATH"] = node_dir + os.pathsep + os.environ.get("PATH", "")
    return env


def build_agents(py):
    return [
        ("dtl api             :8010", "tools/dtl",
         [py, "run_api.py"],
         {
             "API_HOST": "127.0.0.1",
             "API_PORT": "8010",
             "CORS_ALLOWED_ORIGINS": (
                 "http://127.0.0.1:5174,http://localhost:5174,"
                 "http://127.0.0.1:3000,http://localhost:3000"
             ),
         }, False),
        ("dtl ui              :5174", "tools/dtl/frontend",
         ["npm", "run", "dev", "--", "--port", "5174"], {}, True),
        ("shmoo_ml api        :5000", "tools/shmoo_ml",
         [py, "run.py"], {}, False),
        ("test_time_opt api   :8787", "tools/test_time_opt",
         ["npm", "run", "server"], {
             "PORT": "8787",
             "PYTHON": py,
             "ATE_PYTHON": py,
             "TTO_DEFAULT_STIL": os.path.join(
                 ROOT, "data", "test_time_opt", "Production_SCAN_stuck_at_1000pat.stil",
             ),
         }, True),
        ("test_time_opt ui    :5173", "tools/test_time_opt/client",
         ["npm", "run", "dev", "--", "--port", "5173"], {}, True),
        ("retest api          :8020", "tools/retest_reduction",
         [py, "-m", "uvicorn", "retest_ai.api.main:app",
          "--host", "127.0.0.1", "--port", "8020"], {}, False),
        ("retest bridge       :3011", "tools/retest_reduction/server",
         ["npm", "start"], {"PORT": "3011", "FASTAPI_BASE": "http://127.0.0.1:8020"}, True),
        ("retest ui           :5175", "tools/retest_reduction/frontend",
         ["npm", "run", "dev", "--", "--port", "5175"], {}, True),
        ("retest streamlit    :8501", "tools/retest_reduction",
         [py, "-m", "streamlit", "run", "retest_ai/app.py",
          "--server.port", "8501", "--server.headless", "true"], {}, False),
        ("ra_advisor api/ui   :8030", "tools/ra_advisor-main",
         [py, "run_api.py"],
         {"RA_ADVISOR_HOST": "127.0.0.1", "RA_ADVISOR_PORT": "8030"}, False),
    ]


def build_wrappers(py):
    return [
        ("shmoo_ml kpi        :8801", "tools/shmoo_ml",
         [py, "kpi_wrapper.py"], {}, False),
        ("test_time_opt kpi   :8802", "tools/test_time_opt",
         ["node", "server/kpi_wrapper.js"], {}, True),
        ("dtl kpi             :8803", "tools/dtl",
         [py, "-m", "uvicorn", "kpi_wrapper:app", "--host", "127.0.0.1", "--port", "8803"],
         {"DTL_AGENT_URL": "http://127.0.0.1:8010"}, False),
        ("retest kpi          :8804", "tools/retest_reduction",
         [py, "-m", "uvicorn", "kpi_wrapper:app", "--host", "127.0.0.1", "--port", "8804"],
         {}, False),
        ("ra_advisor kpi      :8805", "tools/ra_advisor-main",
         [py, "-m", "uvicorn", "kpi_wrapper:app", "--host", "127.0.0.1", "--port", "8805"],
         {"RA_ADVISOR_AGENT_URL": "http://127.0.0.1:8030"}, False),
    ]


DASHBOARD_DEV = [
    ("dashboard           :3000", "tools/ate_frontend",
     ["npm", "run", "dev"], {}, True),
]

DASHBOARD_PROD = [
    ("dashboard           :3000", "tools/ate_frontend",
     ["npm", "run", "start"], {}, True),
]

processes = []
_startup_log = None


def startup_log_path():
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or ROOT
        return os.path.join(base, "ATE Intelligence", "startup.log")
    return os.path.join(ROOT, ".portable", "startup.log")


def log_startup(message):
    global _startup_log
    line = f"[{datetime.now().isoformat(timespec='seconds')}] {message}"
    print(line)
    if _startup_log is None:
        path = startup_log_path()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        _startup_log = open(path, "a", encoding="utf-8")
    _startup_log.write(line + "\n")
    _startup_log.flush()


def cleanup(sig=None, frame=None):
    print("\nShutting down...")
    for p in processes:
        try:
            p.terminate()
        except Exception:
            pass
    sys.exit(0)


signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)


def ensure_dtl_python_deps(py):
    """DTL needs PyTorch CPU; install once if missing."""
    if verify_agent_python(py):
        return
    try:
        probe = subprocess.run(
            [py, "-c", "import torch"],
            capture_output=True,
            timeout=30,
            check=False,
        )
        if probe.returncode != 0:
            log_startup("Installing PyTorch (CPU) for Dynamic Test Limits - one-time, ~2-3 min...")
            subprocess.run(
                [
                    py, "-m", "pip", "install", "torch",
                    "--index-url", "https://download.pytorch.org/whl/cpu",
                    "--no-warn-script-location",
                ],
                cwd=ROOT,
                env={**os.environ, **portable_path_env()},
                check=False,
                timeout=600,
            )
    except Exception as exc:
        log_startup(f"[warn] PyTorch install failed: {exc}")
    if not verify_agent_python(py):
        log_startup("[warn] DTL Python deps incomplete - run Repair Python.bat from update folder")


def ensure_core_apis_ready():
    """Wait for agent APIs the dashboard iframes need (best-effort)."""
    checks = (
        ("shmoo", "http://127.0.0.1:5000/"),
        ("tto", "http://127.0.0.1:8787/api/health"),
        ("dtl", "http://127.0.0.1:8010/api/v1/health"),
        ("retest", "http://127.0.0.1:8020/docs"),
        ("ra_advisor", "http://127.0.0.1:8030/health"),
        ("tto ui", "http://127.0.0.1:5173/"),
        ("dtl ui", "http://127.0.0.1:5174/"),
    )
    for label, url in checks:
        if wait_for_url(url, timeout=45):
            log_startup(f"[ok] {label} ready")
        else:
            log_startup(f"[warn] {label} not ready yet (will keep retrying in UI)")


def ensure_dtl_api_ready(py, base_env, quiet):
    """Wait for DTL API; restart once if port 8010 never came up."""
    url = "http://127.0.0.1:8010/api/v1/health"
    if wait_for_url(url, timeout=90):
        log_startup("[ok] dtl api :8010 ready")
        return True
    log_startup("[warn] dtl api :8010 not responding - restarting...")
    start_dtl_api(py, base_env, quiet)
    run_dtl_bootstrap(py, base_env)
    if wait_for_url(url, timeout=120):
        log_startup("[ok] dtl api :8010 ready after restart")
        return True
    log_startup("[warn] dtl api :8010 still down - run Repair Python.bat then restart app")
    return False


def ensure_dtl_ui_ready(timeout=120):
    """Wait for DTL Vite UI on :5174 (dashboard iframe target)."""
    for url in ("http://127.0.0.1:5174/", "http://localhost:5174/"):
        if wait_for_url(url, timeout=timeout):
            log_startup(f"[ok] dtl ui :5174 ready ({url})")
            return True
    log_startup("[warn] dtl ui :5174 not responding - wait 2-3 min then reopen DTL agent")
    return False


def ensure_dtl_stack_ready(py, base_env, quiet):
    """Confirm DTL API and UI are both accepting connections."""
    api_ok = ensure_dtl_api_ready(py, base_env, quiet)
    ui_ok = ensure_dtl_ui_ready(timeout=120 if api_ok else 60)
    return api_ok and ui_ok


def run_dtl_bootstrap(py, extra_env=None):
    """Create DTL readiness artifacts before the API process starts."""
    cwd = os.path.join(ROOT, "tools", "dtl")
    if not os.path.isdir(cwd):
        log_startup("[skip] dtl bootstrap (tools/dtl not found)")
        return
    env = {
        **os.environ,
        **(extra_env or {}),
        **portable_path_env(),
        "PYTHONPATH": os.path.join(ROOT, "tools", "dtl", "src"),
    }
    log_startup("[once] dtl bootstrap")
    try:
        subprocess.run(
            [py, "integration/bootstrap_readiness.py"],
            cwd=cwd,
            env=env,
            check=False,
        )
    except Exception as exc:
        log_startup(f"[warn] dtl bootstrap: {exc}")


def cleanup_stale_ports(ports=DESKTOP_PORTS):
    """Free desktop ports left by a crashed or partial previous launch."""
    if os.name != "nt":
        return
    log_startup("Checking for stale port listeners...")
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True,
            text=True,
            errors="replace",
            check=False,
        )
        own_pid = os.getpid()
        pids: set[int] = set()
        for line in result.stdout.splitlines():
            if "LISTENING" not in line:
                continue
            for port in ports:
                needle = f":{port} "
                if needle not in line and f":{port}\t" not in line:
                    continue
                parts = line.split()
                if not parts:
                    continue
                pid_raw = parts[-1]
                if pid_raw.isdigit():
                    pid = int(pid_raw)
                    if pid != own_pid:
                        pids.add(pid)
        for pid in sorted(pids):
            log_startup(f"[cleanup] stopping stale PID {pid}")
            subprocess.run(
                ["taskkill", "/PID", str(pid), "/F", "/T"],
                capture_output=True,
                check=False,
            )
    except Exception as exc:
        log_startup(f"[warn] port cleanup: {exc}")


def launch(entries, extra_env=None, *, quiet=False, log_labels=None):
    merged_extra = {**(extra_env or {}), **portable_path_env()}
    log_labels = log_labels or ("dashboard", "default", "dtl", "shmoo")
    log_handle = _log_handle()
    for label, rel_cwd, cmd, entry_env, shell in entries:
        if cmd is None:
            continue
        cwd = os.path.join(ROOT, *rel_cwd.split("/"))
        if not os.path.isdir(cwd):
            log_startup(f"[skip] {label} ({rel_cwd} not found)")
            continue
        env = {**os.environ, **merged_extra, **entry_env}
        try:
            kwargs = {
                "cwd": cwd,
                "env": env,
                "shell": shell,
            }
            label_key = label.split()[0]
            if quiet and label_key not in log_labels:
                kwargs["stdout"] = subprocess.DEVNULL
                kwargs["stderr"] = subprocess.DEVNULL
            else:
                kwargs["stdout"] = log_handle
                kwargs["stderr"] = subprocess.STDOUT
            processes.append(subprocess.Popen(cmd, **kwargs))
            log_startup(f"[start] {label}")
        except Exception as e:
            log_startup(f"[fail] {label}: {e}")


def _log_handle():
    global _startup_log
    if _startup_log is None:
        path = startup_log_path()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        _startup_log = open(path, "a", encoding="utf-8")
    return _startup_log


def ensure_desktop_frontend_env():
    """Keep .env.local aligned with env.portable for offline desktop launches."""
    portable = os.path.join(ROOT, "tools", "ate_frontend", "env.portable")
    env_local = os.path.join(ROOT, "tools", "ate_frontend", ".env.local")
    if os.path.isfile(portable):
        shutil.copy2(portable, env_local)


def main():
    wrappers_only = "--wrappers" in sys.argv
    no_browser = "--no-browser" in sys.argv
    desktop_mode = "--desktop" in sys.argv
    production = "--production" in sys.argv
    py = resolve_python()
    if desktop_mode:
        ensure_desktop_frontend_env()
    base_env = {**(DESKTOP_ENV if desktop_mode else {}), **portable_path_env()}

    integration = [
        ("default data        :8810", ".",
         [py, "integration/default_data_server.py"], {}, False),
    ]
    dashboard = DASHBOARD_PROD if production else DASHBOARD_DEV
    agents = build_agents(py)
    wrappers = build_wrappers(py)

    log_startup("=" * 64)
    log_startup("VERILUMEN INTEGRATED DASHBOARD SUITE")
    if desktop_mode:
        log_startup("(offline desktop mode — local services only)")
    if production:
        log_startup("(production / installed build)")
    log_startup(f"ROOT={ROOT}")
    log_startup(f"PYTHON={py}")

    quiet = production and desktop_mode

    if desktop_mode and production and not wrappers_only:
        cleanup_stale_ports()

    if production and desktop_mode and not wrappers_only:
        log_startup("Priority startup: dashboard + integration + wrappers first")
        launch(dashboard, base_env, quiet=quiet)
        launch(integration, base_env, quiet=quiet)
        launch(wrappers, base_env, quiet=quiet)
        time.sleep(10)
        log_startup("Starting agents")
        run_dtl_bootstrap(py, base_env)
        ensure_dtl_python_deps(py)
        launch(agents, base_env, quiet=quiet)
        ensure_dtl_stack_ready(py, base_env, quiet)
        ensure_core_apis_ready()
    else:
        if not wrappers_only:
            log_startup("Agents:")
            run_dtl_bootstrap(py, base_env)
            ensure_dtl_python_deps(py)
            launch(agents, base_env, quiet=quiet)
            ensure_dtl_stack_ready(py, base_env, quiet)
            ensure_core_apis_ready()

        log_startup("KPI wrappers:")
        launch(wrappers, base_env, quiet=quiet)

        log_startup("Integration:")
        launch(integration, base_env, quiet=quiet)

        log_startup("Dashboard:")
        launch(dashboard, base_env, quiet=quiet)

    warmup = 90 if (desktop_mode and production) else (20 if desktop_mode else 12)
    log_startup(f"Warming up ({warmup}s)...")
    time.sleep(warmup)

    def _seed_default_data():
        time.sleep(20)
        log_startup("Seeding default agent data (background)...")
        try:
            subprocess.run(
                [py, os.path.join(ROOT, "integration", "load_default_data.py")],
                cwd=ROOT,
                env={**os.environ, **base_env},
                check=False,
            )
            log_startup("Default agent data seeding finished")
        except Exception as exc:
            log_startup(f"[warn] default data seed skipped: {exc}")

    if desktop_mode and not wrappers_only:
        threading.Thread(target=_seed_default_data, daemon=True).start()
    else:
        log_startup("Seeding default agent data...")
        try:
            subprocess.run(
                [py, os.path.join(ROOT, "integration", "load_default_data.py")],
                cwd=ROOT,
                env={**os.environ, **base_env},
                check=False,
            )
        except Exception as exc:
            log_startup(f"[warn] default data seed skipped: {exc}")

    log_startup(f"Main dashboard -> {DASHBOARD_URL}")
    if not no_browser:
        webbrowser.open(DASHBOARD_URL)

    print("\nRunning. Press Ctrl+C to stop everything.")
    while True:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            cleanup()


if __name__ == "__main__":
    main()
