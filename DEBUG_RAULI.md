# 🐛 Debug RAULI NEXUS

## Problemas Reportados y Soluciones

### 1. ❌ Navegación No Funciona

**Problema**: Usuario dijo "dirigete a la sección de inventario" y RAULI no navegó.

**Causa**: El patrón regex no incluía variantes como "dirigete", "llévame", "ve a", etc.

**Solución Aplicada**:
- ✅ Expandido el regex de navegación para incluir más variantes:
  ```javascript
  /\b(ir a|abrir|mostrar|ver|dirigete|dirijete|lleva|llevame|ve a|navegar a|acceder a|entrar a)\b/i
  ```
- ✅ Añadido "sección de inventario" como sinónimo de "inventario"
- ✅ Añadidos logs de debug en consola

**Cómo Probar Ahora**:
1. Recarga la página (`Ctrl+Shift+R`)
2. Escribe: `"dirigete a inventario"` o `"llevame a ventas"`
3. Abre la **consola del navegador** (F12)
4. Deberías ver:
   ```
   RAULI: Comando detectado {text: "...", response: "...", hasAction: true}
   RAULI: Ejecutando acción de navegación
   RAULI: Navegación ejecutada
   ```
5. RAULI debería navegar automáticamente

---

### 2. ❌ Micrófono No Funciona

**Posibles Causas**:
- Hook no se inicializa correctamente
- Navegador no soporta Web Speech API
- Permisos denegados

**Solución Aplicada**:
- ✅ Añadidos logs de debug en `useVoiceInput.js`
- ✅ Añadidos logs en `toggleVoiceInput()`

**Cómo Verificar**:

1. **Abre la consola** (F12)
2. **Haz clic en el botón 🎤** (o presiona `Ctrl+M`)
3. **Busca en la consola**:
   ```
   useVoiceInput: Inicializando {hasSpeechRecognition: true, hasWebkit: true}
   useVoiceInput: Soportado ✓
   RAULI: Toggle voz {isSupported: true, isListening: false}
   RAULI: Iniciando voz
   ```

4. **Si dice "No soportado"**:
   - Verifica que estás usando **Chrome** o **Edge** (Firefox tiene soporte limitado)
   - Safari también funciona pero con limitaciones

5. **Si el navegador pide permisos**:
   - Haz clic en "Permitir"
   - Si bloqueaste antes, ve a: `chrome://settings/content/microphone`
   - Encuentra tu sitio y marca "Permitir"

6. **Si todo está bien pero no funciona**:
   - Verifica que **ninguna otra pestaña** esté usando el micrófono
   - Cierra otras apps de videoconferencia (Zoom, Teams, etc.)

---

### 3. ❌ Cámara No Funciona

**Posibles Causas**:
- Hook no se inicializa correctamente
- Navegador no soporta MediaDevices API
- Permisos denegados
- Otra app está usando la cámara

**Solución Aplicada**:
- ✅ Añadidos logs de debug en `useCameraVision.js`
- ✅ Añadidos logs en `toggleCamera()`

**Cómo Verificar**:

1. **Abre la consola** (F12)
2. **Haz clic en el botón 📷** (o presiona `Ctrl+Shift+C`)
3. **Busca en la consola**:
   ```
   useCameraVision: Inicializando {hasNavigator: true, hasGetUserMedia: true, isSupported: true}
   useCameraVision: Soportado ✓
   RAULI: Toggle cámara {isSupported: true, isActive: false}
   RAULI: Iniciando cámara
   ```

4. **Si dice "No soportado"**:
   - Verifica que tu navegador es moderno (Chrome 53+, Edge 79+, Safari 11+)
   - Verifica que estás en **HTTPS** o **localhost** (HTTP no funciona)

5. **Si el navegador pide permisos**:
   - Haz clic en "Permitir"
   - Si bloqueaste antes, ve a: `chrome://settings/content/camera`
   - Encuentra tu sitio y marca "Permitir"

6. **Si todo está bien pero no funciona**:
   - Cierra **todas las apps** que usen la cámara (Zoom, Teams, Discord, etc.)
   - Cierra **otras pestañas** con video activo
   - Reinicia el navegador

---

## 🔍 Cómo Ver la Consola del Navegador

### En Chrome/Edge:
1. Presiona **F12**
2. Ve a la pestaña **"Console"**
3. Refresca la página (`Ctrl+Shift+R`)
4. Busca mensajes que empiecen con `"RAULI:"`, `"useVoiceInput:"`, `"useCameraVision:"`

### Filtrar Solo RAULI:
En el campo de búsqueda de la consola escribe: `RAULI`

---

## ✅ Checklist de Verificación

Antes de reportar un problema, verifica:

- [ ] Estás usando **Chrome** o **Edge** (para voz)
- [ ] Abriste la **consola del navegador** (F12)
- [ ] **Refrescaste la página** con `Ctrl+Shift+R`
- [ ] El servidor está corriendo en `http://localhost:5173`
- [ ] No hay **errores rojos** en la consola al cargar
- [ ] Los mensajes `"useVoiceInput: Soportado ✓"` y `"useCameraVision: Soportado ✓"` aparecen
- [ ] Permitiste **permisos** cuando el navegador los pidió
- [ ] Cerraste **otras apps** que usen micrófono/cámara

---

## 📋 Comandos de Navegación Actualizados

Ahora RAULI entiende MUCHAS MÁS variantes:

### ✅ Funcionan Ahora:
```
"ir a inventario"
"abrir ventas"
"mostrar productos"
"ver clientes"
"dirigete a inventario"      ← NUEVO
"dirijete a ventas"           ← NUEVO
"lleva a productos"           ← NUEVO
"llevame a clientes"          ← NUEVO
"ve a reportes"               ← NUEVO
"navegar a contabilidad"      ← NUEVO
"acceder a pos"               ← NUEVO
"entrar a dashboard"          ← NUEVO
"dirigete a la sección de inventario"  ← NUEVO
```

---

## 🚀 Próximos Pasos

Si después de verificar todo lo anterior sigues teniendo problemas:

1. **Copia los mensajes de la consola** (especialmente los errores en rojo)
2. **Toma una captura** de la consola completa
3. **Describe exactamente**:
   - Qué botón presionaste
   - Qué esperabas que pasara
   - Qué pasó en realidad
   - Qué dice la consola

---

## 📞 Comandos para Refrescar

```bash
# Si necesitas refrescar solo la página
Ctrl+Shift+R  (Windows/Linux)
Cmd+Shift+R   (Mac)

# Si necesitas reiniciar el servidor
cd C:\dev\RauliERP\frontend
npm run dev
```

---

*Actualizado: 2026-01-27 22:15*
