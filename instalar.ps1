# ════════════════════════════════════════════════════════════════════════════════
# 🥖 GENESIS - INSTALADOR ROBUSTO
# ════════════════════════════════════════════════════════════════════════════════
# 
# INSTRUCCIONES:
# 1. Guarda RauliERP.zip en tu carpeta Downloads
# 2. Guarda ESTE archivo como "instalar.ps1" en Downloads también
# 3. Abre PowerShell como Administrador
# 4. Ejecuta: cd $env:USERPROFILE\Downloads; .\instalar.ps1
#
# ════════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "GENESIS - Instalador"

Clear-Host
Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   🥖 GENESIS - Instalador                              ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────────────────────────────────────────
$zipPath = "$env:USERPROFILE\Downloads\RauliERP.zip"
$destPath = "C:\RauliERP"

Write-Host "  [INFO] Configuración:" -ForegroundColor Yellow
Write-Host "         ZIP: $zipPath"
Write-Host "         Destino: $destPath"
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────────
# PASO 1: VERIFICAR NODE.JS
# ─────────────────────────────────────────────────────────────────────────────────
Write-Host "  [1/5] Verificando Node.js..." -ForegroundColor Yellow

try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "         ✓ Node.js encontrado: $nodeVersion" -ForegroundColor Green
    } else {
        throw "No encontrado"
    }
} catch {
    Write-Host "         ✗ Node.js NO está instalado" -ForegroundColor Red
    Write-Host ""
    Write-Host "  ══════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  IMPORTANTE: Debes instalar Node.js primero" -ForegroundColor Red
    Write-Host "  Descarga desde: https://nodejs.org" -ForegroundColor Yellow
    Write-Host "  Instala la versión LTS y reinicia PowerShell" -ForegroundColor Yellow
    Write-Host "  ══════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host ""
    Read-Host "  Presiona Enter para salir"
    exit 1
}

