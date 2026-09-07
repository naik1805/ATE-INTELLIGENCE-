import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

from core.simulator import FailBitmapSimulator
from core.features import SpatialFeatureExtractor
from core.feasibility import FeasibilityEngine

# Class label mapping
CLASSES = ["ecc", "row", "col", "combo", "cluster"]
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASSES)}
IDX_TO_CLASS = {i: c for i, c in enumerate(CLASSES)}

class DatasetGenerator:
    """Generates synthetic labeled datasets for training RA Advisor ML models."""
    
    def __init__(self, rows: int = 16, cols: int = 32, feasibility_engine: FeasibilityEngine = None):
        self.rows = rows
        self.cols = cols
        self.feasibility_engine = feasibility_engine or FeasibilityEngine()
        self.feature_extractor = SpatialFeatureExtractor()

    def generate_dataset(self, num_samples: int = 1200) -> pd.DataFrame:
        simulator = FailBitmapSimulator(rows=self.rows, cols=self.cols)
        records = []

        for i in range(num_samples):
            die = simulator.generate_random_die()
            bitmap = np.array(die["bitmap"], dtype=int)
            
            # Extract features
            feats = self.feature_extractor.extract(bitmap)
            
            # Get ground truth label
            gt = self.feasibility_engine.get_ground_truth(bitmap)
            label = gt["optimal_algorithm"]
            
            # Filter out unrepairable dies for model training (or handle as class)
            if label not in CLASS_TO_IDX:
                continue

            record = {**feats, "target_label": label, "target_idx": CLASS_TO_IDX[label], "archetype": die["archetype"]}
            records.append(record)

        return pd.DataFrame(records)

class RAAdvisorModel:
    """LightGBM classifier for predicting memory repair algorithms from fail bitmap features."""
    
    def __init__(self):
        self.model = lgb.LGBMClassifier(
            objective='multiclass',
            num_class=len(CLASSES),
            n_estimators=100,
            learning_rate=0.05,
            random_state=42,
            verbose=-1
        )
        self.is_trained = False
        self.feature_names = [
            "rows_above_thresh", "cols_above_thresh", "max_row_frac", 
            "max_col_frac", "failing_density", "compactness", "total_fails", "bbox_area"
        ]

    def train(self, df: pd.DataFrame) -> Dict[str, float]:
        X = df[self.feature_names]
        y = df["target_idx"]

        X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
        
        self.model.fit(X_train, y_train)
        self.is_trained = True

        y_pred = self.model.predict(X_val)
        val_acc = float(accuracy_score(y_val, y_pred))

        return {"val_accuracy": val_acc, "train_samples": len(X_train), "val_samples": len(X_val)}

    def predict(self, features: Dict[str, float]) -> Dict[str, Any]:
        """Predicts class probabilities and confidence for extracted features."""
        if not self.is_trained:
            raise RuntimeError("Model must be trained before calling predict().")

        X = pd.DataFrame([[features[fn] for fn in self.feature_names]], columns=self.feature_names)
        probs = self.model.predict_proba(X)[0]
        
        top_idx = int(np.argmax(probs))
        top_class = IDX_TO_CLASS[top_idx]
        confidence = float(probs[top_idx])

        class_probabilities = {IDX_TO_CLASS[i]: float(p) for i, p in enumerate(probs)}

        # Rank all recommendations by probability
        ranked_recs = sorted(
            [{"algorithm": IDX_TO_CLASS[i], "probability": float(p)} for i, p in enumerate(probs)],
            key=lambda x: x["probability"],
            reverse=True
        )

        return {
            "recommended_algorithm": top_class,
            "confidence": confidence,
            "class_probabilities": class_probabilities,
            "ranked_recommendations": ranked_recs
        }

class DecisionSupportSystem:
    """
    Safety-constrained Decision Support System for Redundancy Analysis.
    Combines ML Prediction, Feasibility Verification, and Legacy Sequential Fallback.
    """
    
    # Standard time costs per operation in milliseconds
    INFERENCE_COST_MS = 2.0
    REPAIR_PASS_COST_MS = 45.0  # Time for one repair compute pass + retest

    def __init__(self, model: RAAdvisorModel, feasibility_engine: FeasibilityEngine):
        self.model = model
        self.feasibility_engine = feasibility_engine
        self.feature_extractor = SpatialFeatureExtractor()
        # Legacy sequential try order
        self.legacy_try_order = ["row", "col", "combo", "cluster", "ecc"]

    def process_die(self, bitmap: np.ndarray) -> Dict[str, Any]:
        """Processes a die through both AI-assisted and Legacy sequential flows for side-by-side metrics."""
        features = self.feature_extractor.extract(bitmap)
        ml_res = self.model.predict(features)
        recommended_algo = ml_res["recommended_algorithm"]

        # 1. Feasibility check on AI prediction
        verdict = self.feasibility_engine.verify_recommendation(bitmap, recommended_algo)
        ai_feasible = verdict["feasible"]
        optimal_algo = verdict["optimal_algo"]

        # 2. Legacy sequential timing calculation
        legacy_passes = 0
        legacy_time_ms = 0.0
        for algo in self.legacy_try_order:
            legacy_passes += 1
            legacy_time_ms += self.REPAIR_PASS_COST_MS
            res = self.feasibility_engine.evaluate_all(bitmap)[algo]
            if res.feasible:
                break

        # 3. AI-Assisted flow calculation
        if ai_feasible:
            ai_passes = 1
            ai_time_ms = self.INFERENCE_COST_MS + self.REPAIR_PASS_COST_MS
            fallback_triggered = False
            final_used_algo = recommended_algo
        else:
            # Fallback triggered: pay 1 failed pass + search sequential legacy
            fallback_triggered = True
            ai_passes = 1 + legacy_passes
            ai_time_ms = self.INFERENCE_COST_MS + (ai_passes * self.REPAIR_PASS_COST_MS)
            final_used_algo = optimal_algo

        time_saved_ms = legacy_time_ms - ai_time_ms
        retest_cycles_avoided = max(0, legacy_passes - ai_passes)

        return {
            "ml_recommendation": recommended_algo,
            "confidence": ml_res["confidence"],
            "class_probabilities": ml_res["class_probabilities"],
            "ranked_recommendations": ml_res["ranked_recommendations"],
            "is_feasible": ai_feasible,
            "matches_optimal": (recommended_algo == optimal_algo),
            "optimal_algorithm": optimal_algo,
            "fallback_triggered": fallback_triggered,
            "final_used_algorithm": final_used_algo,
            "legacy_passes": legacy_passes,
            "ai_passes": ai_passes,
            "retest_cycles_avoided": retest_cycles_avoided,
            "legacy_time_ms": legacy_time_ms,
            "ai_time_ms": ai_time_ms,
            "time_saved_ms": time_saved_ms,
            "extracted_features": features
        }
