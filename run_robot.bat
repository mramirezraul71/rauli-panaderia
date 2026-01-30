@echo off
REM Ejecuta robot con mision de rauli-panaderia
REM Requiere: RauliERP en c:\dev\RauliERP con robot_ultimate.py
REM Y omni_telegram.env configurado para ver el robot trabajar (Telegram + voz)

cd /d "%~dp0"
set RERP=c:\dev\RauliERP
if exist "%RERP%\robot_ultimate.py" (
  echo Usando robot de RauliERP...
  copy /Y mision_pendiente.txt "%RERP%\mision_pendiente.txt"
  cd /d "%RERP%"
  python robot_ultimate.py -m
) else (
  echo RauliERP no encontrado en %RERP%
  echo Instala/clona RauliERP y configura robot_ultimate + omni_telegram.env
  pause
)
