# Genera testers_play.csv desde config/android_testers.txt
# Para subir en Play Console -> Prueba interna -> Crear lista -> Subir archivo CSV
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$src = Join-Path $root "config\android_testers.txt"
$dst = Join-Path $root "testers_play.csv"

if (-not (Test-Path $src)) {
    Write-Host "Crea config\android_testers.txt con los correos (uno por linea)" -ForegroundColor Yellow
    $example = Join-Path $root "config\android_testers.txt.example"
    if (Test-Path $example) {
        Copy-Item $example $src
        Write-Host "Creado android_testers.txt desde ejemplo. Editalo y vuelve a ejecutar." -ForegroundColor Cyan
    }
    exit 1
}

$emails = @()
Get-Content $src -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $line -split "[,;\s]+" | Where-Object { $_ -match "@" } | ForEach-Object { $emails += $_.Trim() }
    }
}

$emails = $emails | Select-Object -Unique
if ($emails.Count -eq 0) {
    Write-Host "No hay correos validos en android_testers.txt" -ForegroundColor Yellow
    exit 1
}

# Formato CSV para Play Console (columna email)
"email" | Set-Content $dst -Encoding UTF8
$emails | ForEach-Object { $_ | Add-Content $dst -Encoding UTF8 }
Write-Host "testers_play.csv generado con $($emails.Count) correo(s)" -ForegroundColor Green
Write-Host "  Sube testers_play.csv en Play Console -> Prueba interna -> Lista de correo -> Subir archivo CSV" -ForegroundColor Gray
