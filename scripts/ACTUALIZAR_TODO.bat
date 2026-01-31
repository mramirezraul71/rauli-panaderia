@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo.
python scripts/actualizar_todo.py %*
echo.
pause
