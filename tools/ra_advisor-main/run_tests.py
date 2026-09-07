import unittest
import numpy as np

from core.simulator import FailBitmapSimulator
from core.features import SpatialFeatureExtractor
from core.algorithms import RedundancySolvers
from core.feasibility import FeasibilityEngine
from core.ml_model import DatasetGenerator, RAAdvisorModel, DecisionSupportSystem
from fastapi.testclient import TestClient
from api.main import app

class TestRAAdvisorEngine(unittest.TestCase):
    
    def test_simulator_archetypes(self):
        sim = FailBitmapSimulator(rows=16, cols=32, seed=42)
        for arch in ["scattered", "row_dominant", "column_dominant", "localized_cluster", "mixed_row_column", "near_clean"]:
            die = sim.generate_by_archetype(arch)
            bitmap = np.array(die["bitmap"])
            self.assertEqual(bitmap.shape, (16, 32))
            self.assertEqual(die["archetype"], arch)

    def test_feature_extractor(self):
        extractor = SpatialFeatureExtractor()
        bitmap = np.zeros((16, 32), dtype=int)
        bitmap[2, :] = 1  # 1 full failing row (32 bits)
        
        feats = extractor.extract(bitmap)
        self.assertEqual(feats["rows_above_thresh"], 1.0)
        self.assertEqual(feats["max_row_frac"], 1.0)
        self.assertEqual(feats["total_fails"], 32.0)
        self.assertEqual(feats["compactness"], 1.0)

    def test_repair_solvers(self):
        bitmap = np.zeros((16, 32), dtype=int)
        bitmap[0, :] = 1
        bitmap[1, :] = 1
        res_row = RedundancySolvers.row_repair(bitmap, spare_rows=2)
        self.assertTrue(res_row.feasible)
        self.assertEqual(res_row.spare_rows_used, 2)

        bitmap_col = np.zeros((16, 32), dtype=int)
        bitmap_col[:, 5] = 1
        res_col = RedundancySolvers.col_repair(bitmap_col, spare_cols=1)
        self.assertTrue(res_col.feasible)
        self.assertEqual(res_col.spare_cols_used, 1)

    def test_feasibility_engine(self):
        engine = FeasibilityEngine(spare_rows=2, spare_cols=2, spare_blocks=1, max_ecc_bits=2)
        bitmap = np.zeros((16, 32), dtype=int)
        bitmap[0, :] = 1
        bitmap[1, :] = 1
        
        gt = engine.get_ground_truth(bitmap)
        self.assertEqual(gt["optimal_algorithm"], "row")
        self.assertTrue(gt["is_repairable"])

    def test_ml_model_and_safety_fallback(self):
        engine = FeasibilityEngine()
        gen = DatasetGenerator(rows=16, cols=32, feasibility_engine=engine)
        df = gen.generate_dataset(num_samples=400)
        
        model = RAAdvisorModel()
        train_res = model.train(df)
        self.assertGreater(train_res["val_accuracy"], 0.70)
        
        dss = DecisionSupportSystem(model=model, feasibility_engine=engine)
        sim = FailBitmapSimulator(rows=16, cols=32)
        test_die = sim.generate_by_archetype("row_dominant")
        bitmap = np.array(test_die["bitmap"], dtype=int)
        
        proc_res = dss.process_die(bitmap)
        self.assertIn("ml_recommendation", proc_res)
        self.assertIn("is_feasible", proc_res)
        self.assertIn("time_saved_ms", proc_res)

    def test_fastapi_endpoints(self):
        with TestClient(app) as client:
            # Test API health endpoint
            res_root = client.get("/api/")
            self.assertEqual(res_root.status_code, 200)
            self.assertTrue(res_root.json()["model_trained"])
            
            # Test SPA dashboard root endpoint
            res_spa = client.get("/")
            self.assertEqual(res_spa.status_code, 200)
            self.assertIn("RA Advisor", res_spa.text)
            
            res_sim = client.post("/simulate", json={"archetype": "row_dominant", "rows": 16, "cols": 32})
            self.assertEqual(res_sim.status_code, 200)
            data = res_sim.json()
            self.assertEqual(data["archetype"], "row_dominant")
            
            res_pred = client.post("/predict", json={"bitmap": data["bitmap"]})
            self.assertEqual(res_pred.status_code, 200)
            pred_data = res_pred.json()
            self.assertIn("ml_recommendation", pred_data)
            self.assertIn("confidence", pred_data)
            
            res_eval = client.post("/evaluate", json={"num_dies": 11, "rows": 16, "cols": 32})
            self.assertEqual(res_eval.status_code, 200)
            eval_data = res_eval.json()
            self.assertEqual(eval_data["session_summary"]["dies_processed"], 11)
            print("\n--- Interactive 11-Die Session Evaluation Summary ---")
            print(f"Top-1 Accuracy: {eval_data['session_summary']['top1_accuracy_percent']}")
            print(f"Retest Cycles Avoided: {eval_data['session_summary']['retest_cycles_avoided']}")
            print(f"Cumulative Time Saved: {eval_data['session_summary']['cumulative_time_saved_ms']} ms")
            print(f"Fallback Count: {eval_data['session_summary']['fallback_count']}")
            print(f"Algorithm Distribution: {eval_data['session_summary']['algorithm_distribution']}")

if __name__ == "__main__":
    unittest.main()
