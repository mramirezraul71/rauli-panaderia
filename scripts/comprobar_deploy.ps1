# Comprobar que el deploy esta listo antes de avisar
# Ejecutar: .\scripts\comprobar_deploy.ps1

$ErrorActionPreference = "Stop"
$base = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=== COMPROBACION PRE-DEPLOY rauli-panaderia ===" -ForegroundColor Cyan

# 1. Build frontend
Write-Host "`n[1] Build frontend..." -ForegroundColor Yellow
Push-Location (Join-Path $base "frontend")
try {
    npm run build 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Build fallo" }
    if (-not (Test-Path "dist/index.html")) { throw "dist/index.html no generado" }
    Write-Host "   OK: Build correcto, dist/ generado" -ForegroundColor Green
} finally {
    Pop-Location
}

# 2. Verificar vercel.json
$vercel = Join-Path $base "frontend\vercel.json"
if (Test-Path $vercel) {
    Write-Host "`n[2] vercel.json presente" -ForegroundColor Green
} else {
    Write-Host "`n[2] ADVERTENCIA: vercel.json no encontrado" -ForegroundColor Red
}

# 3. URLs esperadas
Write-Host "`n[3] URLs esperadas:" -ForegroundColor Yellow
Write-Host "   Frontend: https://rauli-panaderia-app.vercel.app"
Write-Host "   Backend:  https://rauli-panaderia.onrender.com"

Write-Host "`n=== Listo para deploy. Push a main para que Vercel/Render actualicen. ===" -ForegroundColor Cyan
