# Crea keystore para firmar la app Android (Internal testing / Play Store)
# Ejecutar UNA VEZ. Funciona para cualquier usuario.
# La contraseña se puede cambiar con: $env:ANDROID_KEYSTORE_PASSWORD="tu_pass"
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$frontend = Join-Path $root "frontend"
$android = Join-Path $frontend "android"
$keystore = Join-Path $frontend "rauli-upload.keystore"
$desktop = [Environment]::GetFolderPath('Desktop')

if (Test-Path $keystore) {
    Write-Host "Keystore ya existe: $keystore" -ForegroundColor Yellow
    Write-Host "Para crear uno nuevo, borra el archivo primero." -ForegroundColor Gray
    exit 0
}

$pass = if ($env:ANDROID_KEYSTORE_PASSWORD) { $env:ANDROID_KEYSTORE_PASSWORD } else { "rauli2026" }
Write-Host "Creando keystore para Rauli Panaderia..." -ForegroundColor Cyan

$keytool = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
if (-not (Test-Path $keytool)) { $keytool = "keytool" }
& $keytool -genkey -v -keystore $keystore -alias rauli -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $pass -keypass $pass `
    -dname "CN=Rauli Panaderia, OU=Dev, O=Rauli, L=Local, S=Local, C=MX"

# Copiar a android/ para el build
$androidKeystore = Join-Path $android "rauli-upload.keystore"
Copy-Item $keystore $androidKeystore -Force

# Copiar al Escritorio (respaldo, cualquier usuario)
if (Test-Path $desktop) {
    Copy-Item $keystore (Join-Path $desktop "rauli-upload.keystore") -Force
    Write-Host "Copia en Escritorio: $desktop\rauli-upload.keystore" -ForegroundColor Green
}

# keystore.properties (storeFile relativo a android/)
$props = Join-Path $android "keystore.properties"
@"
storePassword=$pass
keyPassword=$pass
keyAlias=rauli
storeFile=rauli-upload.keystore
"@ | Set-Content $props -Encoding UTF8

# Generar bloque para credenciales.txt (cualquier usuario)
$credBlock = @"

# Android (actualizar app / Internal testing)
ANDROID_KEYSTORE_PASSWORD=$pass
ANDROID_KEY_ALIAS=rauli
ANDROID_KEY_PASSWORD=$pass
ANDROID_KEYSTORE_PATH=$($desktop -replace '\\','/')/rauli-upload.keystore
"@
$credPath = Join-Path $root "credenciales_android_add.txt"
$credBlock | Set-Content $credPath -Encoding UTF8
Write-Host "Keystore creado: $keystore" -ForegroundColor Green
Write-Host "keystore.properties generado en android/" -ForegroundColor Green
Write-Host ""
Write-Host "ANADE a tu credenciales.txt el contenido de: credenciales_android_add.txt" -ForegroundColor Yellow
Write-Host "O copia manualmente las lineas ANDROID_* al final de credenciales.txt" -ForegroundColor Yellow
Write-Host ""
Write-Host "IMPORTANTE: Guarda rauli-upload.keystore y la contraseña de forma segura." -ForegroundColor Yellow
