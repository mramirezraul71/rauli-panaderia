@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo.
echo === Actualizar en Hub (GitHub), Vercel y cadena (Railway) ===
echo    Push a maestro dispara GitHub Actions: Vercel + Railway + comprobacion
echo.

git add -A
git status -sb
echo.

set MSG=Actualizacion: dashboard movil, bordes y despliegue
if not "%1"=="" set MSG=%*
git diff --cached --quiet 2>nul
if errorlevel 1 (
  git commit -m "%MSG%"
  echo.
  git push origin maestro
  if errorlevel 1 (
    echo.
    echo [ERROR] Push fallo. Configura credenciales de GitHub en esta PC:
    echo   - GitHub Desktop, o
    echo   - git config credential.helper, o
    echo   - Token en HTTPS / SSH key
    pause
    exit /b 1
  )
  echo.
  echo [OK] Subido a GitHub. La cadena (Vercel + Railway) se actualiza en 1-2 min.
) else (
  echo Sin cambios que commitear. Intentando push por si hay commits locales...
  git push origin maestro
  if errorlevel 1 (
    echo Repo ya actualizado con origin/maestro.
  ) else (
    echo [OK] Push realizado. Cadena en marcha.
  )
)
echo.
pause
