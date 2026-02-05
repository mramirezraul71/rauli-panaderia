# Abre Play Console y la carpeta con AAB, mapping y testers
# Si Play Console da error: espera unos minutos, limpia cache, prueba en modo incognito
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$version = (Get-Content (Join-Path $root "frontend\src\config\version.js") -Raw -ErrorAction SilentlyContinue) -replace '.*APP_VERSION\s*=\s*"([^"]+)".*','$1'
if (-not $version) { $version = "2026.02.02" }

$playUrl = "https://play.google.com/console"
$aab = "RauliERP-Panaderia-$version-release.aab"

Write-Host "Abriendo Play Console y carpeta de archivos..." -ForegroundColor Cyan
Start-Process $playUrl
if (Test-Path (Join-Path $root $aab)) {
    Start-Process "explorer.exe" -ArgumentList "/select,`"$(Join-Path $root $aab)`""
} else {
    explorer $root
}
Start-Sleep -Seconds 1
explorer $root

Write-Host "`n--- Si Play Console da error inesperado ---" -ForegroundColor Yellow
Write-Host "  1. Espera 5-10 min (error temporal de Google)" -ForegroundColor Gray
Write-Host "  2. Prueba modo incognito (Ctrl+Shift+N)" -ForegroundColor Gray
Write-Host "  3. Limpia cache de Chrome" -ForegroundColor Gray
Write-Host "  4. Cierra sesion y vuelve a entrar" -ForegroundColor Gray
Write-Host "`nArchivos a subir:" -ForegroundColor Cyan
Write-Host "  1. $aab          -> Crear version" -ForegroundColor Gray
Write-Host "  2. mapping-$version.txt  -> Desofuscacion" -ForegroundColor Gray
Write-Host "  3. testers_play.csv      -> Crear lista CSV" -ForegroundColor Gray
