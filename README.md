# Dashboard VL

Unified Semiconductor ATE & ML Analytics Suite.

## Desktop / offline app

The desktop launcher lives in a **separate folder** on your Desktop:

**`V ATE APP`**

1. Open `V ATE APP\project.config.json` and confirm the project path.
2. Run **`Setup ATE Intelligence.bat`** once.
3. Run **`Start ATE Intelligence.bat`** to open the desktop window.

See `V ATE APP\README.md` for details.

## Structure
- `tools/shmoo_ml`: M-BIST Shmoo ML Optimization
- `tools/test_time_opt`: ATE Test Time & Vector Memory Optimization
- `tools/ate_frontend`: ATE Dashboard & Analytics
- `dashboard/`: Unified local launcher & UI

## Branching
- `main`: Stable production releases
- `dev`: Integration branch
- `feature/<tool_name>`: Individual feature development
