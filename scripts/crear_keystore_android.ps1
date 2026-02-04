# Crea keystore para firmar la app Android (Internal testing / Play Store)
# Ejecutar una vez. Guarda el keystore y las contraseñas de forma segura.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$frontend = Join-Path $root "frontend"
$keystore = Join-Path $frontend "rauli-upload.keystore"

if (Test-Path $keystore) {
    Write-Host "Keystore ya existe: $keystore" -ForegroundColor Yellow
    Write-Host "Si quieres crear uno nuevo, borra el archivo primero." -ForegroundColor Gray
    exit 0
}

Write-Host "Creando keystore para Rauli Panaderia..." -ForegroundColor Cyan
$keytool = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
if (-not (Test-Path $keytool)) { $keytool = "keytool" }
$pass = "rauli2026"
& $keytool -genkey -v -keystore $keystore -alias rauli -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $pass -keypass $pass `
    -dname "CN=Rauli Panaderia, OU=Dev, O=Rauli, L=Local, S=Local, C=MX"

$props = Join-Path $root "frontend\android\keystore.properties"
$content = @"
storePassword=$pass
keyPassword=$pass
keyAlias=rauli
storeFile=../rauli-upload.keystore
"@
$content | Set-Content $props -Encoding UTF8
Write-Host "Keystore creado: $keystore" -ForegroundColor Green
Write-Host "keystore.properties generado." -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANTE: Guarda una copia de rauli-upload.keystore y la contraseña ($pass) de forma segura." -ForegroundColor Yellow
Write-Host "Sin ellos no podras actualizar la app en Play Store." -ForegroundColor Yellow
