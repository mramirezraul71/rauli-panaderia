#!/bin/bash

# Script de despliegue autónomo - Sistema Rauli-Bot v5.0
source C:/dev/credenciales.txt
echo "🚀 Iniciando despliegue automático Rauli-Bot..."

# Función de notificación por voz
notificar_voz() {
    python -c "import pyttsx3; engine = pyttsx3.init(); engine.say('Atención Comandante: $1'); engine.runAndWait()" 2>/dev/null || echo "🔊 Notificación: $1"
}

# Función de notificación por Telegram
notificar_telegram() {
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
        -d chat_id="$TELEGRAM_ADMIN_CHAT_ID" \
        -d text="🤖 Rauli-Bot: $1" || echo "📱 Error notificación Telegram"
}

# 1. Backup antes de cambios
echo "💾 Creando backup..."
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r . "$BACKUP_DIR/" 2>/dev/null || robocopy . "$BACKUP_DIR" /E /NFL /NDL /NJH /NJS

# 2. Git operations
echo "📡 Sincronizando con GitHub..."
git add .
git commit -m "Auto deploy Rauli-Bot: $(date)"
if git push origin main; then
    notificar_voz "Deploy exitoso"
    notificar_telegram "✅ Deploy exitoso a GitHub"
else
    notificar_voz "Error crítico en deploy"
    notificar_telegram "❌ Error crítico en deploy"
    exit 1
fi

# 3. GitHub operations (si aplica)
if command -v gh &> /dev/null; then
    echo "🔀 Creando PR automático..."
    gh pr create --title "Auto Deploy Rauli-Bot" --body "Despliegue automático $(date)" --assignee @me --draft 2>/dev/null
    gh pr merge --merge --delete-branch 2>/dev/null
fi

# 4. Vercel deployment
if command -v vercel &> /dev/null; then
    echo "🌐 Desplegando a Vercel..."
    if vercel --prod --token "$VERCEL_TOKEN"; then
        notificar_voz "Sitio web actualizado"
        notificar_telegram "🌐 Sitio web desplegado exitosamente"
    else
        notificar_voz "Error en despliegue web"
        notificar_telegram "❌ Error en despliegue Vercel"
    fi
fi

# 5. Verificación de sitio
echo "🔍 Verificando sitio..."
SITE_URL="https://your-app.vercel.app"  # Cambiar según tu URL
if curl -s -o /dev/null -w "%{http_code}" "$SITE_URL" | grep -q "200"; then
    notificar_telegram "✅ Verificación exitosa: $SITE_URL"
else
    notificar_telegram "⚠️ Sitio no responde: $SITE_URL"
fi

echo "✅ Despliegue completado - Sistema Rauli-Bot operativo"
notificar_voz "Sistema operativo"
