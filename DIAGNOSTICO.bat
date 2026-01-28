@echo off
echo =========================================
echo   GENESIS ERP - Diagnostico del Sistema
echo =========================================
echo.

echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [X] Node.js NO instalado
    echo   Descargalo de: https://nodejs.org
) else (
    echo   [OK] Node.js instalado
    node --version
)

echo.
echo [2/5] Verificando npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [X] npm NO disponible
) else (
    echo   [OK] npm disponible
    npm --version
)

echo.
echo [3/5] Verificando Puerto 3000 (Backend)...
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] Puerto 3000 LIBRE - Backend NO esta corriendo
) else (
    echo   [OK] Puerto 3000 EN USO - Backend corriendo
)

echo.
echo [4/5] Verificando Puerto 5173 (Frontend)...
netstat -ano | findstr :5173 >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] Puerto 5173 LIBRE - Frontend NO esta corriendo
) else (
    echo   [OK] Puerto 5173 EN USO - Frontend corriendo
)

echo.
echo [5/5] Verificando archivos del proyecto...
if exist "%~dp0backend\server.js" (
    echo   [OK] Backend existe
) else (
    echo   [X] Backend NO encontrado
)

if exist "%~dp0frontend\package.json" (
    echo   [OK] Frontend existe
) else (
    echo   [X] Frontend NO encontrado
)

echo.
echo =========================================
echo   Diagnostico Completado
echo =========================================
echo.
echo PROXIMO PASO:
echo.
echo Si Backend NO esta corriendo:
echo   1. Abre una terminal
echo   2. cd C:\dev\RauliERP\backend
echo   3. npm install
echo   4. npm start
echo.
echo Si Frontend NO esta corriendo:
echo   1. Abre otra terminal
echo   2. cd C:\dev\RauliERP\frontend
echo   3. npm install
echo   4. npm run dev
echo.
echo O usa el archivo START_APP.bat para iniciar todo automaticamente
echo.
pause
