import pytest
import numpy as np
from fastapi.testclient import TestClient

from core.simulator import FailBitmapSimulator
from core.features import SpatialFeatureExtractor
from core.algorithms import RedundancySolvers
from core.feasibility import FeasibilityEngine
from core.ml_model import DatasetGenerator, RAAdvisorModel, DecisionSupportSystem
from api.main import app

def test_simulator_archetypes():
    sim = FailBitmapSimulator(rows=16, cols=32, seed=42)
    for arch in ["scattered", "row_dominant", "column_dominant", "localized_cluster", "mixed_row_column", "near_clean"]:
        die = sim.generate_by_archetype(arch)
        bitmap = np.array(die["bitmap"])
        assert bitmap.shape == (16, 32)
        assert die["archetype"] == arch

def test_feature_extractor():
    extractor = SpatialFeatureExtractor()
    bitmap = np.zeros((16, 32), dtype=int)
    bitmap[2, :] = 1  # 1 full failing row (32 bits)
    
    feats = extractor.extract(bitmap)
    assert feats["rows_above_thresh"] == 1.0
    assert feats["max_row_frac"] == 1.0
    assert feats["total_fails"] == 32.0
    assert feats["compactness"] == 1.0

def test_repair_solvers():
    # Test Row Solver
    bitmap = np.zeros((16, 32), dtype=int)
    bitmap[0, :] = 1
    bitmap[1, :] = 1
    res_row = RedundancySolvers.row_repair(bitmap, spare_rows=2)
    assert res_row.feasible is True
    assert res_row.spare_rows_used == 2

    # Test Col Solver
    bitmap_col = np.zeros((16, 32), dtype=int)
    bitmap_col[:, 5] = 1
    res_col = RedundancySolvers.col_repair(bitmap_col, spare_cols=1)
    assert res_col.feasible is True
    assert res_col.spare_cols_used == 1

def test_feasibility_engine():
    engine = FeasibilityEngine(spare_rows=2, spare_cols=2, spare_blocks=1, max_ecc_bits=2)
    bitmap = np.zeros((16, 32), dtype=int)
    bitmap[0, :] = 1
    bitmap[1, :] = 1
    
    gt = engine.get_ground_truth(bitmap)
    assert gt["optimal_algorithm"] == "row"
    assert gt["is_repairable"] is True

def test_ml_model_and_safety_fallback():
    engine = FeasibilityEngine()
    gen = DatasetGenerator(rows=16, cols=32, feasibility_engine=engine)
    df = gen.generate_dataset(num_samples=300)
    
    model = RAAdvisorModel()
    train_res = model.train(df)
    assert train_res["val_accuracy"] > 0.70
    
    dss = DecisionSupportSystem(model=model, feasibility_engine=engine)
    sim = FailBitmapSimulator(rows=16, cols=32)
    test_die = sim.generate_by_archetype("row_dominant")
    bitmap = np.array(test_die["bitmap"], dtype=int)
    
    proc_res = dss.process_die(bitmap)
    assert "ml_recommendation" in proc_res
    assert "is_feasible" in proc_res
    assert "time_saved_ms" in proc_res

def test_fastapi_endpoints():
    with TestClient(app) as client:
        # GET /
        res_root = client.get("/")
        assert res_root.status_code == 200
        assert res_root.json()["model_trained"] is True
        
        # POST /simulate
        res_sim = client.post("/simulate", json={"archetype": "row_dominant", "rows": 16, "cols": 32})
        assert res_sim.status_code == 200
        data = res_sim.json()
        assert data["archetype"] == "row_dominant"
        
        # POST /predict
        res_pred = client.post("/predict", json={"bitmap": data["bitmap"]})
        assert res_pred.status_code == 200
        pred_data = res_pred.json()
        assert "ml_recommendation" in pred_data
        assert "confidence" in pred_data
        
        # POST /evaluate
        res_eval = client.post("/evaluate", json={"num_dies": 5, "rows": 16, "cols": 32})
        assert res_eval.status_code == 200
        eval_data = res_eval.json()
        assert eval_data["session_summary"]["dies_processed"] == 5
