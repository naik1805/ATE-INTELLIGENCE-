import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import numpy as np

from core.simulator import FailBitmapSimulator
from core.feasibility import FeasibilityEngine
from core.features import SpatialFeatureExtractor
from core.ml_model import DatasetGenerator, RAAdvisorModel, DecisionSupportSystem

app = FastAPI(
    title="RA Advisor API & Dashboard",
    description="Safety-Constrained AI Decision-Support System for Memory Built-in Self-Repair (BISR/BIRA)",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global system state
feasibility_engine = FeasibilityEngine(spare_rows=4, spare_cols=4, spare_blocks=1, max_ecc_bits=2)
model = RAAdvisorModel()
dss: Optional[DecisionSupportSystem] = None

@app.on_event("startup")
def startup_event():
    """Initializes and trains the ML classifier on startup."""
    global dss, model
    generator = DatasetGenerator(rows=16, cols=32, feasibility_engine=feasibility_engine)
    dataset_df = generator.generate_dataset(num_samples=1500)
    train_metrics = model.train(dataset_df)
    dss = DecisionSupportSystem(model=model, feasibility_engine=feasibility_engine)
    print(f"[RA Advisor Startup] Model trained successfully! Val Accuracy: {train_metrics['val_accuracy']:.2%}")

class SimulateRequest(BaseModel):
    archetype: Optional[str] = Field("random", description="Defect archetype name or 'random'")
    rows: int = Field(16, ge=4, le=128)
    cols: int = Field(32, ge=4, le=128)

class PredictRequest(BaseModel):
    bitmap: List[List[int]] = Field(..., description="2D binary fail bitmap array")
    spare_rows: Optional[int] = 4
    spare_cols: Optional[int] = 4
    spare_blocks: Optional[int] = 1

class EvaluateSessionRequest(BaseModel):
    num_dies: int = Field(11, ge=1, le=500)
    rows: int = Field(16, ge=4, le=128)
    cols: int = Field(32, ge=4, le=128)

# REST API Endpoints
@app.get("/api/")
@app.get("/health")
def health_check():
    return {
        "service": "RA Advisor API",
        "status": "online",
        "model_trained": model.is_trained,
        "supported_archetypes": ["scattered", "row_dominant", "column_dominant", "localized_cluster", "mixed_row_column", "near_clean"]
    }

@app.post("/api/simulate")
@app.post("/simulate")
def simulate_die(req: SimulateRequest):
    sim = FailBitmapSimulator(rows=req.rows, cols=req.cols)
    if req.archetype == "random" or not req.archetype:
        result = sim.generate_random_die()
    else:
        try:
            result = sim.generate_by_archetype(req.archetype)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
            
    extractor = SpatialFeatureExtractor()
    features = extractor.extract(np.array(result["bitmap"]))
    result["extracted_features"] = features
    return result

@app.post("/api/predict")
@app.post("/predict")
def predict_repair(req: PredictRequest):
    if not dss:
        raise HTTPException(status_code=503, detail="Decision support system is not initialized.")
        
    bitmap_arr = np.array(req.bitmap, dtype=int)
    
    if req.spare_rows != 4 or req.spare_cols != 4 or req.spare_blocks != 1:
        custom_engine = FeasibilityEngine(
            spare_rows=req.spare_rows, 
            spare_cols=req.spare_cols, 
            spare_blocks=req.spare_blocks
        )
        custom_dss = DecisionSupportSystem(model=model, feasibility_engine=custom_engine)
        res = custom_dss.process_die(bitmap_arr)
    else:
        res = dss.process_die(bitmap_arr)
        
    return res

@app.post("/api/evaluate")
@app.post("/evaluate")
def evaluate_session(req: EvaluateSessionRequest):
    if not dss:
        raise HTTPException(status_code=503, detail="Decision support system is not initialized.")
        
    sim = FailBitmapSimulator(rows=req.rows, cols=req.cols)
    
    dies_processed = 0
    top1_correct = 0
    retest_cycles_avoided = 0
    cumulative_time_saved_ms = 0.0
    fallback_count = 0
    
    algo_distribution: Dict[str, int] = {}
    die_results = []

    for i in range(req.num_dies):
        die = sim.generate_random_die()
        bitmap_arr = np.array(die["bitmap"], dtype=int)
        
        proc_res = dss.process_die(bitmap_arr)
        
        dies_processed += 1
        if proc_res["matches_optimal"]:
            top1_correct += 1
            
        if proc_res["fallback_triggered"]:
            fallback_count += 1
            
        retest_cycles_avoided += proc_res["retest_cycles_avoided"]
        cumulative_time_saved_ms += proc_res["time_saved_ms"]
        
        algo = proc_res["ml_recommendation"]
        algo_distribution[algo] = algo_distribution.get(algo, 0) + 1
        
        die_results.append({
            "die_index": i + 1,
            "archetype": die["archetype"],
            "ai_pick": proc_res["ml_recommendation"],
            "confidence": proc_res["confidence"],
            "optimal": proc_res["optimal_algorithm"],
            "is_feasible": proc_res["is_feasible"],
            "matches_optimal": proc_res["matches_optimal"],
            "time_saved_ms": proc_res["time_saved_ms"]
        })

    top1_accuracy = (top1_correct / dies_processed) if dies_processed > 0 else 0.0
    feasibility_miss_rate = (fallback_count / dies_processed) if dies_processed > 0 else 0.0

    return {
        "session_summary": {
            "dies_processed": dies_processed,
            "top1_accuracy": float(top1_accuracy),
            "top1_accuracy_percent": f"{top1_accuracy:.1%}",
            "retest_cycles_avoided": retest_cycles_avoided,
            "cumulative_time_saved_ms": round(cumulative_time_saved_ms, 2),
            "fallback_count": fallback_count,
            "feasibility_miss_rate": float(feasibility_miss_rate),
            "algorithm_distribution": algo_distribution
        },
        "die_history": die_results
    }

# Mount static files if built (check frontend/dist or static)
base_dir = os.path.dirname(os.path.dirname(__file__))
dist_dir = os.path.join(base_dir, "frontend", "dist")
static_dir = os.path.join(base_dir, "static")

target_dir = dist_dir if os.path.exists(dist_dir) else (static_dir if os.path.exists(static_dir) else None)

if target_dir:
    assets_dir = os.path.join(target_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        index_file = os.path.join(target_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"service": "RA Advisor API", "status": "online"}
