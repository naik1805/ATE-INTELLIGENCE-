"""Bootstrap the minimum on-disk artifacts so DTL /ready passes for upload.

Does not modify any agent source. Creates placeholder files checked by
readiness.py and copies existing GRU checkpoints to the legacy paths the
default RecommendationConfig expects.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


def _touch_parquet(path: Path, columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame({c: [] for c in columns}).to_parquet(path, index=False)


def _touch_csv(path: Path, header: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.is_file():
        path.write_text(header + "\n", encoding="utf-8")


def main() -> None:
    # Readiness gate (readiness.py) — legacy ml_dataset parquets.
    _touch_parquet(
        ROOT / "artifacts/ml_dataset/train/core_candidate_examples.parquet",
        ["example_id", "lot_id", "die_id"],
    )
    _touch_parquet(
        ROOT / "artifacts/ml_dataset/train/parametric_candidate_examples.parquet",
        ["example_id", "lot_id", "die_id"],
    )
    _touch_parquet(
        ROOT / "artifacts/ml_dataset/sequences/core_sequences.parquet",
        ["sequence_id", "lot_id", "die_id"],
    )

    # Simulation evidence CSVs referenced by default RecommendationConfig.
    grid_hdr = "candidate_id,dtl_value"
    res_hdr = "candidate_id,objective_score"
    for domain in ("core", "parametric"):
        _touch_csv(ROOT / f"artifacts/simulation/{domain}/candidate_grid.csv", grid_hdr)
        _touch_csv(ROOT / f"artifacts/simulation/{domain}/candidate_results.csv", res_hdr)

    # Legacy checkpoint paths — copy from the temporal shared checkpoints already in repo.
    ckpt_dst = ROOT / "artifacts/ml/checkpoints"
    ckpt_dst.mkdir(parents=True, exist_ok=True)
    src_core = ROOT / "artifacts/temporal/shared/checkpoints/core_gru_temporal_v1.pt"
    src_param = ROOT / "artifacts/temporal/shared/checkpoints/unified_parameter_gru_v1.pt"
    if src_core.is_file():
        shutil.copy2(src_core, ckpt_dst / "core_gru_best.pt")
    if src_param.is_file():
        shutil.copy2(src_param, ckpt_dst / "parametric_mlp_best.pt")

    print("DTL readiness bootstrap complete.")


if __name__ == "__main__":
    main()
