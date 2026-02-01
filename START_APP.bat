@echo off
echo =========================================
echo   GENESIS ERP - Iniciando Aplicacion
echo =========================================
echo.

echo [1/3] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js no esta instalado
    echo Descargalo de: https://nodejs.org
    pause
    exit /b 1
)
echo OK: Node.js instalado

echo.
echo [2/3] Iniciando Backend (Puerto 3000)...
start "GENESIS Backend" cmd /k "cd /d %~dp0backend && npm start"

timeout /t 3 /nobreak >nul

echo.
echo [3/3] Iniciando Frontend (Puerto 5173)...
start "GENESIS Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo =========================================
echo   GENESIS ERP - Aplicacion Iniciada
echo =========================================
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Las ventanas de servidor deben permanecer abiertas.
echo Para detener, cierra las ventanas o presiona Ctrl+C
echo.
echo Presiona cualquier tecla para abrir el navegador...
pause >nul

start http://localhost:5173/dashboard

exit
