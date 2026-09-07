# RA Advisor 🧠⚡

> **Safety-Constrained AI Decision-Support System for Memory Built-in Self-Test & Built-in Self-Repair (MBIST / BISR / BIRA)**

RA Advisor is an AI-assisted decision support system designed to accelerate semiconductor memory repair during Automated Test Equipment (ATE) wafer sort. Instead of relying on a brute-force sequential search across repair algorithms, RA Advisor extracts spatial geometry features from fail bitmaps and uses a **LightGBM** classifier to instantly predict the optimal repair strategy, while ensuring zero false scraps through a deterministic **Feasibility Engine** safety fallback.

---

## 🚀 Key Features

- **Instant Algorithm Prediction:** Predicts repair strategies (`ecc`, `row`, `col`, `combo`, `cluster`) in $\sim 2\text{ms}$ using LightGBM.
- **Feasibility Engine Safety Net:** Verifies all predictions against physical spare budgets (spare rows, spare columns, spare blocks, max ECC bits). Automatically triggers legacy sequential fallback if a prediction is infeasible.
- **Feasibility-Aware Ground Truth:** Labels synthetic dataset based on minimal spare consumption and 100% fail coverage.
- **Interactive Dashboard:** Modern React/TypeScript frontend + FastAPI backend showing real-time KPIs, fail bitmap visualizers, and timing comparison charts.

---

## 📁 Project Structure

```text
ra_advisor/
├── api/
│   └── main.py              # FastAPI REST endpoints & SPA mounting
├── core/
│   ├── algorithms.py        # Deterministic repair solvers (row, col, combo, cluster, ecc)
│   ├── feasibility.py       # Safety engine & ground-truth label calculator
│   ├── features.py          # SpatialFeatureExtractor (8 spatial geometry features)
│   ├── ml_model.py          # LightGBM classifier & DecisionSupportSystem
│   └── simulator.py         # Fail bitmap simulator (6 defect archetypes)
├── frontend/                # React + Vite + TypeScript dashboard UI
├── planning/                # Documentation & Technical Whitepaper Report
├── run_tests.py             # Test suite execution script
└── tests/                   # Pytest test cases
```

---

## 🛠️ Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+ and npm

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd ra_advisor
   ```

2. **Install Python dependencies:**
   ```bash
   pip install fastapi uvicorn lightgbm scikit-learn numpy pandas pydantic
   ```

3. **Install Frontend dependencies & build:**
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

4. **Run the Application:**
   ```bash
   python -m uvicorn api.main:app --reload --port 8000
   ```
   Open your browser at `http://localhost:8000` to access the interactive dashboard.

5. **Run Tests:**
   ```bash
   python run_tests.py
   ```

---

## 📖 External Citations & Literature

1. **IEEE Xplore (2021):** [A Deep Learning Model for Redundancy Analysis Algorithm Recommendation](https://ieeexplore.ieee.org/document/9691578)
2. **Siemens EDA:** [The Key Role of AI in Semiconductor Testing](https://blogs.sw.siemens.com/thought-leadership/the-key-role-of-ai-in-semiconductor-testing)
3. **Research Square (2025):** [AI/ML for Yield Learning and Test Optimization in Semiconductor Manufacturing](https://www.researchsquare.com/article/rs-9464431/v1)
4. **SemiEngineering:** [AI Accelerator Testing Depends On DFT Innovations](https://semiengineering.com/ai-accelerator-testing-depends-on-dft-innovations)
5. **eInfochips:** [Memory Testing: MBIST, BIRA & BISR](https://einfochips.com/blog/memory-testing-an-insight-into-algorithms-and-self-repair-mechanism)
6. **ASPDAC 2025:** [Memory Built-In Self-Test (MBIST): Advanced Techniques](https://aspdac.com/aspdac2025/archive/pdf/T3-1.pdf)
