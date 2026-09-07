import numpy as np
from typing import Dict, Any, Union, List

class SpatialFeatureExtractor:
    """
    Extracts spatial tabular features from MBIST fail bitmaps for ML modeling.
    Features capture defect geometry, row/column concentrations, density, and compactness.
    """
    def __init__(self, row_threshold_frac: float = 0.55, col_threshold_frac: float = 0.55):
        self.row_threshold_frac = row_threshold_frac
        self.col_threshold_frac = col_threshold_frac

    def extract(self, bitmap: Union[np.ndarray, List[List[int]]]) -> Dict[str, float]:
        arr = np.array(bitmap, dtype=int)
        rows, cols = arr.shape
        total_cells = rows * cols
        total_fails = int(np.sum(arr))

        if total_fails == 0:
            return {
                "rows_above_thresh": 0.0,
                "cols_above_thresh": 0.0,
                "max_row_frac": 0.0,
                "max_col_frac": 0.0,
                "failing_density": 0.0,
                "compactness": 0.0,
                "total_fails": 0.0,
                "bbox_area": 0.0
            }

        row_counts = np.sum(arr, axis=1)
        col_counts = np.sum(arr, axis=0)

        rows_above_thresh = float(np.sum(row_counts >= (self.row_threshold_frac * cols)))
        cols_above_thresh = float(np.sum(col_counts >= (self.col_threshold_frac * rows)))

        max_row_frac = float(np.max(row_counts) / cols)
        max_col_frac = float(np.max(col_counts) / rows)
        failing_density = float(total_fails / total_cells)

        # Calculate bounding box of failing cells
        failing_coords = np.argwhere(arr == 1)
        min_r, min_c = np.min(failing_coords, axis=0)
        max_r, max_c = np.max(failing_coords, axis=0)

        bbox_height = max_r - min_r + 1
        bbox_width = max_c - min_c + 1
        bbox_area = float(bbox_height * bbox_width)

        compactness = float(total_fails / bbox_area) if bbox_area > 0 else 0.0

        return {
            "rows_above_thresh": rows_above_thresh,
            "cols_above_thresh": cols_above_thresh,
            "max_row_frac": max_row_frac,
            "max_col_frac": max_col_frac,
            "failing_density": failing_density,
            "compactness": compactness,
            "total_fails": float(total_fails),
            "bbox_area": bbox_area
        }
