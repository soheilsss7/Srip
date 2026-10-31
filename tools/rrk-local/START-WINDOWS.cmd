@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 20 or newer, then run this file again.
  pause
  exit /b 1
)
call npm ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 (
  pause
  exit /b 1
)
call npm start -- --browser chrome --max-pages 10 --max-records 100
pause
