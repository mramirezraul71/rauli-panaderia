@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo.
echo Ejecutando actualizacion (solo Vercel + Railway, sin git)...
echo.
python scripts/actualizar_todo.py --solo-deploy
echo.
pause
