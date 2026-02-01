@echo off
chcp 65001 >nul
cd /d "%~dp0"
python scripts\configurar_automatizacion.py
if errorlevel 1 (
  echo.
  echo Revisa credenciales.txt y vuelve a ejecutar.
)
echo.
pause
