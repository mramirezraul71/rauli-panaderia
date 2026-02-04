# Genera el AAB para Internal testing / Play Store
# Funciona para cualquier usuario: busca JAVA_HOME y Android SDK automáticamente
# Requiere: Android Studio o JDK, keystore configurado (scripts/crear_keystore_android.ps1)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$frontend = Join-Path $root "frontend"
$android = Join-Path $frontend "android"

Write-Host "=== Generar AAB RauliERP-Panaderia ===" -ForegroundColor Cyan

# JAVA_HOME: usar si existe, si no Android Studio
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
    $jbr = "C:\Program Files\Android\Android Studio\jbr"
    if (Test-Path $jbr) { $env:JAVA_HOME = $jbr }
}

# 1. Build web
Write-Host "`n[1/4] Build web..." -ForegroundColor Yellow
Push-Location $frontend
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

# 2. Sync Capacitor
Write-Host "[2/4] Sync Capacitor..." -ForegroundColor Yellow
Push-Location $frontend
npx cap sync android 2>&1 | Out-Null
Pop-Location

# 3. Build AAB
Write-Host "[3/4] Build AAB..." -ForegroundColor Yellow
$localProps = Join-Path $android "local.properties"
if (-not (Test-Path $localProps)) {
    $sdk = $env:ANDROID_HOME
    if (-not $sdk) { $sdk = "$env:LOCALAPPDATA\Android\Sdk" }
    if (-not (Test-Path $sdk)) { $sdk = "$env:USERPROFILE\AppData\Local\Android\Sdk" }
    if (Test-Path $sdk) {
        "sdk.dir=$($sdk.Replace('\','\\'))" | Set-Content $localProps
    }
}
Push-Location $android
& .\gradlew.bat bundleRelease 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

# 4. Copiar a raíz
$version = (Get-Content (Join-Path $frontend "src\config\version.js") -Raw) -replace '.*APP_VERSION\s*=\s*"([^"]+)".*','$1'
$src = Join-Path $android "app\build\outputs\bundle\release\app-release.aab"
$dst = Join-Path $root "RauliERP-Panaderia-$version-release.aab"
Copy-Item $src $dst -Force
Write-Host "[4/4] AAB copiado: $dst" -ForegroundColor Green
Write-Host "`nListo para subir a Play Console -> Internal testing" -ForegroundColor Green
