"""Launch the whole integrated suite on a conflict-free port map.

Every port below is applied from the OUTSIDE -- via CLI flags or env vars --
so no agent source file needs to change. Two collisions are resolved here:

  * DTL's API and the retest agent's API both default to 8000. DTL is moved
    to 8010 and retest to 8020.
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
import signal
import subprocess
import sys
import time
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable

DASHBOARD_URL = "http://127.0.0.1:3000"

# name, cwd (relative to repo root), command, extra env, shell
AGENTS = [
    ("shmoo_ml api        :5000", "tools/shmoo_ml",
     [PY, "run.py"], {}, False),
    ("test_time_opt api   :8787", "tools/test_time_opt",
     ["npm", "run", "server"], {
         "PORT": "8787",
         "TTO_DEFAULT_STIL": os.path.join(
             ROOT, "data", "test_time_opt", "Production_SCAN_stuck_at_1000pat.stil",
         ),
     }, True),
    ("test_time_opt ui    :5173", "tools/test_time_opt/client",
     ["npm", "run", "dev", "--", "--port", "5173"], {}, True),
    ("dtl bootstrap       (once)", "tools/dtl",
     [PY, "integration/bootstrap_readiness.py"],
     {"PYTHONPATH": os.path.join(ROOT, "tools", "dtl", "src")}, False),
    ("dtl api             :8010", "tools/dtl",
     [PY, "-m", "uvicorn", "dtl_agent.api.app:create_app", "--factory",
      "--host", "127.0.0.1", "--port", "8010"],
     {"PYTHONPATH": os.path.join(ROOT, "tools", "dtl", "src")}, False),
    ("dtl ui              :5174", "tools/dtl/frontend",
     ["npm", "run", "dev", "--", "--port", "5174"], {}, True),
    ("retest api          :8020", "tools/retest_reduction",
     [PY, "-m", "uvicorn", "retest_ai.api.main:app",
      "--host", "127.0.0.1", "--port", "8020"], {}, False),
    ("retest bridge       :3011", "tools/retest_reduction/server",
     ["npm", "start"], {"PORT": "3011", "FASTAPI_BASE": "http://127.0.0.1:8020"}, True),
    ("retest ui           :5175", "tools/retest_reduction/frontend",
     ["npm", "run", "dev", "--", "--port", "5175"], {}, True),
    ("retest streamlit    :8501", "tools/retest_reduction",
     [PY, "-m", "streamlit", "run", "retest_ai/app.py",
      "--server.port", "8501", "--server.headless", "true"], {}, False),
]

WRAPPERS = [
    ("shmoo_ml kpi        :8801", "tools/shmoo_ml",
     [PY, "kpi_wrapper.py"], {}, False),
    ("test_time_opt kpi   :8802", "tools/test_time_opt",
     ["node", "server/kpi_wrapper.js"], {}, True),
    ("dtl kpi             :8803", "tools/dtl",
     [PY, "-m", "uvicorn", "kpi_wrapper:app", "--host", "127.0.0.1", "--port", "8803"],
     {"DTL_AGENT_URL": "http://127.0.0.1:8010"}, False),
    ("retest kpi          :8804", "tools/retest_reduction",
     [PY, "-m", "uvicorn", "kpi_wrapper:app", "--host", "127.0.0.1", "--port", "8804"],
     {}, False),
]

INTEGRATION = [
    ("default data        :8810", ".",
     [PY, "integration/default_data_server.py"], {}, False),
]

DASHBOARD = [
    ("dashboard           :3000", "tools/ate_frontend",
     ["npm", "run", "dev"], {}, True),
]

processes = []


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


def launch(entries):
    for label, rel_cwd, cmd, extra_env, shell in entries:
        cwd = os.path.join(ROOT, *rel_cwd.split("/"))
        if not os.path.isdir(cwd):
            print(f"  [skip] {label}  ({rel_cwd} not found)")
            continue
        env = {**os.environ, **extra_env}
        try:
            processes.append(
                subprocess.Popen(
                    cmd, cwd=cwd, env=env, shell=shell,
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                )
            )
            print(f"  [start] {label}")
        except Exception as e:
            print(f"  [fail]  {label}: {e}")


def main():
    wrappers_only = "--wrappers" in sys.argv

    print("=" * 64)
    print("        VERILUMEN INTEGRATED DASHBOARD SUITE")
    print("=" * 64)

    if not wrappers_only:
        print("\nAgents:")
        launch(AGENTS)

    print("\nKPI wrappers:")
    launch(WRAPPERS)

    print("\nIntegration:")
    launch(INTEGRATION)

    print("\nDashboard:")
    launch(DASHBOARD)

    print("\nWarming up (12s)...")
    time.sleep(12)

    print("\nSeeding default agent data...")
    try:
        subprocess.run(
            [PY, os.path.join(ROOT, "integration", "load_default_data.py")],
            cwd=ROOT,
            check=False,
        )
    except Exception as exc:
        print(f"  [warn] default data seed skipped: {exc}")

    print(f"\n  Main dashboard -> {DASHBOARD_URL}")
    webbrowser.open(DASHBOARD_URL)

    print("\nRunning. Press Ctrl+C to stop everything.")
    while True:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            cleanup()


if __name__ == "__main__":
    main()
