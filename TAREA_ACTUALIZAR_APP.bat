@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === TAREA COMPLETA: Actualizar app (build + push + deploy + Telegram) ===
echo.
echo 1. Build frontend (version.json + dist)
echo 2. Git add/commit/push a maestro
echo 3. Deploy Vercel + Railway (si hay tokens en Bóveda)
echo 4. Mensaje a Telegram (si hay OMNI_BOT_TELEGRAM_* o TELEGRAM_* en Bóveda)
echo.
echo Bóveda: C:\dev\credenciales.txt (o Escritorio\credenciales.txt)
echo.
python scripts/deploy_y_notificar.py %*
echo.
pause
