"""Launch the four agent KPI wrapper sidecars.

These are read-only sidecars. They do not start the agents themselves --
use run_suite.py for that. Ports are chosen to avoid every port already in
use by an agent or the dashboard (3000, 5000, 5173, 5174, 8000, 8501, 8787).

    python run_agent_apis.py
"""

import os
import signal
import subprocess
import sys
import time

WRAPPERS = [
    {
        "id": "shmoo_ml",
        "port": 8801,
        "cwd": os.path.join("tools", "shmoo_ml"),
        "cmd": [sys.executable, "kpi_wrapper.py"],
    },
    {
        "id": "test_time_opt",
        "port": 8802,
        "cwd": os.path.join("tools", "test_time_opt"),
        "cmd": ["node", os.path.join("server", "kpi_wrapper.js")],
        "shell": True,
    },
    {
        "id": "dtl",
        "port": 8803,
        "cwd": os.path.join("tools", "dtl"),
        "cmd": [
            sys.executable, "-m", "uvicorn", "kpi_wrapper:app",
            "--host", "127.0.0.1", "--port", "8803",
        ],
    },
    {
        "id": "retest_reduction",
        "port": 8804,
        "cwd": os.path.join("tools", "retest_reduction"),
        "cmd": [
            sys.executable, "-m", "uvicorn", "kpi_wrapper:app",
            "--host", "127.0.0.1", "--port", "8804",
        ],
    },
]

processes = []


def cleanup(sig=None, frame=None):
    print("\nStopping agent KPI wrappers...")
    for p in processes:
        try:
            p.terminate()
        except Exception:
            pass
    sys.exit(0)


signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)


def main():
    root = os.path.dirname(os.path.abspath(__file__))
    print("=" * 60)
    print("          AGENT KPI WRAPPER SIDECARS")
    print("=" * 60)

    for w in WRAPPERS:
        cwd = os.path.join(root, w["cwd"])
        if not os.path.isdir(cwd):
            print(f"[skip] {w['id']}: {cwd} not found")
            continue
        print(f"[start] {w['id']:<18} http://127.0.0.1:{w['port']}")
        try:
            processes.append(
                subprocess.Popen(w["cmd"], cwd=cwd, shell=w.get("shell", False))
            )
        except Exception as e:
            print(f"[fail]  {w['id']}: {e}")

    print("\nWrappers running. Press Ctrl+C to stop.")
    while True:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            cleanup()


if __name__ == "__main__":
    main()
