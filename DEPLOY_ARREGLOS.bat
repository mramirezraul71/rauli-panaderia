@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ═══════════════════════════════════════════════════════════════
echo   DEPLOY ARREGLOS - Enlace: cada arreglo → actualización
echo ═══════════════════════════════════════════════════════════════
echo.
echo   Tras cualquier arreglo en la app, ejecuta este script.
echo   Sube versión, build, push a maestro, deploy Vercel+Railway.
echo.
python scripts\ejecutar_pasos_completos.py
echo.
pause
