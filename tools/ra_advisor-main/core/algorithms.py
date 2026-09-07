import numpy as np
from typing import Dict, Any, Union, List, Tuple
from dataclasses import dataclass

@dataclass
class RepairResult:
    algorithm: str
    feasible: bool
    spare_rows_used: int
    spare_cols_used: int
    spare_blocks_used: int
    total_spares_used: int
    uncovered_cells: int

class RedundancySolvers:
    """
    Deterministic Redundancy Analysis (RA) repair algorithms for embedded memories.
    Evaluates repair feasibility against explicit spare row, column, and block budgets.
    """
    
    @staticmethod
    def ecc_repair(bitmap: np.ndarray, max_ecc_bits: int = 2) -> RepairResult:
        """No repair necessary — Residual failing cells covered by on-die ECC."""
        total_fails = int(np.sum(bitmap))
        if total_fails <= max_ecc_bits:
            return RepairResult(
                algorithm="ecc",
                feasible=True,
                spare_rows_used=0,
                spare_cols_used=0,
                spare_blocks_used=0,
                total_spares_used=0,
                uncovered_cells=0
            )
        else:
            return RepairResult(
                algorithm="ecc",
                feasible=False,
                spare_rows_used=0,
                spare_cols_used=0,
                spare_blocks_used=0,
                total_spares_used=0,
                uncovered_cells=total_fails
            )

    @staticmethod
    def row_repair(bitmap: np.ndarray, spare_rows: int) -> RepairResult:
        """Row-only redundancy allocation."""
        arr = bitmap.copy()
        row_counts = np.sum(arr, axis=1)
        failing_rows = np.where(row_counts > 0)[0]
        
        # Sort rows by fail count descending
        sorted_failing_rows = failing_rows[np.argsort(-row_counts[failing_rows])]
        
        allocated_rows = sorted_failing_rows[:spare_rows]
        arr[allocated_rows, :] = 0
        
        remaining_fails = int(np.sum(arr))
        spares_used = len(allocated_rows)
        feasible = (remaining_fails == 0)
        
        return RepairResult(
            algorithm="row",
            feasible=feasible,
            spare_rows_used=spares_used,
            spare_cols_used=0,
            spare_blocks_used=0,
            total_spares_used=spares_used,
            uncovered_cells=remaining_fails
        )

    @staticmethod
    def col_repair(bitmap: np.ndarray, spare_cols: int) -> RepairResult:
        """Column-only redundancy allocation."""
        arr = bitmap.copy()
        col_counts = np.sum(arr, axis=0)
        failing_cols = np.where(col_counts > 0)[0]
        
        # Sort cols by fail count descending
        sorted_failing_cols = failing_cols[np.argsort(-col_counts[failing_cols])]
        
        allocated_cols = sorted_failing_cols[:spare_cols]
        arr[:, allocated_cols] = 0
        
        remaining_fails = int(np.sum(arr))
        spares_used = len(allocated_cols)
        feasible = (remaining_fails == 0)
        
        return RepairResult(
            algorithm="col",
            feasible=feasible,
            spare_rows_used=0,
            spare_cols_used=spares_used,
            spare_blocks_used=0,
            total_spares_used=spares_used,
            uncovered_cells=remaining_fails
        )

    @staticmethod
    def combo_repair(bitmap: np.ndarray, spare_rows: int, spare_cols: int) -> RepairResult:
        """
        Joint Row + Column combinational redundancy allocation.
        Uses exact/greedy set cover over failing cells.
        """
        arr = bitmap.copy()
        rows, cols = arr.shape
        
        best_uncovered = int(np.sum(arr))
        best_row_count = spare_rows + 1
        best_col_count = spare_cols + 1
        best_total_spares = 999999
        feasible_found = False

        # Try allocating r spare rows (0..spare_rows) and c spare cols (0..spare_cols)
        for r_alloc in range(spare_rows + 1):
            for c_alloc in range(spare_cols + 1):
                temp = arr.copy()
                
                # Greedy choice: pick busiest r_alloc rows first, then busiest c_alloc cols
                row_counts = np.sum(temp, axis=1)
                failing_rows = np.where(row_counts > 0)[0]
                sorted_rows = failing_rows[np.argsort(-row_counts[failing_rows])][:r_alloc]
                temp[sorted_rows, :] = 0
                
                col_counts = np.sum(temp, axis=0)
                failing_cols = np.where(col_counts > 0)[0]
                sorted_cols = failing_cols[np.argsort(-col_counts[failing_cols])][:c_alloc]
                temp[:, sorted_cols] = 0
                
                uncovered = int(np.sum(temp))
                total_spares = r_alloc + c_alloc
                
                if uncovered == 0:
                    feasible_found = True
                    if total_spares < best_total_spares:
                        best_total_spares = total_spares
                        best_row_count = r_alloc
                        best_col_count = c_alloc
                        best_uncovered = 0
                elif not feasible_found:
                    if uncovered < best_uncovered:
                        best_uncovered = uncovered
                        best_row_count = r_alloc
                        best_col_count = c_alloc
                        best_total_spares = total_spares

        if feasible_found:
            return RepairResult(
                algorithm="combo",
                feasible=True,
                spare_rows_used=best_row_count,
                spare_cols_used=best_col_count,
                spare_blocks_used=0,
                total_spares_used=best_total_spares,
                uncovered_cells=0
            )
        else:
            return RepairResult(
                algorithm="combo",
                feasible=False,
                spare_rows_used=spare_rows,
                spare_cols_used=spare_cols,
                spare_blocks_used=0,
                total_spares_used=spare_rows + spare_cols,
                uncovered_cells=best_uncovered
            )

    @staticmethod
    def cluster_repair(bitmap: np.ndarray, spare_blocks: int = 1, block_size: Tuple[int, int] = (4, 4)) -> RepairResult:
        """Local block redundancy allocation for compact localized clusters."""
        arr = bitmap.copy()
        br, bc = block_size
        rows, cols = arr.shape
        
        blocks_used = 0
        while blocks_used < spare_blocks and np.sum(arr) > 0:
            # Find window of size (br, bc) covering maximum failing cells
            best_cover = -1
            best_pos = (0, 0)
            
            for r in range(0, max(1, rows - br + 1)):
                for c in range(0, max(1, cols - bc + 1)):
                    sub = arr[r:r + br, c:c + bc]
                    cover_count = np.sum(sub)
                    if cover_count > best_cover:
                        best_cover = cover_count
                        best_pos = (r, c)
                        
            if best_cover <= 0:
                break
                
            r, c = best_pos
            arr[r:r + br, c:c + bc] = 0
            blocks_used += 1
            
        remaining_fails = int(np.sum(arr))
        feasible = (remaining_fails == 0)
        
        return RepairResult(
            algorithm="cluster",
            feasible=feasible,
            spare_rows_used=0,
            spare_cols_used=0,
            spare_blocks_used=blocks_used,
            total_spares_used=blocks_used,
            uncovered_cells=remaining_fails
        )
