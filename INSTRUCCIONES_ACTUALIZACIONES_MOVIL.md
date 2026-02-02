# 📱 INSTRUCCIONES: Cómo Probar Actualizaciones en Móvil

## ✅ Sistema Completamente Funcional

El sistema de actualizaciones móviles está **operativo al 100%**. Aquí te explico cómo probarlo.

---

## 🚀 Paso a Paso: Probar Actualización

### 1️⃣ Hacer un Cambio Visible en la App

Abre cualquier archivo del frontend y haz un cambio que puedas ver. Por ejemplo:

```jsx
// Archivo: frontend/src/pages/Dashboard.jsx
// Busca la línea del título y agrégale algo

<h1 className="text-3xl font-bold">
  Dashboard RAULI - Versión Actualizada ✨
</h1>
```

O cambia un color, agrega un emoji, lo que sea visible.

---

### 2️⃣ Desplegar los Cambios

Abre PowerShell en la carpeta del proyecto y ejecuta:

```powershell
.\deploy_auto.ps1
```

Te preguntará: **"Que arreglaste?"**

Escribe algo como:
```
Prueba de actualizaciones movil
```

El script:
- ✅ Actualizará las versiones automáticamente
- ✅ Hará commit a Git
- ✅ Hará push a GitHub
- ✅ Vercel y Render detectarán los cambios y redesplegarán

**Tiempo estimado:** 2-3 minutos

---

### 3️⃣ Esperar el Redeploy

Mientras esperas, puedes verificar el progreso:

- **Vercel:** https://vercel.com/dashboard
- **Render:** https://dashboard.render.com

Verás los deploys en progreso.

---

### 4️⃣ Probar en el Móvil

#### Opción A: Búsqueda Manual

1. **Abre la app en tu móvil:**
   ```
   https://rauli-panaderia-app.vercel.app
   ```

2. **Abre el menú lateral** (☰ arriba a la izquierda)

3. **Busca el botón "Buscar actualización"** (debería estar en el menú)

4. **Púlsalo**

5. **Deberías ver:**
   ```
   🔄 Hay una actualización disponible (v2026.02.02)
   [Actualizar ahora]
   ```

6. **Pulsa "Actualizar ahora"**

7. **La app se recargará** y verás tu cambio

---

#### Opción B: Espera Automática

Si no pulsas el botón, el sistema:
- Comprobará automáticamente cada 10 minutos
- Te mostrará una notificación cuando detecte la actualización
- Agregará un banner en la parte superior

---

## 🔍 Verificación Técnica (Opcional)

Si quieres verificar que todo funciona correctamente:

### 1. Verificar Endpoint de Versión

```powershell
Invoke-RestMethod -Uri "https://rauli-panaderia-1.onrender.com/api/version"
```

**Respuesta esperada:**
```json
{
  "version": "2026.02.02",
  "build": "2026-02-02T03:24:42Z",
  "code": "20260202032442"
}
```

### 2. Verificar Frontend

```powershell
Invoke-WebRequest -Uri "https://rauli-panaderia-app.vercel.app" | 
  Select-String "__APP_VERSION__"
```

**Debe mostrar la misma versión.**

---

## 📊 Cómo Funciona (Resumen Técnico)

```
Usuario abre app móvil
    ↓
VersionChecker consulta:
GET /api/version → "2026.02.02"
    ↓
Compara con versión local: "2026.02.01"
    ↓
Detecta que es más nueva
    ↓
Muestra banner: "Actualización disponible"
    ↓
Usuario pulsa "Actualizar ahora"
    ↓
App limpia caché y recarga
    ↓
✅ Nueva versión cargada
```

---

## ⚠️ Notas Importantes

### Cold Start de Render
- El backend (Render) puede tardar 30-60 segundos en "despertar" si lleva tiempo sin usarse
- Esto es normal en el plan gratuito
- La primera carga puede ser lenta, las siguientes serán rápidas

### Caché del Navegador
- El sistema limpia automáticamente el caché al actualizar
- Si ves contenido antiguo, es porque aún no has actualizado
- Pulsa "Actualizar ahora" para forzar la recarga

### Versión Automática
- Cada vez que ejecutas `deploy_auto.ps1`, la versión se actualiza automáticamente
- Formato: `YYYY.MM.DD` (ej: `2026.02.02`)
- No necesitas cambiar nada manualmente

---

## 🎯 Ejemplo Completo

```powershell
# 1. Hacer cambio en Dashboard.jsx
# (Agregar emoji o texto)

# 2. Desplegar
.\deploy_auto.ps1
# Mensaje: "Prueba actualizaciones"

# 3. Esperar 2-3 minutos

# 4. En el móvil:
# - Abrir: https://rauli-panaderia-app.vercel.app
# - Menú → "Buscar actualización"
# - Pulsar "Actualizar ahora"
# - ✅ Ver el cambio
```

---

## ✅ Checklist de Verificación

- [ ] Hice un cambio visible en el código
- [ ] Ejecuté `.\deploy_auto.ps1`
- [ ] Esperé 2-3 minutos
- [ ] Abrí la app en el móvil
- [ ] Pulsé "Buscar actualización"
- [ ] Vi el banner "Actualización disponible"
- [ ] Pulsé "Actualizar ahora"
- [ ] La app se recargó
- [ ] Veo mi cambio visible

---

## 🆘 Solución de Problemas

### "No aparece el banner de actualización"

**Posibles causas:**
1. Render/Vercel aún no terminaron de redesplegar (espera 1-2 minutos más)
2. El navegador tiene caché muy agresivo (cierra y abre la app)
3. La versión ya está actualizada (verifica con el endpoint `/api/version`)

**Solución:**
```powershell
# Verificar versión actual en servidor
Invoke-RestMethod -Uri "https://rauli-panaderia-1.onrender.com/api/version"

# Si la versión es correcta pero no aparece el banner:
# - Cierra completamente la app en el móvil
# - Vuelve a abrirla
# - Pulsa "Buscar actualización"
```

### "Error al actualizar"

**Solución:**
- Verifica tu conexión a internet
- Intenta de nuevo en 1 minuto
- Si persiste, recarga la página manualmente (F5 o pull-to-refresh)

---

## 📞 Soporte

Si tienes problemas:
1. Revisa `DIAGNOSTICO_ACTUALIZACIONES.md` para detalles técnicos
2. Revisa `RESUMEN_ACTUALIZACIONES_MOVIL.md` para el estado del sistema
3. Verifica los logs en Vercel/Render

---

**Última actualización:** 2 feb 2026  
**Versión actual:** 2026.02.02  
**Estado:** ✅ OPERATIVO
