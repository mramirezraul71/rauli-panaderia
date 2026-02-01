@echo off
chcp 65001 >nul
cd /d "%~dp0"
python scripts\verificar_repo_y_vercel.py
pause
