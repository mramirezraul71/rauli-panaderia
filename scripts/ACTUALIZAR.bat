@echo off
cd /d "%~dp0.."
echo === Actualizacion completa (Vercel + Railway + comprobacion) ===
echo.
python scripts/deploy_completo.py
echo.
rem Sin pause: ejecucion automatica sin intervencion (cierre al terminar)
