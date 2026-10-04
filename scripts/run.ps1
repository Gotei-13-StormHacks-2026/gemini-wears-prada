$ErrorActionPreference = "Stop"

$RootDir = Split-Path $PSScriptRoot -Parent

Write-Host "==> Starting backend..."

$BackendDir = Join-Path $RootDir "gwp_backend"

$BackendProcess = Start-Process `
    -FilePath "$BackendDir\.venv\Scripts\python.exe" `
    -ArgumentList "-m uvicorn app.main:app --reload --env-file .env.local" `
    -WorkingDirectory $BackendDir `
    -PassThru

Write-Host "==> Starting frontend..."

$FrontendDir = Join-Path $RootDir "gwp_frontend"

$FrontendProcess = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList "run dev" `
    -WorkingDirectory $FrontendDir `
    -PassThru

Write-Host ""
Write-Host "Backend:  http://127.0.0.1:8000"
Write-Host "Frontend: http://localhost:5173"
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers."

try {
    while (-not $BackendProcess.HasExited -and -not $FrontendProcess.HasExited) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host ""
    Write-Host "==> Stopping development servers..."

    if (-not $BackendProcess.HasExited) {
        Stop-Process -Id $BackendProcess.Id -Force
    }

    if (-not $FrontendProcess.HasExited) {
        Stop-Process -Id $FrontendProcess.Id -Force
    }
}