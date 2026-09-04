@echo off
REM ============================================================
REM  Keep Living - Vite dev server 守护启动脚本
REM  用法:   scripts\dev-server.cmd           启动并保留日志
REM         scripts\dev-server.cmd --watch    崩溃后自动重启（循环）
REM  日志:   每次启动生成 logs\vite-YYYYMMDD-HHMMSS.log
REM  目的:   Vite 偶发被外部环境终止（无任何报错即消失），
REM          本脚本把 stdout/stderr 落盘 + 记录退出码，
REM          下次再挂可凭日志定位是 Vite 崩还是外部杀。
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0\.."

if not exist logs mkdir logs

for /f "tokens=1-3 delims=/ " %%a in ('echo %date%') do set DD=%%a%%b%%c
for /f "tokens=1-3 delims=:. " %%a in ('echo %time%') do set TT=%%a%%b%%c
set LOG=logs\vite-%DD%-%TT%.log

set WATCH=0
if /i "%~1"=="--watch" set WATCH=1

:loop
echo [%date% %time%] === Starting vite dev server === >> "%LOG%"
node node_modules\vite\bin\vite.js --port 5173 >> "%LOG%" 2>&1
set EXIT=%ERRORLEVEL%
echo [%date% %time%] === Vite exited with code %EXIT% === >> "%LOG%"

if "%EXIT%"=="0" (
  echo Vite stopped normally (exit 0). Log: %LOG%
  exit /b 0
)

echo [WARN] Vite exited abnormally (exit %EXIT%). Last 15 lines:
powershell -NoProfile -Command "Get-Content '%LOG%' -Tail 15"

if "%WATCH%"=="1" (
  echo Auto-restarting in 3s... (Ctrl+C to stop)
  timeout /t 3 /nobreak >nul
  goto loop
)

exit /b %EXIT%