try {
    $npmVersion = npm --version 2>$null
    Write-Host "         ✓ NPM encontrado: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "         ✗ NPM no encontrado" -ForegroundColor Red
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────────
# PASO 2: VERIFICAR ZIP
# ─────────────────────────────────────────────────────────────────────────────────
Write-Host "  [2/5] Verificando archivo ZIP..." -ForegroundColor Yellow

if (Test-Path $zipPath) {
    $zipSize = (Get-Item $zipPath).Length / 1KB
    Write-Host "         ✓ Archivo encontrado ($([math]::Round($zipSize, 0)) KB)" -ForegroundColor Green
} else {
    Write-Host "         ✗ No se encontró: $zipPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Asegúrate de que RauliERP.zip está en tu carpeta Downloads" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "  Presiona Enter para salir"
    exit 1
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────────
# PASO 3: DESCOMPRIMIR
# ─────────────────────────────────────────────────────────────────────────────────
Write-Host "  [3/5] Descomprimiendo proyecto..." -ForegroundColor Yellow

try {
    # Eliminar carpeta anterior si existe
    if (Test-Path $destPath) {
        Write-Host "         Eliminando instalación anterior..." -ForegroundColor Gray
        Remove-Item -Path $destPath -Recurse -Force -ErrorAction Stop
    }

    # Crear directorio
    New-Item -ItemType Directory -Path $destPath -Force | Out-Null
    Write-Host "         Carpeta creada: $destPath" -ForegroundColor Gray

    # Descomprimir
    Write-Host "         Extrayendo archivos..." -ForegroundColor Gray
    Expand-Archive -Path $zipPath -DestinationPath $destPath -Force -ErrorAction Stop

    # Verificar si hay subcarpeta
    $items = Get-ChildItem -Path $destPath
    if ($items.Count -eq 1 -and $items[0].PSIsContainer) {
        $subFolder = $items[0].FullName
        if (Test-Path "$subFolder\backend") {
            Write-Host "         Reorganizando estructura..." -ForegroundColor Gray
            Get-ChildItem -Path $subFolder | Move-Item -Destination $destPath -Force
            Remove-Item -Path $subFolder -Force -ErrorAction SilentlyContinue
        }
    }

    # Verificar estructura
    if ((Test-Path "$destPath\backend") -and (Test-Path "$destPath\frontend")) {
        Write-Host "         ✓ Proyecto extraído correctamente" -ForegroundColor Green
    } else {
        Write-Host "         ✗ Estructura incorrecta" -ForegroundColor Red
        Write-Host "         Contenido de $destPath :" -ForegroundColor Gray
        Get-ChildItem $destPath | ForEach-Object { Write-Host "           - $($_.Name)" }
    }
} catch {
    Write-Host "         ✗ Error: $_" -ForegroundColor Red
    Read-Host "  Presiona Enter para salir"
    exit 1
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────────
# PASO 4: INSTALAR DEPENDENCIAS
# ─────────────────────────────────────────────────────────────────────────────────
Write-Host "  [4/5] Instalando dependencias..." -ForegroundColor Yellow
Write-Host "         (Esto puede tardar varios minutos)" -ForegroundColor Gray
Write-Host ""

# Backend
Write-Host "         → Backend:" -ForegroundColor Cyan
Set-Location -Path "$destPath\backend"
Write-Host "           Ejecutando npm install..." -ForegroundColor Gray

$backendResult = Start-Process -FilePath "npm" -ArgumentList "install" -NoNewWindow -Wait -PassThru
if ($backendResult.ExitCode -eq 0) {
    Write-Host "           ✓ Backend OK" -ForegroundColor Green
} else {
    Write-Host "           ⚠ Backend con advertencias (código: $($backendResult.ExitCode))" -ForegroundColor Yellow
}

Write-Host ""

# Frontend
Write-Host "         → Frontend:" -ForegroundColor Cyan
Set-Location -Path "$destPath\frontend"
Write-Host "           Ejecutando npm install..." -ForegroundColor Gray

$frontendResult = Start-Process -FilePath "npm" -ArgumentList "install" -NoNewWindow -Wait -PassThru
if ($frontendResult.ExitCode -eq 0) {
    Write-Host "           ✓ Frontend OK" -ForegroundColor Green
} else {
    Write-Host "           ⚠ Frontend con advertencias (código: $($frontendResult.ExitCode))" -ForegroundColor Yellow
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────────
# PASO 5: CREAR SCRIPTS DE INICIO
# ─────────────────────────────────────────────────────────────────────────────────
Write-Host "  [5/5] Creando scripts de inicio..." -ForegroundColor Yellow

# Script principal de inicio
$startScript = @'
# GENESIS - Iniciar
$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "GENESIS"

Clear-Host
Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   🥖 GENESIS - Iniciando Servidores                    ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$projectPath = "C:\RauliERP"

# Verificar que existen las carpetas
if (-not (Test-Path "$projectPath\backend")) {
    Write-Host "  ERROR: No se encontró la carpeta backend" -ForegroundColor Red
    Read-Host "  Presiona Enter"
    exit
}

# Iniciar Backend
Write-Host "  [1] Iniciando Backend (puerto 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectPath\backend'; Write-Host '═══ GENESIS - BACKEND ═══' -ForegroundColor Green; Write-Host ''; node server.js"

Write-Host "      Esperando 3 segundos..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Iniciar Frontend
Write-Host "  [2] Iniciando Frontend (puerto 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectPath\frontend'; Write-Host '═══ GENESIS - FRONTEND ═══' -ForegroundColor Green; Write-Host ''; npm run dev"

Write-Host "      Esperando 5 segundos..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Abrir navegador
Write-Host "  [3] Abriendo navegador..." -ForegroundColor Yellow
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║   ✓ GENESIS INICIADO                                   ║" -ForegroundColor Green
Write-Host "  ║                                                           ║" -ForegroundColor Green
Write-Host "  ║   Frontend: http://localhost:5173                        ║" -ForegroundColor Green
Write-Host "  ║   Backend:  http://localhost:3001/api                    ║" -ForegroundColor Green
Write-Host "  ║                                                           ║" -ForegroundColor Green
Write-Host "  ║   USUARIOS DE PRUEBA:                                    ║" -ForegroundColor Green
Write-Host "  ║   • admin@rauli.com    / admin123                        ║" -ForegroundColor Green
Write-Host "  ║   • gerente@rauli.com  / gerente123                      ║" -ForegroundColor Green
Write-Host "  ║   • cajero@rauli.com   / cajero123                       ║" -ForegroundColor Green
Write-Host "  ╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Se abrieron 2 ventanas de PowerShell (backend y frontend)." -ForegroundColor Gray
Write-Host "  Para detener: cierra esas ventanas o presiona Ctrl+C en ellas." -ForegroundColor Gray
Write-Host ""
Read-Host "  Presiona Enter para cerrar esta ventana"
'@

$startScriptPath = "$destPath\INICIAR.ps1"
$startScript | Out-File -FilePath $startScriptPath -Encoding UTF8 -Force
Write-Host "         ✓ Script creado: INICIAR.ps1" -ForegroundColor Green

# Crear acceso directo en escritorio
try {
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $shortcutPath = "$desktopPath\GENESIS.lnk"
    
    $WScriptShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WScriptShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$startScriptPath`""
    $Shortcut.WorkingDirectory = $destPath
    $Shortcut.Description = "Iniciar GENESIS"
    $Shortcut.Save()
    
    Write-Host "         ✓ Acceso directo creado en escritorio" -ForegroundColor Green
} catch {
    Write-Host "         ⚠ No se pudo crear acceso directo: $_" -ForegroundColor Yellow
}

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
Write-Host "  Ubicación: $destPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Para iniciar GENESIS:" -ForegroundColor White
Write-Host "  • Doble clic en 'GENESIS' en el escritorio" -ForegroundColor Gray
Write-Host "  • O ejecuta: $startScriptPath" -ForegroundColor Gray
Write-Host ""
Write-Host "  Usuarios de prueba:" -ForegroundColor White
Write-Host "  • admin@rauli.com / admin123" -ForegroundColor Gray
Write-Host "  • gerente@rauli.com / gerente123" -ForegroundColor Gray
Write-Host "  • cajero@rauli.com / cajero123" -ForegroundColor Gray
Write-Host ""

$iniciar = Read-Host "  ¿Deseas iniciar GENESIS ahora? (S/N)"
if ($iniciar -eq "S" -or $iniciar -eq "s" -or $iniciar -eq "") {
    Write-Host ""
    Write-Host "  Iniciando GENESIS..." -ForegroundColor Cyan
    & $startScriptPath
} else {
    Write-Host ""
    Write-Host "  ¡Listo! Usa el acceso directo del escritorio cuando quieras iniciar." -ForegroundColor Green
    Write-Host ""
    Read-Host "  Presiona Enter para cerrar"
}
