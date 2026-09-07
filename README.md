# ATE Intelligence

**VERILUMEN ATE Intelligence** is an offline-first Windows suite for semiconductor ATE analytics. It combines a unified dashboard with five local AI agents for shmoo optimization, test-time reduction, dynamic test limits, retest decisions, and memory BISR repair advice.

Latest Windows installer: **[Release v1.0.13](https://github.com/naik1805/ATE-INTELLIGENCE-/releases/tag/v1.0.13)**

---

## What you get

| Layer | Purpose |
|--------|---------|
| **Main dashboard** (`:3000`) | Optimization KPIs, wafer/demo map, agent cards, event log |
| **Integrated agents** | Each agent has its own UI + API + KPI sidecar |
| **Offline desktop mode** | Local `ADMIN` session — no cloud login required |
| **Windows installer** | One `.exe` for target PCs (no Python/Node install needed) |

### Agents

| Agent | What it does | UI | KPI |
|--------|----------------|-----|-----|
| **M-BIST Shmoo ML** | Shmoo characterization / ML optimization | `:5000` | `:8801` |
| **ATE Test Time Optimization** | Vector memory / pattern keep-ratio simulation | `:5173` | `:8802` |
| **Dynamic Test Limits (DTL)** | 3-month recommended parametric limits | `:5174` | `:8803` |
| **Retest Benefit Prediction** | Retest vs don’t-retest recommendations | `:5175` | `:8804` |
| **RA Advisor** | Fail-bitmap → spatial features → LightGBM repair pick | `:8030` | `:8805` |

Other local ports used by the suite: integration/default-data `:8810`, TTO API `:8787`, DTL API `:8010`, retest API `:8020`.

---

## Quick start (end users)

**Best path:** install from the GitHub release — do **not** zip the whole repo.

1. Download [`ATE-Intelligence-Setup-1.0.13.exe`](https://github.com/naik1805/ATE-INTELLIGENCE-/releases/download/v1.0.13/ATE-Intelligence-Setup-1.0.13.exe)
2. Run the installer on Windows 10/11 (64-bit)
3. Open **ATE Intelligence** from Desktop or Start Menu
4. First launch can take 1–2 minutes while local services start

You should see **local / ADMIN** in the header (offline desktop mode).

### Already installed? Patch instead of reinstalling

Download [`ATE-Intelligence-Update-1.0.13.zip`](https://github.com/naik1805/ATE-INTELLIGENCE-/releases/download/v1.0.13/ATE-Intelligence-Update-1.0.13.zip), extract it, then run **`Update Installed App.bat`**.

---

## Quick start (developers)

### Requirements

- Windows 10/11
- Python **3.11+** (with pip)
- Node.js **20+** / npm
- Internet once for dependency install

### One-command suite

From this repo root:

```bash
python run_all.py --desktop --no-browser
```

Then open [http://127.0.0.1:3000](http://127.0.0.1:3000).

Or use the local launchers:

1. `Setup ATE Intelligence.bat` — one-time portable setup (venv + npm + offline env)
2. `Start ATE Intelligence.bat` — starts services and opens the Electron window (or browser)

### Useful flags

```bash
python run_all.py                  # full suite + open browser
python run_all.py --desktop        # offline desktop env vars
python run_all.py --wrappers       # KPI wrappers + dashboard only
python run_all.py --no-browser     # don’t auto-open a browser
```

---

## Repository layout

```
ATE-INTELLIGENCE-/
├── run_all.py                 # Launches dashboard + all agents on fixed ports
├── requirements-portable.txt  # Python deps for portable / desktop installs
├── Setup ATE Intelligence.bat
├── Start ATE Intelligence.bat
├── scripts/                   # Portable setup + start helpers
├── desktop/                   # Electron shell (dev / packaging helper)
├── integration/               # Default-data server + seed helpers
├── data/                      # Sample datasets for agent autoload
└── tools/
    ├── ate_frontend/          # Next.js main dashboard
    ├── shmoo_ml/
    ├── test_time_opt/
    ├── dtl/
    ├── retest_reduction/
    └── ra_advisor-main/       # RA Advisor API + SPA + KPI wrapper
```

Related (not always in this git clone): a sibling **`V ATE APP`** folder on the developer machine builds the NSIS installer / update packages that point at this project via `project.config.json`.

---

## How the pieces connect

```
                 ┌──────────────────────────────┐
                 │  Dashboard  :3000 (Next.js)  │
                 │  Optimization KPIs + agents  │
                 └──────────────┬───────────────┘
                                │ polls KPI wrappers
        ┌───────────┬───────────┼───────────┬───────────┐
        ▼           ▼           ▼           ▼           ▼
     :8801       :8802       :8803       :8804       :8805
   Shmoo KPI   TTO KPI     DTL KPI    Retest KPI   RA KPI
        │           │           │           │           │
        ▼           ▼           ▼           ▼           ▼
     :5000       :5173/:8787 :5174/:8010 :5175/:8020 :8030
   agent UI/API  agent UI/API agent UI/API agent UI/API RA UI/API
```

`run_all.py` owns the conflict-free port map so agents that default to the same ports (e.g. `:8000` / Vite `:5173`) do not collide.

---

## Offline desktop mode

Setup copies `tools/ate_frontend/env.portable` → `.env.local` with:

- `OFFLINE_DESKTOP=1`
- `NEXT_PUBLIC_OFFLINE_DESKTOP=1`
- Local default-data URL and API proxy target

If you see a **cloud login / Render API** error, you are not in offline mode:

1. Re-run **Setup**
2. Always launch via **Start** / `run_all.py --desktop`
3. Restart after setup

More detail: [`PORTABLE.md`](PORTABLE.md), [`DESKTOP.md`](DESKTOP.md).

---

## Building the Windows installer (developers)

On the machine that has **`V ATE APP`** configured to this repo:

1. Confirm `V ATE APP\project.config.json` → `projectRoot`
2. Run **`Build Installer.bat`** (15–40 min first time)
3. Output: `V ATE APP\desktop\dist\ATE-Intelligence-Setup-<version>.exe`
4. Publish that file on the GitHub **Releases** page (preferred — the `.exe` is ~800+ MB)

Incremental patches: **`Create Update Package.bat`** → `updates\ATE-Intelligence-Update-<version>.zip`.

---

## Sample data

`data/` holds default uploads used by `integration/load_default_data.py` so agents show meaningful KPIs on first run (shmoo CSV, DTL month zips, retest workbooks, RA advisor seed, etc.). See [`data/README.md`](data/README.md).

---

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| Port 3000 in use | Close other Next/dev servers; re-run Start |
| Agent cards idle / error | Wait for KPI ports `8801`–`8805`; check the Python services window |
| Blank Electron window | Wait 2 minutes on first launch, then restart |
| Cloud login screen | Re-run Setup; launch with `--desktop` / Start bat |
| DTL / TTO session errors | Ensure agents were started via `run_all.py` (not half-started manually) |
| Python import failures on install | Use Repair Python / re-run portable setup so deps land in `.portable` |

---

## Releases

| Version | Notes |
|---------|--------|
| **[v1.0.13](https://github.com/naik1805/ATE-INTELLIGENCE-/releases/tag/v1.0.13)** | Current installer + update zip — RA Advisor, offline desktop, agent reliability fixes |

---

## Branching

- `main` — stable / release-aligned
- feature work — short-lived branches as needed

---

## License / ownership

Internal VERILUMEN ATE Intelligence project. Contact the repo owner for distribution rights outside your team.
