# Abre Play Console y la carpeta con AAB, mapping y testers listos para subir
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Play Console - Rauli Panaderia - Internal testing
$playUrl = "https://play.google.com/console/u/0/developers/5203627511329823036/app/4974720668098955651/tracks/internal-testing"

Write-Host "Abriendo Play Console y carpeta de archivos..." -ForegroundColor Cyan
Start-Process $playUrl
Start-Process "explorer.exe" -ArgumentList "/select,`"$root\RauliERP-Panaderia-2026.02.02-release.aab`""
Start-Sleep -Seconds 2
explorer $root

Write-Host "`nArchivos en $root" -ForegroundColor Yellow
Write-Host "  1. RauliERP-Panaderia-2026.02.02-release.aab  -> Sube en Crear version" -ForegroundColor Gray
Write-Host "  2. mapping-2026.02.02.txt                   -> Sube en detalles de version (desofuscacion)" -ForegroundColor Gray
Write-Host "  3. testers_play.csv                         -> Sube en Crear lista -> Subir archivo CSV" -ForegroundColor Gray
Write-Host "`nPlay Console abierta. Arrastra los archivos o usa los botones Subir." -ForegroundColor Green
