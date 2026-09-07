# Desktop launcher

This repo includes a local portable launcher. The full Windows **installer / Electron packager** lives in the sibling Desktop folder **`V ATE APP`**.

## Dev (this folder)

```bash
python run_all.py --desktop --no-browser
```

Then open http://127.0.0.1:3000

Or:

1. `Setup ATE Intelligence.bat` (once)
2. `Start ATE Intelligence.bat`

## Installer / other PCs (`V ATE APP`)

1. Confirm `V ATE APP\project.config.json` → `projectRoot` points here
2. `Build Installer.bat` → `desktop\dist\ATE-Intelligence-Setup-1.0.13.exe`
3. Or ship incremental `Create Update Package.bat` → `updates\ATE-Intelligence-Update-1.0.13.zip`

Agents included: Shmoo ML, Test Time Opt, DTL, Retest Reduction, **RA Advisor** (KPI :8805 / UI :8030).
