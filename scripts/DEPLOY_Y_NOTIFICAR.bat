@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo.
echo Deploy y notificar: build, subir, desplegar Vercel+Railway, mensaje nueva actualizacion (Telegram).
echo En PC y movil la app detectara la nueva version y mostrara "Actualizar ahora" sin pasos manuales.
echo.
python scripts/deploy_y_notificar.py %*
echo.
pause
