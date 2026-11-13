Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "              STARTING FINHUB APPLICATION               " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$RootDir = $PSScriptRoot

Write-Host "[1/3] Launching Finhub FastAPI Backend on port 8001..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RootDir\backend'; .\.venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --host 127.0.0.1 --port 8001"

Write-Host "[2/3] Launching Finhub Next.js Frontend on port 3000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RootDir\frontend'; npm run start"

Write-Host "[3/3] Opening application in browser..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Finhub is running:" -ForegroundColor White
Write-Host "  - Web UI: http://localhost:3000" -ForegroundColor White
Write-Host "  - Backend API: http://127.0.0.1:8001/docs" -ForegroundColor White
Write-Host "Close the respective terminal windows to stop the servers." -ForegroundColor Gray
Write-Host "========================================================" -ForegroundColor Cyan
