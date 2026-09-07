from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
STATE_DIR = Path(__file__).resolve().parent / ".state"

AGENT_IDS = ("shmoo_ml", "test_time_opt", "dtl", "retest_reduction", "ra_advisor")
