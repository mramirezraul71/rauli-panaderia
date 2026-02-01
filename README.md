# 🤖 Sistema Rauli-Bot v5.0 - Arquitecto Autónomo

Sistema autónomo de gestión de proyectos con actualizaciones automáticas, backup inteligente y notificaciones multi-canal.

## 📋 Componentes del Sistema

### 1. **autodeploy.sh** - Script de Despliegue Autónomo
- ✅ Backup automático antes de cambios
- 🔊 Notificaciones por voz (pyttsx3)
- 📱 Notificaciones por Telegram
- 🔄 Git operations con manejo de errores
- 🌐 Despliegue automático a Vercel
- 🔍 Verificación post-deploy

### 2. **rauli_updater.py** - Sistema de Actualizaciones
- 🔄 Vigilante automático de actualizaciones
- 📋 Botón manual de búsqueda
- 📝 Changelog antes de actualizar
- 💾 Backup previo a actualización
- 🔄 Rollback automático si falla
- 🧹 Limpieza de caché post-actualización

### 3. **project-manager.py** - Gestor de Proyectos
- 🚀 Workflow completo autónomo
- 💾 Backup por proyecto
- 📡 Creación automática de repos GitHub
- 🌐 Despliegue a Vercel
- ✅ Verificación de sitios activos
- 🤖 Modo vigilante

### 4. **backup_rollback.py** - Sistema de Backup
- 💾 Backup completo con hashes SHA256
- 🔍 Verificación de integridad
- 🔄 Rollback seguro
- 🗑️ Limpieza automática
- 📊 Metadatos de backups

## 🔐 Configuración de Credenciales

El sistema carga automáticamente las credenciales desde:
```
C:\dev\credenciales.txt
```

Variables requeridas:
- `GITHUB_TOKEN` - Token de GitHub
- `VERCEL_TOKEN` - Token de Vercel
- `TELEGRAM_TOKEN` - Bot token de Telegram
- `TELEGRAM_ADMIN_CHAT_ID` - Chat ID para notificaciones

## 🚀 Uso Rápido

### Despliegue Automático
```bash
./autodeploy.sh
```

### Gestor de Proyectos
```bash
python project-manager.py
```

### Actualizador
```bash
# Búsqueda manual
python rauli_updater.py --manual

# Vigilante automático
python rauli_updater.py
```

### Sistema de Backup
```bash
python backup_rollback.py
```

## 📱 Notificaciones

El sistema notifica automáticamente:
- ✅ Éxitos críticos (deploy, actualización)
- ❌ Errores críticos con rollback
- 🔄 Estado del sistema
- 📊 Reportes de verificación

## 🔄 Flujo de Actualización Rauli-Update

1. **Detección**: Vigilante busca nuevas versiones
2. **Notificación**: Alerta por Telegram
3. **Manual**: Botón "BUSCAR ACTUALIZACIÓN"
4. **Changelog**: Muestra cambios pendientes
5. **Backup**: Respaldo automático
6. **Actualización**: Aplica cambios
7. **Verificación**: Confirma éxito
8. **Rollback**: Revierte si hay error
9. **Limpieza**: Borra caché

## 🛡️ Seguridad

- ✅ Sin archivos .env locales
- 🔐 Credenciales centralizadas
- 🔍 Verificación de integridad SHA256
- 🔄 Rollback automático
- 📊 Auditoría completa

## 📦 Dependencias

```bash
pip install pyttsx3 python-dotenv requests
```

## 🎯 Características Principales

### Autonomía Total
- 🤖 Operación sin intervención manual
- 🔄 Recuperación automática de errores
- 📊 Toma de decisiones autónoma

### Calidad Enterprise
- 📈 Monitoreo constante
- 📊 Logs detallados
- 🔍 Verificación post-operación
- 📱 Notificaciones multi-canal

### DevOps Integrado
- 🚀 CI/CD automático
- 🌐 Despliegue zero-touch
- 🔄 Rollback instantáneo
- 📊 Métricas en tiempo real

---

**Sistema Rauli-Bot v5.0 - Arquitecto Autónomo Operativo** 🚀
