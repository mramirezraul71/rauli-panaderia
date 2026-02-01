@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === DEPLOY DIRECTO A VERCEL (sin Git) ===
echo Build local + upload dist. No depende de GitHub.
echo.
python scripts\vercel_deploy_directo.py
echo.
pause
