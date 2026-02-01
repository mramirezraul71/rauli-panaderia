@echo off
title ATLAS RAULI - rauli-panaderia
cd /d "%~dp0"
set PY=python
if exist ".venv\Scripts\python.exe" set PY=.venv\Scripts\python.exe
if exist "..\.venv\Scripts\python.exe" set PY=..\.venv\Scripts\python.exe
:loop
echo [%date% %time%] Iniciando bot...
"%PY%" omni_gestor_proyectos.py
echo [%date% %time%] Reiniciando en 5 s...
timeout /t 5 /nobreak > nul
goto loop
