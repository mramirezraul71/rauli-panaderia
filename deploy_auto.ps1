# ============================================
# deploy_auto.ps1 - Despliegue Automatico Rauli ERP
# ============================================
# Uso: .\deploy_auto.ps1
# O desde CMD: powershell -ExecutionPolicy Bypass -File deploy_auto.ps1

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RAULI ERP - Despliegue Automatico" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Preguntar por el mensaje de commit
$mensaje = Read-Host "Que arreglaste? (Enter = Actualizacion automatica)"
if ([string]::IsNullOrWhiteSpace($mensaje)) {
    $mensaje = "Actualizacion automatica"
}

# 2. Generar huella de version
$fechaHora = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
$versionCode = Get-Date -Format "yyyyMMddHHmmss"
$versionSem = Get-Date -Format "yyyy.MM.dd"

# Backend version.json
$versionJson = @{
    version = $versionSem
    build   = $fechaHora
    code    = $versionCode
} | ConvertTo-Json

$backendVersionPath = "backend\version.json"
$versionJson | Set-Content -Path $backendVersionPath -Encoding UTF8 -NoNewline

# Frontend version.js
$frontendVersionPath = "frontend\src\config\version.js"
$frontendVersionContent = @"
export const APP_VERSION = "$versionSem";

/** Nota visible y provisional: intervalo/fecha de las mejoras implementadas (cambiar al desplegar). */
export const LAST_IMPROVEMENT_NOTE = "Mejoras: $(Get-Date -Format 'd MMM yyyy')";
"@
$frontendVersionContent | Set-Content -Path $frontendVersionPath -Encoding UTF8

# Frontend index.html - actualizar script de version
$indexPath = "frontend\index.html"
if (Test-Path $indexPath) {
    $indexContent = Get-Content -Path $indexPath -Raw -Encoding UTF8
    $indexContent = $indexContent -replace 'window\.__APP_VERSION__="[^"]*"', "window.__APP_VERSION__=`"$versionSem`""
    $indexContent = $indexContent -replace 'window\.__APP_BUILD__="[^"]*"', "window.__APP_BUILD__=`"$fechaHora`""
    $indexContent | Set-Content -Path $indexPath -Encoding UTF8 -NoNewline
}

Write-Host ""
Write-Host "  Huella generada: $versionCode" -ForegroundColor Gray
Write-Host "  Version: $versionSem" -ForegroundColor Gray
Write-Host "  Actualizado:" -ForegroundColor Gray
Write-Host "    - $backendVersionPath" -ForegroundColor Gray
Write-Host "    - $frontendVersionPath" -ForegroundColor Gray
Write-Host "    - $indexPath" -ForegroundColor Gray
Write-Host ""

# 3. Ejecutar cadena Git
Write-Host "Ejecutando Git..." -ForegroundColor Yellow

git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: git add fallo" -ForegroundColor Red
    exit 1
}

git commit -m "[$mensaje]"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Nota: No hubo cambios que commitear" -ForegroundColor Gray
} else {
    Write-Host "Commit realizado." -ForegroundColor Green
}

$rama = git rev-parse --abbrev-ref HEAD 2>$null
if (-not $rama) { $rama = "main" }
git push origin $rama

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "       ACTUALIZACION ENVIADA A LA NUBE" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verificando API (Render puede tardar 1-2 min en redesplegar)..." -ForegroundColor Yellow
    $verifyResult = python "$PSScriptRoot\scripts\verificar_version_api.py" $versionSem --max-wait 120 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host $verifyResult -ForegroundColor Green
        Write-Host "Cadena automatizada OK: API responde v$versionSem" -ForegroundColor Green
    } else {
        Write-Host $verifyResult -ForegroundColor Gray
        Write-Host "Nota: Si Render aun redesplegando, espera 2 min y verifica manualmente:" -ForegroundColor Gray
        Write-Host "  python scripts\verificar_version_api.py $versionSem" -ForegroundColor Gray
    }
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "ERROR: git push fallo. Revisa conexion y rama remota." -ForegroundColor Red
    exit 1
}
