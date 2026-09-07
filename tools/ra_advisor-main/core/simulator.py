import numpy as np
from typing import Tuple, Dict, Any

class FailBitmapSimulator:
    """
    Simulates Memory Built-in Self-Test (MBIST) fail bitmaps for embedded memories.
    Generates 2D binary numpy arrays (0 = good bit, 1 = failing bit) across
    the 6 core defect archetypes described in the RA Advisor specification.
    """
    
    def __init__(self, rows: int = 16, cols: int = 32, seed: int = None):
        self.rows = rows
        self.cols = cols
        if seed is not None:
            np.random.seed(seed)

    def scattered(self, num_fails: int = 3) -> np.ndarray:
        """Isolated single-bit failures scattered across memory."""
        bitmap = np.zeros((self.rows, self.cols), dtype=int)
        indices = np.random.choice(self.rows * self.cols, size=min(num_fails, self.rows * self.cols), replace=False)
        for idx in indices:
            r, c = divmod(idx, self.cols)
            bitmap[r, c] = 1
        return bitmap

    def row_dominant(self, num_failing_rows: int = 1, fill_ratio: float = 0.95) -> np.ndarray:
        """Failures concentrated in one or more full/mostly-full rows."""
        bitmap = np.zeros((self.rows, self.cols), dtype=int)
        target_rows = np.random.choice(self.rows, size=min(num_failing_rows, self.rows), replace=False)
        for r in target_rows:
            mask = np.random.rand(self.cols) < fill_ratio
            bitmap[r, mask] = 1
        return bitmap

    def column_dominant(self, num_failing_cols: int = 1, fill_ratio: float = 0.95) -> np.ndarray:
        """Failures concentrated in one or more full/mostly-full columns."""
        bitmap = np.zeros((self.rows, self.cols), dtype=int)
        target_cols = np.random.choice(self.cols, size=min(num_failing_cols, self.cols), replace=False)
        for c in target_cols:
            mask = np.random.rand(self.rows) < fill_ratio
            bitmap[mask, c] = 1
        return bitmap

    def localized_cluster(self, cluster_size: Tuple[int, int] = (3, 3)) -> np.ndarray:
        """Localized block failure (process-induced physical spot defect)."""
        bitmap = np.zeros((self.rows, self.cols), dtype=int)
        cr, cc = cluster_size
        cr = min(cr, self.rows)
        cc = min(cc, self.cols)
        
        start_r = np.random.randint(0, self.rows - cr + 1)
        start_c = np.random.randint(0, self.cols - cc + 1)
        
        bitmap[start_r:start_r + cr, start_c:start_c + cc] = 1
        return bitmap

    def mixed_row_column(self) -> np.ndarray:
        """Mixed defect pattern requiring combined row and column spare allocation."""
        bitmap = np.zeros((self.rows, self.cols), dtype=int)
        # Add 1 row defect
        r = np.random.randint(0, self.rows)
        bitmap[r, :] = (np.random.rand(self.cols) < 0.85).astype(int)
        # Add 1 col defect
        c = np.random.randint(0, self.cols)
        bitmap[:, c] = (np.random.rand(self.rows) < 0.85).astype(int)
        # Add a couple stray bit fails
        stray_r = np.random.randint(0, self.rows)
        stray_c = np.random.randint(0, self.cols)
        bitmap[stray_r, stray_c] = 1
        return bitmap

    def near_clean(self, num_fails: int = 1) -> np.ndarray:
        """0 to 2 isolated failing cells covered by on-die ECC without spending spare budget."""
        bitmap = np.zeros((self.rows, self.cols), dtype=int)
        if num_fails > 0:
            indices = np.random.choice(self.rows * self.cols, size=min(num_fails, self.rows * self.cols), replace=False)
            for idx in indices:
                r, c = divmod(idx, self.cols)
                bitmap[r, c] = 1
        return bitmap

    def generate_by_archetype(self, archetype: str) -> Dict[str, Any]:
        """Generate fail bitmap by archetype name."""
        archetype_map = {
            "scattered": self.scattered,
            "row_dominant": self.row_dominant,
            "column_dominant": self.column_dominant,
            "localized_cluster": self.localized_cluster,
            "mixed_row_column": self.mixed_row_column,
            "near_clean": self.near_clean
        }
        if archetype not in archetype_map:
            raise ValueError(f"Unknown archetype '{archetype}'. Choose from {list(archetype_map.keys())}")
        
        bitmap = archetype_map[archetype]()
        return {
            "archetype": archetype,
            "rows": self.rows,
            "cols": self.cols,
            "failing_bits": int(np.sum(bitmap)),
            "bitmap": bitmap.tolist()
        }

    def generate_random_die(self) -> Dict[str, Any]:
        """Generates a random die using one of the 6 archetypes weighted realistically."""
        archetypes = ["scattered", "row_dominant", "column_dominant", "localized_cluster", "mixed_row_column", "near_clean"]
        weights = [0.15, 0.20, 0.20, 0.15, 0.20, 0.10]
        chosen = np.random.choice(archetypes, p=weights)
        return self.generate_by_archetype(chosen)
