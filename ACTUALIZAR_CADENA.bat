@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === Actualizar toda la cadena - Rauli Panaderia ===
echo.

echo [1/4] Sincronizando version a hoy...
python scripts\bump_version.py --today
if errorlevel 1 (
    echo Error al actualizar version.
    pause
    exit /b 1
)

echo.
echo [2/4] Version actualizada. Archivos modificados:
echo   - frontend/src/config/version.js
echo   - backend/version.json
echo   - frontend/public/version.json
echo   - frontend/index.html
echo   - backend/main.py
echo   - frontend/android/app/build.gradle
echo.

echo [3/4] Para desplegar en todos los sitios:
echo   - Git: git add -A ^&^& git commit -m "chore: bump v" ^&^& git push
echo   - Eso dispara: Render (backend) + Vercel (frontend)
echo   - Proxy: node deploy_network.js  (si cambias backend)
echo.

echo [4/4] ¿Hacer commit y push ahora? (S/N)
set /p DO_PUSH=
if /i "%DO_PUSH%"=="S" (
    git add -A
    git status
    git commit -m "chore: bump version cadena completa"
    git push
    echo.
    echo Push realizado. Render y Vercel desplegaran automaticamente.
) else (
    echo Omitting push. Ejecuta manualmente: git add -A ^&^& git commit -m "bump" ^&^& git push
)

echo.
echo === Listo ===
pause
