@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === PUBLICAR ANDROID - Rauli Panaderia ===
echo.
powershell -ExecutionPolicy Bypass -File "scripts\publicar_internal_testing.ps1"
if errorlevel 1 exit /b 1
echo.
powershell -ExecutionPolicy Bypass -File "scripts\abrir_play_console_y_archivos.ps1"
echo.
pause
