param(
    [string]$Root = ""
)

$ErrorActionPreference = "Stop"

if ($Root) {
    $Root = $Root.TrimEnd("\", "/")
} else {
    $Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
}

Set-Location $Root

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ATE Intelligence — Starting..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Folder: $Root`n"

function Require-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Missing $name. Install it, or run Setup ATE Intelligence.bat first."
    }
}

Require-Command python
Require-Command npm

$PortableEmbed = Join-Path $Root ".portable\python\python.exe"
$PortableVenv = Join-Path $Root ".portable\venv\Scripts\python.exe"
$Python = if (Test-Path $PortableEmbed) { $PortableEmbed } elseif (Test-Path $PortableVenv) { $PortableVenv } else { "python" }

$NeedsSetup = -not (Test-Path (Join-Path $Root "tools\ate_frontend\node_modules"))
if ($NeedsSetup) {
    Write-Host "First run — installing dependencies (5–15 min, internet required once)...`n" -ForegroundColor Yellow
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\setup_portable.ps1") -Root $Root
}

$env:OFFLINE_DESKTOP = "1"
$env:NEXT_PUBLIC_OFFLINE_DESKTOP = "1"
$env:NEXT_PUBLIC_DEFAULT_DATA_URL = "http://127.0.0.1:3000/api/default-data"
$env:API_PROXY_TARGET = "http://127.0.0.1:8810"
$env:ATE_PYTHON = $Python

$FrontendEnv = Join-Path $Root "tools\ate_frontend\.env.local"
$PortableEnv = Join-Path $Root "tools\ate_frontend\env.portable"
if (Test-Path $PortableEnv) {
    Copy-Item $PortableEnv $FrontendEnv -Force
}

$runScript = Join-Path $Root "run_all.py"
Write-Host "Starting local services with: $Python" -ForegroundColor Green
Start-Process -FilePath $Python `
    -ArgumentList @($runScript, "--no-browser", "--desktop") `
    -WorkingDirectory $Root `
    -WindowStyle Normal

Write-Host "Waiting for dashboard (up to 3 minutes on first launch)..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 90; $i++) {
    try {
        $null = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing -TimeoutSec 3
        $ready = $true
        break
    } catch {
        Start-Sleep -Seconds 2
        if ($i % 5 -eq 0) { Write-Host "  still starting..." -ForegroundColor DarkGray }
    }
}

if (-not $ready) {
    Write-Host ""
    Write-Host "Dashboard did not respond on port 3000." -ForegroundColor Red
    Write-Host "Check the Python services window for errors, then try again." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host "Waiting for agent KPI wrappers (8801-8805)..." -ForegroundColor Yellow
$wrapperPorts = [ordered]@{
    8801 = "shmoo_ml"
    8802 = "test_time_opt"
    8803 = "dtl"
    8804 = "retest_reduction"
    8805 = "ra_advisor"
}
$wrapperTotal = $wrapperPorts.Count
$wrapperReady = 0
for ($i = 0; $i -lt 75; $i++) {
    $wrapperReady = 0
    foreach ($entry in $wrapperPorts.GetEnumerator()) {
        try {
            $null = Invoke-WebRequest -Uri "http://127.0.0.1:$($entry.Key)/api/agents/$($entry.Value)/status" -UseBasicParsing -TimeoutSec 2
            $wrapperReady++
        } catch { }
    }
    if ($wrapperReady -ge $wrapperTotal) { break }
    Start-Sleep -Seconds 2
    if ($i % 5 -eq 0) { Write-Host "  agents starting ($wrapperReady/$wrapperTotal)..." -ForegroundColor DarkGray }
}

$DesktopDir = Join-Path $Root "desktop"
if (-not (Test-Path (Join-Path $DesktopDir "node_modules\electron"))) {
    Write-Host "Installing desktop window (Electron, first time only)..." -ForegroundColor Yellow
    Push-Location $DesktopDir
    npm install --no-fund --no-audit 2>&1 | Out-Host
    Pop-Location
}

if (Test-Path (Join-Path $DesktopDir "node_modules\electron\package.json")) {
    Write-Host "Opening desktop app window..." -ForegroundColor Green
    $env:ATE_WINDOW_ONLY = "1"
    Push-Location $DesktopDir
    npm run start
    Pop-Location
} else {
    Write-Host "Opening dashboard in your browser..." -ForegroundColor Green
    Start-Process "http://127.0.0.1:3000"
    Read-Host "Press Enter to close this launcher (services keep running in the other window)"
}
