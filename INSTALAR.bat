@echo off
chcp 65001 >nul
title GENESIS - Instalador
color 0B

echo.
echo   ╔═══════════════════════════════════════════════════════════╗
echo   ║   GENESIS - Instalador Automatico                      ║
echo   ╚═══════════════════════════════════════════════════════════╝
echo.

:: Verificar Node.js
echo   [1/5] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo         X ERROR: Node.js no esta instalado
    echo.
    echo   Descarga Node.js desde: https://nodejs.org
    echo   Instala la version LTS y vuelve a ejecutar este instalador.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo         OK Node.js: %%i

:: Verificar ZIP
echo.
echo   [2/5] Verificando archivo ZIP...
set "ZIP=%USERPROFILE%\Downloads\RauliERP.zip"
if not exist "%ZIP%" (
    color 0C
    echo         X ERROR: No se encontro RauliERP.zip
    echo         Ruta esperada: %ZIP%
    echo.
    pause
    exit /b 1
)
echo         OK Archivo encontrado

:: Descomprimir
echo.
echo   [3/5] Descomprimiendo proyecto...
set "DEST=C:\RauliERP"

if exist "%DEST%" (
    echo         Eliminando instalacion anterior...
    rmdir /s /q "%DEST%" 2>nul
)

mkdir "%DEST%" 2>nul
echo         Extrayendo archivos...
powershell -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%DEST%' -Force"

:: Reorganizar si es necesario
if exist "%DEST%\rauli-erp\backend" (
    echo         Reorganizando estructura...
    xcopy "%DEST%\rauli-erp\*" "%DEST%\" /E /Y /Q >nul
    rmdir /s /q "%DEST%\rauli-erp" 2>nul
)

if exist "%DEST%\backend" (
    echo         OK Proyecto extraido correctamente
) else (
    color 0C
    echo         X ERROR: Estructura incorrecta
    dir "%DEST%"
    pause
    exit /b 1
)

:: Instalar dependencias backend
echo.
echo   [4/5] Instalando dependencias...
echo         Esto puede tardar varios minutos...
echo.
echo         --- Backend ---
cd /d "%DEST%\backend"
call npm install
if %errorlevel% equ 0 (
    echo         OK Backend instalado
) else (
    echo         ! Backend con advertencias
)

:: Instalar dependencias frontend
echo.
echo         --- Frontend ---
cd /d "%DEST%\frontend"
call npm install
if %errorlevel% equ 0 (
    echo         OK Frontend instalado
) else (
    echo         ! Frontend con advertencias
)

:: Crear script de inicio
echo.
echo   [5/5] Creando accesos directos...

:: Crear INICIAR.bat
(
echo @echo off
echo title GENESIS
echo color 0A
echo echo.
echo echo   Iniciando GENESIS...
echo echo.
echo start "Backend" cmd /k "cd /d C:\RauliERP\backend && node server.js"
echo timeout /t 3 /nobreak ^>nul
echo start "Frontend" cmd /k "cd /d C:\RauliERP\frontend && npm run dev"
echo timeout /t 5 /nobreak ^>nul
echo start http://localhost:5173
echo echo.
echo echo   ══════════════════════════════════════════════════════════
echo echo   GENESIS INICIADO
echo echo   ══════════════════════════════════════════════════════════
echo echo.
echo echo   Frontend: http://localhost:5173
echo echo   Backend:  http://localhost:3001/api
echo echo.
echo echo   Usuarios de prueba:
echo echo   - admin@rauli.com / admin123
echo echo   - gerente@rauli.com / gerente123
echo echo   - cajero@rauli.com / cajero123
echo echo.
echo echo   Para cerrar: cierra las ventanas de Backend y Frontend
echo echo.
echo pause
) > "%DEST%\INICIAR.bat"

echo         OK Script INICIAR.bat creado

:: Crear acceso directo en escritorio
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('%USERPROFILE%\Desktop\GENESIS.lnk'); $sc.TargetPath = 'C:\RauliERP\INICIAR.bat'; $sc.WorkingDirectory = 'C:\RauliERP'; $sc.Save()"
echo         OK Acceso directo creado en escritorio

:: Finalización
echo.
echo   ╔═══════════════════════════════════════════════════════════╗
echo   ║   INSTALACION COMPLETADA                                  ║
echo   ╚═══════════════════════════════════════════════════════════╝
echo.
echo   Ubicacion: C:\RauliERP
echo.
echo   Para iniciar:
echo   - Doble clic en "GENESIS" en el escritorio
echo   - O ejecuta: C:\RauliERP\INICIAR.bat
echo.

set /p INICIAR="  Deseas iniciar GENESIS ahora? (S/N): "
if /i "%INICIAR%"=="S" (
    echo.
    echo   Iniciando...
    start "" "%DEST%\INICIAR.bat"
)

echo.
pause
