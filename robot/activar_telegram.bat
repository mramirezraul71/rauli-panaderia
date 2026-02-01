@echo off
title Activar seguimiento Telegram - RAULI
cd /d "%~dp0"
set PY=python
if exist ".venv\Scripts\python.exe" set PY=.venv\Scripts\python.exe
if exist "..\.venv\Scripts\python.exe" set PY=..\.venv\Scripts\python.exe
"%PY%" "%~dp0activar_telegram.py"
pause
