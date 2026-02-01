# Robot ATLAS — rauli-panaderia. Nunca desconectar.
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$py = "python"
if (Test-Path ".venv\Scripts\python.exe") { $py = ".\.venv\Scripts\python.exe" }
elseif (Test-Path "..\.venv\Scripts\python.exe") { $py = "..\.venv\Scripts\python.exe" }
while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Iniciando bot..."
    & $py .\omni_gestor_proyectos.py
    Write-Host "Reiniciando en 5 s..."
    Start-Sleep -Seconds 5
}
