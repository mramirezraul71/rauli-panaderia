@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === ACTUALIZACION AUTOMATICA RAULI ===
echo Build + Push GitHub + Deploy Vercel + Railway
echo.
python scripts/deploy_y_notificar.py
echo.
if errorlevel 1 (
  echo Fallo en el script. Revisa credenciales.txt (VERCEL_TOKEN, GH_TOKEN).
) else (
  echo Listo. App: https://rauli-panaderia-app.vercel.app
)
echo.
pause
