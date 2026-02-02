# 🔍 DIAGNÓSTICO: Actualizaciones no funcionaban en Móvil y Web

## ✅ Problemas identificados y corregidos

### 1. **Backend sin endpoint `/api/version` (CRÍTICO)**

**Problema:** El backend Node.js (`server.js`) no tenía la ruta `/api/version`. El `VersionChecker` intentaba consultar ese endpoint y recibía **404**. El `AppUpdater` solo usaba el HTML, que puede verse afectado por caché.

**Solución:** Añadido endpoint `/api/version` en `backend/server.js` que lee `backend/version.json`.

```http
GET https://rauli-panaderia-1.onrender.com/api/version
→ { "version": "2026.02.02", "build": "...", "code": "..." }
```

---

### 2. **Lógica duplicada y divergente**

**Problema:** 
- `AppUpdater` solo consultaba el HTML (`/?t=...`), sin usar la API.
- `VersionChecker` usaba API + fallback HTML, pero cada uno tenía su propia implementación.

**Solución:** Creado `frontend/src/services/versionService.js` compartido:
- `fetchServerVersion()`: intenta API primero, luego HTML.
- `isNewer()`, `parseVersion()`: lógica unificada.
- `AppUpdater` y `VersionChecker` usan el mismo servicio.

---

### 3. **Acceso difícil en móvil**

**Problema:** El panel "ACTUALIZACIONES" estaba solo al final del menú lateral. En móvil, el usuario tenía que abrir el menú y desplazarse mucho para verlo.

**Solución:** Añadido botón **"Buscar actualización"** en la sección Sistema del menú. Al pulsarlo se dispara la comprobación y se cierra el menú.

---

## 📋 Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `backend/server.js` | Añadido `GET /api/version` que lee `version.json` |
| `frontend/src/services/versionService.js` | **Nuevo** – lógica compartida de versiones |
| `frontend/src/components/AppUpdater.jsx` | Usa `versionService` en lugar de lógica propia |
| `frontend/src/components/VersionChecker.jsx` | Usa `versionService` en lugar de lógica propia |
| `frontend/src/App.jsx` | Botón "Buscar actualización" en menú Sistema |

---

## 🚀 Para que funcione en producción

1. **Desplegar los cambios:**
   ```powershell
   .\deploy_auto.ps1
   ```
   Mensaje sugerido: `Arreglo actualizaciones movil y web`

2. **Esperar 2–3 minutos** hasta que Vercel y Render terminen el deploy.

3. **Probar en web:**
   - Abrir https://rauli-panaderia-app.vercel.app
   - Menú → "Buscar actualización" (o panel ACTUALIZACIONES en el lateral)
   - Debe aparecer "Ya tienes la última versión" o el banner si hay nueva versión.

4. **Probar en móvil:**
   - Abrir la app en el navegador del móvil
   - ☰ Menú → "Buscar actualización"
   - Pulsar "Actualizar ahora" si hay actualización disponible.

---

## 🔄 Flujo corregido

```
1. Usuario pulsa "Buscar actualización" (menú o panel)
   ↓
2. versionService.fetchServerVersion()
   → Intenta GET /api/version (Render) ← FUENTE FIABLE
   → Si falla: GET / (HTML de Vercel) como fallback
   ↓
3. Compara versión servidor vs APP_VERSION local
   ↓
4. Si hay nueva versión:
   - VersionChecker: muestra banner fijo arriba
   - AppUpdater: muestra estado "Actualización disponible"
   - Notificación en bandeja
   ↓
5. Usuario pulsa "Actualizar ahora"
   ↓
6. runUpdateNow(): desregistra SW, limpia cachés, recarga
   ↓
7. App carga la nueva versión
```

---

## 📌 Notas

- **Cold start de Render:** La primera petición puede tardar ~30–60 s. El fallback a HTML evita que falle si la API tarda.
- **Service Worker:** El SW trata `/api/version` sin caché para detectar versiones nuevas.
- **Versiones:** `deploy_auto.ps1` sigue actualizando `version.json`, `version.js` e `index.html` en cada deploy.

---

**Fecha:** 2 feb 2026  
**Estado:** Corregido – pendiente de deploy
