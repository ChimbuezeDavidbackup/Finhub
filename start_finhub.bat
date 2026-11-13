@echo off
echo ========================================================
echo               STARTING FINHUB APPLICATION
echo ========================================================
echo.

set ROOT_DIR=%~dp0

echo [1/3] Launching Finhub FastAPI Backend on port 8001...
start "Finhub Backend (Port 8001)" cmd /k "cd /d "%ROOT_DIR%backend" && call .\.venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 127.0.0.1 --port 8001"

echo [2/3] Launching Finhub Frontend on port 3000...
start "Finhub Frontend (Port 3000)" cmd /k "cd /d "%ROOT_DIR%frontend" && npm run start"

echo [3/3] Opening application in browser...
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo.
echo ========================================================
echo Finhub is running:
echo   - Web UI: http://localhost:3000
echo   - Backend API & Docs: http://127.0.0.1:8001/docs
echo Close the respective CMD windows to stop the servers.
echo ========================================================
pause
