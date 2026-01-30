@echo off
cd /d "%~dp0"
set PY=python
if exist ".venv\Scripts\python.exe" set PY=.venv\Scripts\python.exe
if exist "..\.venv\Scripts\python.exe" set PY=..\.venv\Scripts\python.exe
"%PY%" comprobar_captura.py
pause
