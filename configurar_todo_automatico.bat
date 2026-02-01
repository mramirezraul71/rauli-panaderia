@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ============================================================
echo   CONFIGURACION AUTOMATICA RAULI - Sin pasos manuales
echo ============================================================
echo.
echo Se configurara:
echo   1. Keep-alive Render (cada 15 min via GitHub)
echo   2. Deploy automatico diario (a las 8:00)
echo   3. Deploy inicial ahora
echo.

:: Verificar que existe el workflow keep-alive
if not exist ".github\workflows\keep-alive-render.yml" (
  echo [ERROR] Falta .github\workflows\keep-alive-render.yml
  pause
  exit /b 1
)

:: 1) Deploy inicial (incluye push del keep-alive si aun no esta en GitHub)
echo --- Ejecutando deploy inicial ---
call scripts\ejecutar_deploy_silencioso.bat
set DEPLOY_OK=%errorlevel%
echo.

:: 2) Crear tarea programada para deploy diario
echo --- Creando tarea programada (deploy diario 8:00) ---
set TASK_NAME=RauliERP_Deploy_Automatico
set SCRIPT_PATH=%~dp0scripts\ejecutar_deploy_silencioso.bat
set LOG_DIR=%~dp0logs
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

schtasks /create /tn "%TASK_NAME%" /tr "\"%SCRIPT_PATH%\"" /sc daily /st 08:00 /f /rl highest
if %errorlevel% equ 0 (
  echo   Tarea "%TASK_NAME%" creada. Se ejecutara cada dia a las 8:00.
) else (
  echo   AVISO: No se pudo crear la tarea. Ejecuta este .bat como Administrador.
  schtasks /create /tn "%TASK_NAME%" /tr "\"%SCRIPT_PATH%\"" /sc daily /st 08:00 /f
  if %errorlevel% equ 0 echo   Tarea creada sin privilegios elevados.
)

echo.
echo ============================================================
echo   CONFIGURACION COMPLETA
echo ============================================================
echo   - Keep-alive: Activo (workflow en GitHub, cada 15 min)
echo   - Deploy diario: 8:00 (Tarea programada de Windows)
echo   - Credenciales: credenciales.txt (GH_TOKEN, VERCEL_TOKEN)
echo.
echo   No se requieren mas pasos manuales.
echo ============================================================
echo.
pause
