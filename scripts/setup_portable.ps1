# One-time setup for offline / USB-portable ATE Intelligence (Windows).
# Requires internet on first run to download Python + Node packages.
# After this, the app runs fully offline via "Start ATE Intelligence".

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

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ATE Intelligence — Portable Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project: $Root`n"

function Require-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $name. Install Python 3.11+ and Node.js 20+ first."
    }
}

Require-Command python
Require-Command npm

$FrontendEnv = Join-Path $Root "tools\ate_frontend\.env.local"
$PortableEnv = Join-Path $Root "tools\ate_frontend\env.portable"
if (Test-Path $PortableEnv) {
    Copy-Item $PortableEnv $FrontendEnv -Force
    Write-Host "Configured offline desktop env -> tools\ate_frontend\.env.local" -ForegroundColor Green
}

$Portable = Join-Path $Root ".portable"
$Venv = Join-Path $Portable "venv"
$Py = Join-Path $Venv "Scripts\python.exe"

if (-not (Test-Path $Py)) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv $Venv
}

Write-Host "Installing Python dependencies (may take several minutes)..." -ForegroundColor Yellow
& $Py -m pip install --upgrade pip
& $Py -m pip install -r (Join-Path $Root "requirements-portable.txt")
Write-Host "Installing PyTorch (CPU) for Dynamic Test Limits agent..." -ForegroundColor Yellow
& $Py -m pip install torch --index-url https://download.pytorch.org/whl/cpu --no-warn-script-location

$NpmDirs = @(
    "tools\ate_frontend",
    "tools\test_time_opt",
    "tools\test_time_opt\client",
    "tools\dtl\frontend",
    "tools\retest_reduction\frontend",
    "tools\retest_reduction\server",
    "tools\ra_advisor-main",
    "desktop"
)

foreach ($rel in $NpmDirs) {
    $dir = Join-Path $Root $rel
    if (Test-Path (Join-Path $dir "package.json")) {
        Write-Host "npm install -> $rel" -ForegroundColor Yellow
        Push-Location $dir
        npm install --no-fund --no-audit
        Pop-Location
    }
}

New-Item -ItemType Directory -Force -Path $Portable | Out-Null
Set-Content -Path (Join-Path $Portable "ready") -Value (Get-Date -Format o)

Write-Host "`nSetup complete." -ForegroundColor Green
Write-Host "You can now double-click: Start ATE Intelligence.bat" -ForegroundColor Green
Write-Host "Copy the entire folder to a USB drive to share (after setup)." -ForegroundColor Green
