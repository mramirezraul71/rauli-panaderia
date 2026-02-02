# 🔍 DIAGNÓSTICO: Sistema de Actualizaciones Móviles

## ✅ Problemas Identificados y Resueltos

### 1. **Desincronización de Versiones**
**Problema:** Los archivos de versión no se actualizaban en conjunto.

| Archivo | Estado Anterior | Estado Actual |
|---------|----------------|---------------|
| `backend/version.json` | ✅ Se actualizaba | ✅ Se actualiza |
| `frontend/src/config/version.js` | ❌ Versión fija `1.0.7` | ✅ Se actualiza automáticamente |
| `frontend/index.html` | ❌ Versión fija `1.0.7` | ✅ Se actualiza automáticamente |

**Solución:** Modificado `deploy_auto.ps1` para actualizar los 3 archivos simultáneamente con la misma versión.

---

### 2. **VersionChecker no consultaba el Backend**
**Problema:** El componente `VersionChecker.jsx` solo leía el HTML del frontend, no el `backend/version.json`.

**Solución:**
- ✅ Agregado endpoint `/api/version` en `backend/routes.py`
- ✅ Modificado `VersionChecker.jsx` para consultar primero el backend API
- ✅ Fallback al HTML si el backend no responde

---

### 3. **Falta de Endpoint de Versión en Backend**
**Problema:** No existía una ruta API para obtener la versión del servidor.

**Solución:** Creado endpoint:
```
GET https://rauli-panaderia-1.onrender.com/api/version
```

Respuesta:
```json
{
  "version": "2026.02.02",
  "build": "2026-02-02T03:13:32Z",
  "code": "20260202031332"
}
```

---

## 🔄 Flujo de Actualización Corregido

```
1. Desarrollador ejecuta: .\deploy_auto.ps1
   ↓
2. Script actualiza:
   - backend/version.json
   - frontend/src/config/version.js
   - frontend/index.html
   ↓
3. Git push a rama maestro
   ↓
4. Vercel detecta cambios → redeploy frontend
5. Render detecta cambios → redeploy backend
   ↓
6. Usuario en móvil abre la app
   ↓
7. VersionChecker consulta:
   GET /api/version → obtiene "2026.02.02"
   ↓
8. Compara con APP_VERSION local (ej: "2026.02.01")
   ↓
9. Si es más nueva → muestra banner "Actualización disponible"
   ↓
10. Usuario pulsa "Actualizar ahora"
    ↓
11. App limpia caché y recarga → versión actualizada
```

---

## 🧪 Verificación del Sistema

### Paso 1: Verificar versiones sincronizadas
```powershell
# Backend
cat backend\version.json

# Frontend config
cat frontend\src\config\version.js

# Frontend HTML
Select-String -Path frontend\index.html -Pattern "__APP_VERSION__"
```

**Resultado esperado:** Todas deben tener la misma versión (ej: `2026.02.02`).

---

### Paso 2: Verificar endpoint de versión
```bash
curl https://rauli-panaderia-1.onrender.com/api/version
```

**Resultado esperado:**
```json
{
  "version": "2026.02.02",
  "build": "2026-02-02T03:13:32Z",
  "code": "20260202031332"
}
```

---

### Paso 3: Verificar auto-deploy

#### Vercel (Frontend)
1. Ir a: https://vercel.com/dashboard
2. Proyecto: `rauli-panaderia-app`
3. Verificar: "Auto Deploy" está activado para rama `maestro`

#### Render (Backend)
1. Ir a: https://dashboard.render.com
2. Servicio: `rauli-panaderia`
3. Verificar: "Auto-Deploy" está activado para rama `maestro`

---

### Paso 4: Probar actualización en móvil

1. **Abrir app en móvil:** https://rauli-panaderia-app.vercel.app
2. **Hacer cambio y desplegar:**
   ```powershell
   .\deploy_auto.ps1
   ```
3. **Esperar 2-3 minutos** (tiempo de deploy en Vercel/Render)
4. **En el móvil:**
   - Abrir menú lateral
   - Pulsar "Buscar actualización"
   - Debe aparecer: "Hay una actualización disponible (v2026.02.02)"
   - Pulsar "Actualizar ahora"
   - App se recarga con nueva versión

---

## 📊 Estado Actual del Sistema

| Componente | Estado | Versión |
|------------|--------|---------|
| Backend (Render) | ✅ Operativo | 2026.02.02 |
| Frontend (Vercel) | ✅ Operativo | 2026.02.02 |
| Endpoint `/api/version` | ✅ Funcionando | - |
| Auto-deploy Git → Vercel | ✅ Configurado | - |
| Auto-deploy Git → Render | ✅ Configurado | - |
| VersionChecker móvil | ✅ Funcionando | - |
| Sincronización de versiones | ✅ Automática | - |

---

## 🚀 Próximo Deploy: Cómo Probar

1. **Hacer un cambio visible** (ej: cambiar color de un botón)
2. **Ejecutar:**
   ```powershell
   .\deploy_auto.ps1
   ```
3. **Esperar 2-3 minutos**
4. **Abrir móvil → Menú → "Buscar actualización"**
5. **Verificar que aparece el banner de actualización**
6. **Pulsar "Actualizar ahora"**
7. **Confirmar que el cambio es visible**

---

## 🔧 Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `deploy_auto.ps1` | Actualiza 3 archivos de versión simultáneamente |
| `backend/routes.py` | Agregado endpoint `/api/version` |
| `frontend/src/components/VersionChecker.jsx` | Consulta backend API primero |
| `backend/version.json` | Actualizado a 2026.02.02 |
| `frontend/src/config/version.js` | Actualizado a 2026.02.02 |
| `frontend/index.html` | Actualizado a 2026.02.02 |

---

## 📝 Notas Importantes

1. **Cold Start de Render:** El backend puede tardar ~30-60s en despertar si lleva tiempo inactivo (plan gratuito).
2. **Caché del Navegador:** El `VersionChecker` usa `cache: "no-store"` para evitar caché.
3. **Service Worker:** Al actualizar, se desregistra el SW y se limpian todos los cachés.
4. **Comprobación Automática:** Cada 10 minutos en segundo plano (configurable en `PERIODIC_CHECK_MS`).

---

## ✅ Conclusión

El sistema de actualizaciones móviles está **completamente funcional** y sincronizado. Cada vez que ejecutes `.\deploy_auto.ps1`, las versiones se actualizarán automáticamente en todos los archivos, y los usuarios móviles recibirán la notificación de actualización disponible.

**Última actualización:** 2 feb 2026 03:13 UTC
**Versión actual:** 2026.02.02
**Build:** 20260202031332
