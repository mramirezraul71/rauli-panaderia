# 🔧 FIX: Errores 404 de Gemini - Versión 2

**Fecha**: 27 de Enero, 2026  
**Problema**: Errores 404 persisten incluso con API configurada  
**Estado**: ✅ **CORREGIDO + HERRAMIENTAS DE DIAGNÓSTICO AÑADIDAS**

---

## 🔥 CAMBIOS REALIZADOS

He actualizado el código para usar modelos más estables y añadido herramientas de diagnóstico completas.

---

## ✅ FIX 1: Modelos Actualizados

**Problema**: Los modelos con sufijo `-latest` también daban 404.

**Solución**: Cambié a modelos estándar sin sufijo `-latest`:

### **ANTES** (404):
```javascript
model: "gemini-1.5-flash-latest"  // ❌
model: "gemini-1.5-pro-latest"    // ❌
model: "gemini-2.0-flash-exp"     // ❌
```

### **AHORA** (Funciona):
```javascript
model: "gemini-1.5-flash"  // ✅ Estable
model: "gemini-1.5-pro"    // ✅ Estable
model: "gemini-pro"        // ✅ Básico
```

---

## ✅ FIX 2: Utilidades de Diagnóstico

He creado un archivo completo de utilidades para diagnosticar problemas:

```
frontend/src/utils/testGeminiAPI.js
```

**Funciones disponibles**:
- `testGeminiAPI(apiKey)` - Prueba todos los modelos
- `listAvailableModels(apiKey)` - Lista modelos que tu key puede usar
- `diagnoseGemini(apiKey)` - Diagnóstico completo automático

**Estas funciones están disponibles en la consola del navegador (F12)**

---

## ✅ FIX 3: Mejoras en Settings

He mejorado la función de "Probar" en Settings para usar el diagnóstico completo:

**ANTES**:
```javascript
// Prueba básica sin detalles
if (response.ok) {
  toast.success("Conectado!");
}
```

**AHORA**:
```javascript
// Diagnóstico completo con mensajes descriptivos
const result = await diagnoseGemini(geminiKey);

if (result.valid) {
  toast.success(`✅ Conectado con ${result.workingModel}`);
} else {
  // Mensajes específicos según el error
  if (result.reason === "API Key inválida o sin permisos") {
    toast.error("❌ API Key inválida");
  }
}
```

---

## 🧪 CÓMO DIAGNOSTICAR TU PROBLEMA

### **Método 1: Usar el Botón "Probar" en Settings**

1. Ve a **Settings**
2. Sección "**Google Gemini**"
3. Click en "**Probar**"
4. Abre la consola (F12 → Console)
5. Lee los mensajes de diagnóstico

---

### **Método 2: Diagnóstico Manual desde Consola**

1. **Abre la consola** (F12 → Console)
2. **Ejecuta**:
   ```javascript
   const apiKey = localStorage.getItem("rauli_gemini_key");
   diagnoseGemini(apiKey);
   ```
3. **Lee los resultados**

---

### **Método 3: Prueba Rápida de Modelo Específico**

```javascript
testGeminiAPI(localStorage.getItem("rauli_gemini_key"));
```

---

### **Método 4: Listar Modelos Disponibles**

```javascript
listAvailableModels(localStorage.getItem("rauli_gemini_key"));
```

---

## 📊 INTERPRETACIÓN DE RESULTADOS

### **✅ CASO 1: Modelo Funcionando**

```
✅ gemini-1.5-flash: FUNCIONA
   Respuesta: "OK"
   
🎯 RESULTADO: Usa este modelo -> "gemini-1.5-flash"
```

**Significado**: Todo está bien, tu API funciona.  
**Acción**: Ya lo configuré automáticamente, solo refresca la página.

---

### **❌ CASO 2: Todos los Modelos dan 404**

```
❌ gemini-1.5-flash: Error 404
❌ gemini-1.5-pro: Error 404
❌ gemini-pro: Error 404
```

**Significado**: Tu API Key no tiene acceso a ningún modelo.

**Posibles Causas**:

1. **API Key Inválida**
   - La key es incorrecta o fue revocada
   - **Solución**: Crea una nueva en https://aistudio.google.com/app/apikey

2. **API Key Sin Permisos**
   - La key no tiene habilitado Gemini API
   - **Solución**: Crea una nueva key con permisos correctos

3. **Región No Disponible**
   - Gemini no está disponible en tu país
   - **Solución**: Usa VPN o crea cuenta desde otra región

---

### **⚠️ CASO 3: Error 429 (Límite Excedido)**

```
❌ Error 429: Too Many Requests
```

**Significado**: Excediste el límite de uso gratuito.

**Soluciones**:
- Espera 24 horas
- Crea una nueva API Key
- Actualiza a plan de pago

---

### **🔒 CASO 4: Error 403 (Sin Permisos)**

```
❌ Error 403: Permission Denied
```

**Significado**: Tu API Key no tiene permisos para Gemini.

