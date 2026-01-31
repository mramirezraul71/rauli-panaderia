@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo.
python scripts/setup_una_vez.py %*
echo.
pause
