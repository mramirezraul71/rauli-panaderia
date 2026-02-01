@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === EJECUTAR TODO (Pasos 1, 2, 3 - Automático) ===
echo   1. Push a maestro
echo   2. Deploy Vercel + Railway
echo   3. Verificación
echo.
python scripts\ejecutar_pasos_completos.py
echo.
pause
