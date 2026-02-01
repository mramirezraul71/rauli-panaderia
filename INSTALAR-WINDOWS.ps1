# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║                                                                               ║
# ║   🥖 GENESIS - Script de Instalación Automática para Windows               ║
# ║   ───────────────────────────────────────────────────────────────────────────  ║
# ║   Este script configura todo el entorno de desarrollo automáticamente        ║
# ║                                                                               ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝

param(
    [string]$ZipPath = "$env:USERPROFILE\Downloads\RauliERP.zip",
    [string]$InstallPath = "C:\RauliERP"
)

# Configuración de colores
$Host.UI.RawUI.WindowTitle = "GENESIS - Instalador"

function Write-Banner {
    Write-Host ""
    Write-Host "  ╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║                                                           ║" -ForegroundColor Cyan
    Write-Host "  ║   🥖 GENESIS - Instalador Automático                   ║" -ForegroundColor Cyan
    Write-Host "  ║   Sistema de Gestión para Panaderías                     ║" -ForegroundColor Cyan
    Write-Host "  ║                                                           ║" -ForegroundColor Cyan
    Write-Host "  ╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Message, [string]$Status = "INFO")
    $color = switch ($Status) {
        "OK"    { "Green" }
        "WARN"  { "Yellow" }
        "ERROR" { "Red" }
        "INFO"  { "Cyan" }
        default { "White" }
    }
    $icon = switch ($Status) {
        "OK"    { "✓" }
        "WARN"  { "⚠" }
        "ERROR" { "✗" }
        "INFO"  { "→" }
        default { "•" }
    }
    Write-Host "  [$icon] $Message" -ForegroundColor $color
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-NodeJS {
    try {
        $nodeVersion = & node --version 2>$null
        if ($nodeVersion) {
            $versionNum = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
            return @{ Installed = $true; Version = $nodeVersion; VersionNum = $versionNum }
        }
    } catch {}
    return @{ Installed = $false; Version = $null; VersionNum = 0 }
}

function Test-NPM {
    try {
        $npmVersion = & npm --version 2>$null
        if ($npmVersion) {
            return @{ Installed = $true; Version = $npmVersion }
        }
    } catch {}
    return @{ Installed = $false; Version = $null }
}

function Install-NodeJS {
    Write-Step "Descargando Node.js LTS..." "INFO"
    
    $nodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
    $installerPath = "$env:TEMP\node-installer.msi"
    
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $nodeUrl -OutFile $installerPath -UseBasicParsing
        
        Write-Step "Instalando Node.js (esto puede tardar unos minutos)..." "INFO"
        Start-Process msiexec.exe -Wait -ArgumentList "/i `"$installerPath`" /quiet /norestart"
        
        # Actualizar PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
        
        return $true
    } catch {
        Write-Step "Error instalando Node.js: $_" "ERROR"
        return $false
    }
}

function Install-Chocolatey {
    Write-Step "Instalando Chocolatey (gestor de paquetes)..." "INFO"
    try {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        return $true
    } catch {
        return $false
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# INICIO DEL SCRIPT
# ═══════════════════════════════════════════════════════════════════════════════

Clear-Host
Write-Banner

Write-Host "  Configuración:" -ForegroundColor White
Write-Host "  • Archivo ZIP: $ZipPath" -ForegroundColor Gray
Write-Host "  • Destino: $InstallPath" -ForegroundColor Gray
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────────
# PASO 1: Verificar archivo ZIP
# ─────────────────────────────────────────────────────────────────────────────────
Write-Host "  ┌─ PASO 1: Verificando archivo ZIP" -ForegroundColor Yellow
Write-Host "  │" -ForegroundColor DarkGray

if (-not (Test-Path $ZipPath)) {
    Write-Step "Archivo ZIP no encontrado en: $ZipPath" "ERROR"
    Write-Host ""
    Write-Host "  Por favor, asegúrate de que el archivo RauliERP.zip" -ForegroundColor Red
    Write-Host "  está en tu carpeta de Downloads." -ForegroundColor Red
    Write-Host ""
    Read-Host "  Presiona Enter para salir"
    exit 1
}
Write-Step "Archivo ZIP encontrado" "OK"
Write-Host "  │" -ForegroundColor DarkGray
Write-Host "  └─ Completado" -ForegroundColor Green
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────────
# PASO 2: Verificar Node.js
# ─────────────────────────────────────────────────────────────────────────────────
Write-Host "  ┌─ PASO 2: Verificando Node.js" -ForegroundColor Yellow
Write-Host "  │" -ForegroundColor DarkGray

$nodeStatus = Test-NodeJS
if ($nodeStatus.Installed) {
    if ($nodeStatus.VersionNum -ge 18) {
        Write-Step "Node.js $($nodeStatus.Version) instalado (OK)" "OK"
    } else {
        Write-Step "Node.js $($nodeStatus.Version) instalado (versión antigua)" "WARN"
        Write-Step "Se recomienda Node.js 18 o superior" "WARN"
    }
} else {
    Write-Step "Node.js no encontrado" "WARN"
    
    $installNode = Read-Host "  ¿Deseas instalar Node.js automáticamente? (S/N)"
    if ($installNode -eq "S" -or $installNode -eq "s") {
        if (-not (Test-Administrator)) {
            Write-Step "Se requieren permisos de administrador para instalar Node.js" "ERROR"
            Write-Host ""
            Write-Host "  Por favor, ejecuta PowerShell como Administrador y vuelve a ejecutar el script." -ForegroundColor Red
            Write-Host ""
            Read-Host "  Presiona Enter para salir"
            exit 1
        }
        
        if (Install-NodeJS) {
            Write-Step "Node.js instalado correctamente" "OK"
            Write-Step "Reinicia PowerShell después de la instalación" "WARN"
        } else {
            Write-Step "No se pudo instalar Node.js automáticamente" "ERROR"
            Write-Host ""
            Write-Host "  Instala Node.js manualmente desde: https://nodejs.org" -ForegroundColor Yellow
            Write-Host ""
            Read-Host "  Presiona Enter para salir"
            exit 1
        }
    } else {
        Write-Host ""
        Write-Host "  Node.js es necesario. Instálalo desde: https://nodejs.org" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "  Presiona Enter para salir"
        exit 1
    }
}

$npmStatus = Test-NPM
if ($npmStatus.Installed) {
    Write-Step "NPM $($npmStatus.Version) instalado" "OK"
} else {
    Write-Step "NPM no encontrado (viene con Node.js)" "ERROR"
}

Write-Host "  │" -ForegroundColor DarkGray
Write-Host "  └─ Completado" -ForegroundColor Green
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────────
# PASO 3: Crear directorio e instalar
# ─────────────────────────────────────────────────────────────────────────────────
Write-Host "  ┌─ PASO 3: Instalando GENESIS" -ForegroundColor Yellow
Write-Host "  │" -ForegroundColor DarkGray

# Limpiar instalación anterior si existe
if (Test-Path $InstallPath) {
    Write-Step "Limpiando instalación anterior..." "INFO"
    Remove-Item -Path $InstallPath -Recurse -Force -ErrorAction SilentlyContinue
}

# Crear directorio
Write-Step "Creando directorio: $InstallPath" "INFO"
New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null

# Descomprimir
Write-Step "Descomprimiendo proyecto..." "INFO"
try {
    Expand-Archive -Path $ZipPath -DestinationPath $InstallPath -Force
    Write-Step "Proyecto descomprimido correctamente" "OK"
} catch {
    Write-Step "Error al descomprimir: $_" "ERROR"
    exit 1
}

# Verificar estructura
$backendPath = Join-Path $InstallPath "backend"
$frontendPath = Join-Path $InstallPath "frontend"

if (-not (Test-Path $backendPath) -or -not (Test-Path $frontendPath)) {
    # Puede que esté en una subcarpeta
    $subfolders = Get-ChildItem -Path $InstallPath -Directory | Select-Object -First 1
    if ($subfolders) {
        $subPath = $subfolders.FullName
        if ((Test-Path (Join-Path $subPath "backend")) -and (Test-Path (Join-Path $subPath "frontend"))) {
            Write-Step "Reorganizando estructura de carpetas..." "INFO"
            Get-ChildItem -Path $subPath | Move-Item -Destination $InstallPath -Force
            Remove-Item -Path $subPath -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "  │" -ForegroundColor DarkGray
Write-Host "  └─ Completado" -ForegroundColor Green
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────────
# PASO 4: Instalar dependencias
# ─────────────────────────────────────────────────────────────────────────────────
Write-Host "  ┌─ PASO 4: Instalando dependencias" -ForegroundColor Yellow
Write-Host "  │" -ForegroundColor DarkGray

# Backend
Write-Step "Instalando dependencias del backend..." "INFO"
Set-Location -Path (Join-Path $InstallPath "backend")
$backendInstall = Start-Process -FilePath "npm" -ArgumentList "install" -NoNewWindow -Wait -PassThru
if ($backendInstall.ExitCode -eq 0) {
    Write-Step "Dependencias del backend instaladas" "OK"
} else {
    Write-Step "Error instalando dependencias del backend" "WARN"
}

# Frontend
Write-Step "Instalando dependencias del frontend (esto puede tardar)..." "INFO"
Set-Location -Path (Join-Path $InstallPath "frontend")
$frontendInstall = Start-Process -FilePath "npm" -ArgumentList "install" -NoNewWindow -Wait -PassThru
if ($frontendInstall.ExitCode -eq 0) {
    Write-Step "Dependencias del frontend instaladas" "OK"
} else {
    Write-Step "Error instalando dependencias del frontend" "WARN"
}

Write-Host "  │" -ForegroundColor DarkGray
Write-Host "  └─ Completado" -ForegroundColor Green
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────────
# PASO 5: Crear scripts de inicio
# ─────────────────────────────────────────────────────────────────────────────────
Write-Host "  ┌─ PASO 5: Creando scripts de inicio" -ForegroundColor Yellow
Write-Host "  │" -ForegroundColor DarkGray

# Script para iniciar todo
$startScript = @'
# GENESIS - Iniciar Desarrollo
$Host.UI.RawUI.WindowTitle = "GENESIS - Servidor"

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   🥖 GENESIS - Iniciando Servidores                    ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# Iniciar Backend en nueva ventana
Write-Host "  [→] Iniciando Backend (puerto 3001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectPath\backend'; Write-Host '🥖 Backend Server' -ForegroundColor Green; node server.js"

Start-Sleep -Seconds 2

# Iniciar Frontend en nueva ventana
Write-Host "  [→] Iniciando Frontend (puerto 5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectPath\frontend'; Write-Host '🥖 Frontend Dev Server' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 3

# Abrir navegador
Write-Host "  [→] Abriendo navegador..." -ForegroundColor Cyan
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║   ✓ GENESIS está listo                                 ║" -ForegroundColor Green
Write-Host "  ║                                                           ║" -ForegroundColor Green
Write-Host "  ║   Frontend: http://localhost:5173                        ║" -ForegroundColor Green
Write-Host "  ║   Backend:  http://localhost:3001/api                    ║" -ForegroundColor Green
Write-Host "  ║                                                           ║" -ForegroundColor Green
Write-Host "  ║   Usuarios de prueba:                                    ║" -ForegroundColor Green
Write-Host "  ║   • admin@rauli.com / admin123                           ║" -ForegroundColor Green
Write-Host "  ║   • gerente@rauli.com / gerente123                       ║" -ForegroundColor Green
Write-Host "  ║   • cajero@rauli.com / cajero123                         ║" -ForegroundColor Green
Write-Host "  ╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Presiona cualquier tecla para cerrar esta ventana..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
'@

$startScriptPath = Join-Path $InstallPath "INICIAR-RAULI-ERP.ps1"
$startScript | Out-File -FilePath $startScriptPath -Encoding UTF8
Write-Step "Script de inicio creado: INICIAR-RAULI-ERP.ps1" "OK"

# Crear acceso directo en escritorio
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "GENESIS.lnk"

try {
    $WScriptShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WScriptShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$startScriptPath`""
    $Shortcut.WorkingDirectory = $InstallPath
    $Shortcut.IconLocation = "powershell.exe,0"
    $Shortcut.Description = "Iniciar GENESIS"
    $Shortcut.Save()
    Write-Step "Acceso directo creado en el escritorio" "OK"
} catch {
    Write-Step "No se pudo crear acceso directo: $_" "WARN"
}

# Script solo backend
$backendOnlyScript = @'
$Host.UI.RawUI.WindowTitle = "GENESIS - Backend"
Write-Host "🥖 GENESIS - Backend Server" -ForegroundColor Green
Write-Host "Puerto: 3001" -ForegroundColor Gray
Write-Host ""
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location backend
node server.js
'@
$backendOnlyScript | Out-File -FilePath (Join-Path $InstallPath "iniciar-backend.ps1") -Encoding UTF8

# Script solo frontend
$frontendOnlyScript = @'
$Host.UI.RawUI.WindowTitle = "GENESIS - Frontend"
Write-Host "🥖 GENESIS - Frontend Dev Server" -ForegroundColor Green
Write-Host "Puerto: 5173" -ForegroundColor Gray
Write-Host ""
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location frontend
npm run dev
'@
$frontendOnlyScript | Out-File -FilePath (Join-Path $InstallPath "iniciar-frontend.ps1") -Encoding UTF8

Write-Step "Scripts adicionales creados" "OK"

Write-Host "  │" -ForegroundColor DarkGray
Write-Host "  └─ Completado" -ForegroundColor Green
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────────
# FINALIZACIÓN
# ─────────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║                                                           ║" -ForegroundColor Green
Write-Host "  ║   ✓ INSTALACIÓN COMPLETADA                               ║" -ForegroundColor Green
Write-Host "  ║                                                           ║" -ForegroundColor Green
Write-Host "  ╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Ubicación del proyecto:" -ForegroundColor White
Write-Host "  $InstallPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Para iniciar GENESIS:" -ForegroundColor White
Write-Host "  • Doble clic en 'GENESIS' en el escritorio" -ForegroundColor Gray
Write-Host "  • O ejecuta: $startScriptPath" -ForegroundColor Gray
Write-Host ""
Write-Host "  Archivos creados:" -ForegroundColor White
Write-Host "  • INICIAR-RAULI-ERP.ps1 - Inicia todo el sistema" -ForegroundColor Gray
Write-Host "  • iniciar-backend.ps1   - Solo el servidor API" -ForegroundColor Gray
Write-Host "  • iniciar-frontend.ps1  - Solo la interfaz web" -ForegroundColor Gray
Write-Host ""

$iniciarAhora = Read-Host "  ¿Deseas iniciar GENESIS ahora? (S/N)"
if ($iniciarAhora -eq "S" -or $iniciarAhora -eq "s") {
    Write-Host ""
    Write-Host "  Iniciando GENESIS..." -ForegroundColor Cyan
    & $startScriptPath
} else {
    Write-Host ""
    Write-Host "  ¡Listo! Puedes iniciar GENESIS cuando quieras." -ForegroundColor Green
    Write-Host ""
}
