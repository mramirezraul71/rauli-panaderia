#!/usr/bin/env pwsh

# Script de despliegue autónomo - Sistema Rauli-Bot v5.0 (PowerShell)
$credencialesPath = "C:\dev\credenciales.txt"
if (Test-Path $credencialesPath) {
    Get-Content $credencialesPath | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

Write-Host "🚀 Iniciando despliegue automático Rauli-Bot..."

# Función de notificación por voz
function Notificar-Voz {
    param([string]$mensaje)
    try {
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $synth.Speak("Atención Comandante: $mensaje") | Out-Null
    } catch {
        Write-Host "🔊 Notificación: $mensaje"
    }
}

# Función de notificación por Telegram
function Notificar-Telegram {
    param([string]$mensaje)
    try {
        $token = $env:TELEGRAM_TOKEN
        $chatId = $env:TELEGRAM_ADMIN_CHAT_ID
        if ($token -and $chatId) {
            $response = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/sendMessage" -Method POST -Body @{
                chat_id = $chatId
                text = "🤖 Rauli-Bot: $mensaje"
            }
        } else {
            Write-Host "📱 Telegram no configurado"
        }
    } catch {
        Write-Host "📱 Error notificación Telegram: $_"
    }
}

# 1. Backup antes de cambios
Write-Host "💾 Creando backup..."
$backupDir = ".\backups\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item -Path ".\*" -Destination $backupDir -Recurse -Force

# 2. Git operations
Write-Host "📡 Sincronizando con GitHub..."
git add .
$commitMessage = "Auto deploy Rauli-Bot: $(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')"
git commit -m $commitMessage
if ($LASTEXITCODE -eq 0) {
    $pushResult = git push origin main
    if ($LASTEXITCODE -eq 0) {
        Notificar-Voz "Deploy exitoso"
        Notificar-Telegram "✅ Deploy exitoso a GitHub"
    } else {
        Notificar-Voz "Error crítico en deploy"
        Notificar-Telegram "❌ Error crítico en deploy"
        exit 1
    }
}

# 3. GitHub operations (si aplica)
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Host "🔀 Creando PR automático..."
    try {
        gh pr create --title "Auto Deploy Rauli-Bot" --body "Despliegue automático $(Get-Date)" --assignee "@me" --draft 2>$null
        gh pr merge --merge --delete-branch 2>$null
    } catch {
        Write-Host "GitHub CLI operations skipped"
    }
}

# 4. Vercel deployment
if (Get-Command vercel -ErrorAction SilentlyContinue) {
    Write-Host "🌐 Desplegando a Vercel..."
    $vercelToken = $env:VERCEL_TOKEN
    if ($vercelToken) {
        $deployResult = vercel --prod --token $vercelToken
        if ($LASTEXITCODE -eq 0) {
            Notificar-Voz "Sitio web actualizado"
            Notificar-Telegram "🌐 Sitio web desplegado exitosamente"
        } else {
            Notificar-Voz "Error en despliegue web"
            Notificar-Telegram "❌ Error en despliegue Vercel"
        }
    }
}

# 5. Verificación de sitio
Write-Host "🔍 Verificando sitio..."
$siteUrl = "https://rauli-panaderia-app.vercel.app"
try {
    $response = Invoke-WebRequest -Uri $siteUrl -Method GET -TimeoutSec 30
    if ($response.StatusCode -eq 200) {
        Notificar-Telegram "✅ Verificación exitosa: $siteUrl"
        Write-Host "✅ Sitio responde correctamente"
    } else {
        Notificar-Telegram "⚠️ Sitio responde con código $($response.StatusCode): $siteUrl"
        Write-Host "⚠️ Sitio responde con código $($response.StatusCode)"
    }
} catch {
    Notificar-Telegram "❌ Sitio no responde: $siteUrl"
    Write-Host "❌ Sitio no responde: $_"
}

Write-Host "✅ Despliegue completado - Sistema Rauli-Bot operativo"
Notificar-Voz "Sistema operativo"
