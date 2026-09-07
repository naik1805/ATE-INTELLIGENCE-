import numpy as np
from typing import Dict, Any, List, Optional
from core.algorithms import RedundancySolvers, RepairResult

class FeasibilityEngine:
    """
    Deterministic safety and label-generation engine.
    Evaluates all candidate repair algorithms against the memory spare budget.
    Determines feasibility and computes the minimal-spare optimal ground-truth label.
    """
    
    def __init__(
        self,
        spare_rows: int = 4,
        spare_cols: int = 4,
        spare_blocks: int = 1,
        max_ecc_bits: int = 2,
        block_size: tuple = (4, 4)
    ):
        self.spare_rows = spare_rows
        self.spare_cols = spare_cols
        self.spare_blocks = spare_blocks
        self.max_ecc_bits = max_ecc_bits
        self.block_size = block_size

    def evaluate_all(self, bitmap: np.ndarray) -> Dict[str, RepairResult]:
        """Runs all 5 repair algorithms on the bitmap."""
        results = {}
        
        # 1. ECC / No Repair
        results["ecc"] = RedundancySolvers.ecc_repair(bitmap, max_ecc_bits=self.max_ecc_bits)
        
        # 2. Row Redundancy
        results["row"] = RedundancySolvers.row_repair(bitmap, spare_rows=self.spare_rows)
        
        # 3. Column Redundancy
        results["col"] = RedundancySolvers.col_repair(bitmap, spare_cols=self.spare_cols)
        
        # 4. Row + Column Combinational
        results["combo"] = RedundancySolvers.combo_repair(bitmap, spare_rows=self.spare_rows, spare_cols=self.spare_cols)
        
        # 5. Local Block Cluster Redundancy
        results["cluster"] = RedundancySolvers.cluster_repair(bitmap, spare_blocks=self.spare_blocks, block_size=self.block_size)
        
        return results

    def get_ground_truth(self, bitmap: np.ndarray) -> Dict[str, Any]:
        """
        Computes the feasibility-checked optimal label.
        Rule: Pick the algorithm that repairs the die (feasible=True) AND consumes minimal total spares.
        Tie-breaking priority: ecc -> row -> col -> cluster -> combo.
        """
        all_results = self.evaluate_all(bitmap)
        
        feasible_results = [r for r in all_results.values() if r.feasible]
        
        if not feasible_results:
            return {
                "optimal_algorithm": "unrepairable",
                "is_repairable": False,
                "minimal_spares": -1,
                "all_evaluations": {k: v.__dict__ for k, v in all_results.items()}
            }

        # Tie-break priority map (prefer simpler/cheaper repair mechanisms)
        priority = {"ecc": 0, "row": 1, "col": 2, "cluster": 3, "combo": 4}
        
        # Sort by total_spares_used ascending, then priority
        best = sorted(feasible_results, key=lambda r: (r.total_spares_used, priority.get(r.algorithm, 99)))[0]
        
        return {
            "optimal_algorithm": best.algorithm,
            "is_repairable": True,
            "minimal_spares": best.total_spares_used,
            "result_details": best.__dict__,
            "all_evaluations": {k: v.__dict__ for k, v in all_results.items()}
        }

    def verify_recommendation(self, bitmap: np.ndarray, recommended_algo: str) -> Dict[str, Any]:
        """
        Verifies whether an AI-recommended algorithm is feasible on the given bitmap.
        """
        all_evals = self.evaluate_all(bitmap)
        
        if recommended_algo not in all_evals:
            return {
                "recommended_algo": recommended_algo,
                "feasible": False,
                "reason": f"Unknown algorithm '{recommended_algo}'"
            }
            
        rec_res = all_evals[recommended_algo]
        gt = self.get_ground_truth(bitmap)
        
        is_optimal = (gt["optimal_algorithm"] == recommended_algo)
        
        return {
            "recommended_algo": recommended_algo,
            "feasible": rec_res.feasible,
            "is_optimal": is_optimal,
            "optimal_algo": gt["optimal_algorithm"],
            "spares_used": rec_res.total_spares_used,
            "uncovered_cells": rec_res.uncovered_cells,
            "rec_details": rec_res.__dict__,
            "gt_details": gt
        }
