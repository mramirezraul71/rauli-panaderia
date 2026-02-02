# ============================================
# deploy_auto.ps1 - Despliegue Automático Rauli ERP
# ============================================
# Uso: .\deploy_auto.ps1
# O desde CMD: powershell -ExecutionPolicy Bypass -File deploy_auto.ps1

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RAULI ERP - Despliegue Automático" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Preguntar por el mensaje de commit
$mensaje = Read-Host "¿Qué arreglaste? (Enter = 'Actualización automática')"
if ([string]::IsNullOrWhiteSpace($mensaje)) {
    $mensaje = "Actualización automática"
}

# 2. Generar huella de versión
$fechaHora = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
$versionCode = Get-Date -Format "yyyyMMdd.HHmmss"

$versionJson = @{
    version = "1.0.$versionCode"
    build   = $fechaHora
    code    = $versionCode
} | ConvertTo-Json

$backendVersionPath = "backend\version.json"
$versionJson | Set-Content -Path $backendVersionPath -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "  Huella generada: $versionCode" -ForegroundColor Gray
Write-Host "  Guardado en: $backendVersionPath" -ForegroundColor Gray
Write-Host ""

# 3. Ejecutar cadena Git
Write-Host "Ejecutando Git..." -ForegroundColor Yellow

git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: git add falló" -ForegroundColor Red
    exit 1
}

git commit -m "[$mensaje]"
if ($LASTEXITCODE -ne 0) {
    # Puede fallar si no hay cambios
    Write-Host "Nota: No hubo cambios que commitear (o ya estaban commiteados)" -ForegroundColor Gray
} else {
    Write-Host "Commit realizado." -ForegroundColor Green
}

git push origin main
if ($LASTEXITCODE -ne 0) {
    # Intentar con 'maestro' si main no existe
    Write-Host "Intentando con rama 'maestro'..." -ForegroundColor Yellow
    git push origin maestro
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "" 
    Write-Host "       ACTUALIZACIÓN ENVIADA A LA NUBE" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "ERROR: git push falló. Revisa tu conexión y rama remota." -ForegroundColor Red
    exit 1
}
