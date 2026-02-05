@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === Actualizar toda la cadena - Rauli Panaderia ===
echo.

echo [1/5] Sincronizando version (incluye Google Play)...
python scripts\bump_version.py --today
if errorlevel 1 (
    echo Error al actualizar version.
    pause
    exit /b 1
)

echo.
echo [2/5] Version actualizada. Incluye: version.js, version.json, build.gradle (Android)
echo.

echo [3/5] Generando AAB para Google Play...
python scripts\actualizar_app_android.py
if errorlevel 1 (
    echo Aviso: AAB puede haber fallado. Revisa keystore/credenciales.
) else (
    echo AAB generado. Sube a Play Console si corresponde.
)
echo.

echo [4/5] ¿Hacer commit y push? (S/N)
set /p DO_PUSH=
if /i "%DO_PUSH%"=="S" (
    git add -A
    git status
    git commit -m "chore: bump version cadena completa + Google Play"
    git push
    echo.
    echo Push realizado. Render y Vercel desplegaran automaticamente.
) else (
    echo Omitting push. Ejecuta: git add -A ^&^& git commit -m "bump" ^&^& git push
)

echo.
echo [5/5] Recordatorio: sube el AAB nuevo a Play Console (Internal testing)
echo === Listo ===
pause
