# Flujo completo: AAB + mapping + CSV de testers
# 1. Edita config/android_testers.txt con los correos
# 2. Ejecuta este script
# 3. Sube AAB, mapping y testers en Play Console
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=== Publicar Internal Testing - Rauli Panaderia ===" -ForegroundColor Cyan
Write-Host ""

# 1. Generar AAB
Write-Host "[1/3] Generando AAB..." -ForegroundColor Yellow
& (Join-Path $root "scripts\generar_aab.ps1")
if ($LASTEXITCODE -ne 0) { exit 1 }

# 2. Generar CSV de testers
Write-Host "`n[2/3] Generando testers_play.csv..." -ForegroundColor Yellow
& (Join-Path $root "scripts\generar_testers_csv.ps1")

# 3. Resumen
Write-Host "`n[3/3] Archivos listos en raiz del proyecto:" -ForegroundColor Yellow
$version = (Get-Content (Join-Path $root "frontend\src\config\version.js") -Raw) -replace '.*APP_VERSION\s*=\s*"([^"]+)".*','$1'
Get-ChildItem $root -Include "RauliERP*.aab","mapping*.txt","testers_play.csv" -File | ForEach-Object { Write-Host "  - $($_.Name)" }
Write-Host ""
Write-Host "En Play Console:" -ForegroundColor Cyan
Write-Host "  1. Sube RauliERP-Panaderia-$version-release.aab"
Write-Host "  2. Sube mapping-$version.txt (Desofuscacion)"
Write-Host "  3. Crear lista -> Subir testers_play.csv"
Write-Host ""
