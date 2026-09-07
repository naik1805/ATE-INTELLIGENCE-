# Default agent data

Place each agent's default input files in its folder below. The dashboard integration will load these automatically when you open an agent from a KPI drill-down. You can still upload or change inputs in the agent UI at any time.

```
data/
├── shmoo_ml/           # M-BIST Shmoo ML
├── test_time_opt/      # Test Time Optimization
├── dtl/                # Dynamic Test Limits
└── retest_reduction/   # Retest Benefit Prediction
```

## shmoo_ml

Silicon parametric shmoo dataset (CSV or Excel).

**Expected columns:** `VDD_V`, `Frequency_GHz`, `Test_Result` (optional: `Failure_Code`, `Die_ID`)

**Suggested files:**
- `default.csv` or `default.xlsx` — primary dataset loaded on open

## test_time_opt

ATE test logs and/or STIL vector files for local analysis.

**Suggested layout:**
- `logs/` — folder of `.log` / `.csv` ATE log files (can include subfolders per die/chip)
- `vectors/` — optional STIL (`.stil`) files for live simulation

## dtl

Three-month DTL test data upload (January, February, March). Use real `actual_die` measurement CSVs or ZIPs — the single-die test fixture cannot run the full analysis pipeline.

**Suggested files (CSV or ZIP):**
- `dtl_input_2026_01.zip` (January)
- `dtl_input_2026_02.zip` (February)
- `dtl_input_2026_03.zip` (March)

Also accepted: `january.csv`, `february.csv`, `march.csv`, or names containing `2026-01` / `2026-02` / `2026-03`.

## retest_reduction

Pre-retest events workbook for batch inference.

**Suggested files:**
- `pre_retest_events.xlsx` or any workbook with `pre_retest` in the name — main pre-retest workbook loaded on open
- `outcomes.xlsx` or any workbook with `post_retest`, `outcome`, or `validation` in the name — post-retest outcomes for validation only (e.g. `post_retest_synthetic_validation_119_events.xlsx`)

## ra_advisor

Memory BIRA / BISR repair advisor. Interactive agent — no default upload files required. Drill-down opens the RA Advisor UI on port **8030**.

---

After adding files, restart `run_all.py`. On startup it will:

1. Start the default-data server on port **8810**
2. Seed each agent backend from `data/<agent>/`
3. Open agent drill-downs with `?autoload=1` to load that data automatically

You can still upload or replace inputs inside each agent UI at any time.
