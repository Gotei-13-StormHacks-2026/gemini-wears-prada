$ErrorActionPreference = "Stop"

$RootDir = Split-Path $PSScriptRoot -Parent

Write-Host "==> Setting up backend..."

Set-Location "$RootDir\gwp_backend"

if (-not (Test-Path ".venv")) {
    python -m venv .venv
}

& ".\.venv\Scripts\python.exe" -m pip install --upgrade pip
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt

if (-not (Test-Path ".env.local")) {
    Copy-Item "env.example" ".env.local"

    Write-Host ""
    Write-Host "Created gwp_backend\.env.local"
    Write-Host "Fill in your Supabase and Gemini values before running the app."
}

Write-Host "==> Installing frontend dependencies..."

Set-Location "$RootDir\gwp_frontend"

npm install

Set-Location $RootDir

Write-Host ""
Write-Host "Setup complete."
Write-Host ""
Write-Host "Next:"
Write-Host "  1. Fill in gwp_backend\.env.local"
Write-Host "  2. Run .\dev.ps1"