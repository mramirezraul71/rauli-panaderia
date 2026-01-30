# setup_entorno.ps1 — Robot ATLAS (rauli-panaderia)
# Ejecutar desde robot/: .\setup_entorno.ps1

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Robot ATLAS — rauli-panaderia             " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$pip = "pip"
if (Test-Path ".venv\Scripts\pip.exe") { $pip = ".venv\Scripts\pip.exe"; Write-Host "Usando robot\.venv" -ForegroundColor Gray }
elseif (Test-Path "..\.venv\Scripts\pip.exe") { $pip = "..\.venv\Scripts\pip.exe"; Write-Host "Usando .venv raíz" -ForegroundColor Gray }

& $pip install --upgrade pip
& $pip install -r requirements-omni.txt

if ($LASTEXITCODE -ne 0) { Write-Host "Error pip install." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Dependencias OK.                          " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "RECUERDA: ffmpeg.exe en robot/  ->  python robot_instalar_ffmpeg.py --download" -ForegroundColor Red
Write-Host ""