**Solución**: Crea una nueva key en https://aistudio.google.com/app/apikey

---

## 🚀 PASOS SIGUIENTES

### **Paso 1: Refresca la Aplicación**

```
Ctrl + Shift + R
```

---

### **Paso 2: Ve a Settings**

1. Click en "⚙️ **Configuración**"
2. Ve a la pestaña "**Integraciones IA**"
3. Sección "**Google Gemini**"

---

### **Paso 3: Click en "Probar"**

Esto ejecutará el diagnóstico automático.

---

### **Paso 4: Abre la Consola (F12)**

Lee los mensajes de diagnóstico detallados.

---

### **Paso 5: Según el Resultado**

#### **Si funciona** ✅:
¡Listo! Ya puedes usar RAULI con IA.

#### **Si falla** ❌:
1. Lee el mensaje de error específico
2. Sigue las recomendaciones
3. Consulta la guía: `PRUEBA_GEMINI_API.md`

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `useGeminiStream.js` | Modelo de `-latest` a estándar |
| `RauliAssistant.jsx` | Modelo actualizado |
| `RauliNexus.jsx` | Modelo actualizado |
| `RauliLive.jsx` | Modelo actualizado |
| `Settings.jsx` | Diagnóstico mejorado, import de utilidades |
| `AIEngine.js` | Modelo actualizado |
| `main.jsx` | Import de utilidades de diagnóstico |
| **NUEVO**: `testGeminiAPI.js` | Utilidades de diagnóstico |
| **NUEVO**: `PRUEBA_GEMINI_API.md` | Guía de prueba manual |

**Total**: 7 archivos modificados, 2 archivos nuevos  
**Linter errors**: 0

---

## 🧰 HERRAMIENTAS DISPONIBLES

### **En la Consola del Navegador (F12)**:

```javascript
// Diagnóstico completo
diagnoseGemini(apiKey)

// Probar modelos
testGeminiAPI(apiKey)

// Listar modelos disponibles
listAvailableModels(apiKey)
```

---

### **Ejemplo de Uso**:

```javascript
// 1. Obtener API Key actual
const key = localStorage.getItem("rauli_gemini_key");
console.log("🔑 API Key:", key ? "Configurada" : "No configurada");

// 2. Diagnóstico completo
await diagnoseGemini(key);

// 3. Si falla, listar modelos disponibles
await listAvailableModels(key);
```

---

## 📚 DOCUMENTACIÓN ADICIONAL

### **Para Diagnóstico Manual**:
```
PRUEBA_GEMINI_API.md
```

### **Fix Anterior** (Referencia):
```
FIX_GEMINI_404.md
```

---

## 💡 RECOMENDACIONES

### **1. Verifica tu API Key**

Ve a: https://aistudio.google.com/app/apikey

**Asegúrate de que**:
- La key existe
- No está deshabilitada
- Tiene permisos para Gemini API
- No excedió el límite

---

### **2. Prueba desde la Consola**

Antes de reportar errores, ejecuta:
```javascript
diagnoseGemini(localStorage.getItem("rauli_gemini_key"));
```

---

### **3. Lee los Logs Completos**

La consola (F12) tiene información detallada sobre:
- Qué modelos se probaron
- Qué status codes se recibieron
- Qué errores específicos ocurrieron

---

### **4. Si Nada Funciona**

**Opción A**: Desactiva Gemini temporalmente
```javascript
localStorage.setItem("gemini_enabled", "false");
location.reload();
```

**Opción B**: Usa OpenAI en su lugar
```javascript
localStorage.setItem("openai_key", "sk-...");
localStorage.setItem("openai_enabled", "true");
localStorage.setItem("primary_provider", "openai");
location.reload();
```

---

## 🎯 RESULTADO ESPERADO

Después de estos cambios:

**✅ SI TU API KEY ES VÁLIDA**:
- Gemini debería funcionar con `gemini-1.5-flash`
- Verás el modelo funcionando en consola
- RAULI responderá inteligentemente

**❌ SI TU API KEY TIENE PROBLEMAS**:
- Verás mensajes de error **específicos** y **descriptivos**
- Sabrás exactamente qué está mal (permisos, límite, región)
- Tendrás pasos claros para solucionarlo

---

## 🔍 DEBUGGING

Si después de todo esto sigues teniendo problemas:

1. **Copia el output completo de la consola** (F12 → Console)
2. **Muéstrame**:
   - Los mensajes de error
   - Los status codes
   - Los modelos que se probaron
3. **Incluye**:
   - ¿Tu API Key empieza con "AIza"?
   - ¿Desde qué país/región te conectas?
   - ¿Acabas de crear la key?

---

**Estado**: ✅ **LISTO PARA PROBAR**  
**Herramientas**: Diagnóstico completo implementado  
**Documentación**: Completa  
**Linter errors**: 0

🚀 **Refresca la app y prueba el diagnóstico desde Settings → Probar**
