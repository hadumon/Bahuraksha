@echo off
title Bahuraksha Demo
echo ============================================
echo   Starting Bahuraksha Demo Environment
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found. Install Python 3.11+
    pause
    exit /b 1
)

:: Check Node
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Install Node.js 22+
    pause
    exit /b 1
)

:: Create data directory if needed
if not exist "bahuraksha-api\data\raw" (
    mkdir "bahuraksha-api\data\raw\rainfall"
    mkdir "bahuraksha-api\data\raw\discharge"
    mkdir "bahuraksha-api\data\raw\sentinel"
    echo Created data directories
)

:: Start API backend in a new window
echo [1/2] Starting API backend on port 8000...
start "Bahuraksha API" cmd /c "cd /d %~dp0bahuraksha-api && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait for API to be ready
echo   Waiting for API to start...
:wait_api
timeout /t 2 /nobreak >nul
python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=2)" >nul 2>&1
if %errorlevel% neq 0 goto wait_api
echo   API is ready!

:: Start frontend dev server in a new window
echo [2/2] Starting frontend on port 8080...
start "Bahuraksha Frontend" cmd /c "cd /d %~dp0 && npm run dev"

echo.
echo ============================================
echo   Demo Environment Running!
echo   Frontend: http://localhost:8080
echo   API:      http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo ============================================
echo.
echo Close this window to stop the demo.
echo (Close the API and Frontend windows separately)
pause
