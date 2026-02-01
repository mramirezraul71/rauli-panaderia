@echo off
chcp 65001 >nul
cd /d "%~dp0"
pip install twilio --user --quiet 2>nul
python enviar_whatsapp_vercel.py
pause
