# 🧪 PRUEBA DE GEMINI API

**Fecha**: 27 de Enero, 2026  
**Problema**: Errores 404 persisten con modelos de Gemini  
**Objetivo**: Diagnosticar exactamente qué está pasando con tu API Key

---

## 🚀 PRUEBA RÁPIDA DESDE CONSOLA

### **Paso 1: Abre la Consola del Navegador**

1. Presiona **F12**
2. Ve a la pestaña "**Console**"
3. Asegúrate de que la app esté cargada en el navegador

---

### **Paso 2: Ejecuta el Diagnóstico Completo**

Copia y pega este código en la consola:

```javascript
// Obtener tu API Key actual
const apiKey = localStorage.getItem("rauli_gemini_key");
console.log("🔑 API Key encontrada:", apiKey ? "Sí (" + apiKey.substring(0, 10) + "...)" : "❌ No configurada");

// Función de diagnóstico completo
async function diagnosticarGeminiCompleto() {
  if (!apiKey) {
    console.error("❌ No hay API Key configurada");
    console.log("💡 Configúrala en Settings o ejecuta:");
    console.log('   localStorage.setItem("rauli_gemini_key", "TU_KEY_AQUI");');
    return;
  }
  
  console.log("\n🏥 DIAGNÓSTICO COMPLETO DE GEMINI");
  console.log("=".repeat(60));
  
  // Modelos a probar
  const modelos = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-pro",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro-latest",
    "gemini-2.0-flash-exp"
  ];
  
  for (const modelo of modelos) {
    try {
      console.log(`\n📡 Probando: ${modelo}`);
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: "Responde solo: OK" }]
          }],
          generationConfig: {
            maxOutputTokens: 10
          }
        })
      });
      
      const data = await response.json();
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        console.log(`   ✅ FUNCIONA`);
        console.log(`   Respuesta: "${texto}"`);
        console.log(`\n🎯 RESULTADO: Usa este modelo -> "${modelo}"`);
        return modelo;
      } else {
        console.error(`   ❌ Error:`, data);
      }
    } catch (error) {
      console.error(`   ❌ Excepción:`, error.message);
    }
  }
  
  console.log("\n❌ NINGÚN MODELO FUNCIONÓ");
  console.log("\n💡 POSIBLES CAUSAS:");
  console.log("1. API Key inválida o expirada");
  console.log("2. Límite de uso excedido");
  console.log("3. API Key sin permisos para Gemini");
  console.log("4. Problema de red o firewall");
  console.log("\n🔗 SOLUCIONES:");
  console.log("1. Ve a: https://aistudio.google.com/app/apikey");
  console.log("2. Genera una nueva API Key");
  console.log("3. Verifica límites de uso");
  console.log("4. Prueba desde otra red");
}

// Ejecutar diagnóstico
diagnosticarGeminiCompleto();
```

---

### **Paso 3: Analiza los Resultados**

#### **✅ CASO 1: Algún modelo funcionó**

Verás algo como:
```
✅ FUNCIONA
Respuesta: "OK"

🎯 RESULTADO: Usa este modelo -> "gemini-1.5-flash"
```

**ACCIÓN**: Ese es tu modelo que funciona. Yo ya lo configuré automáticamente.

---

#### **❌ CASO 2: Ningún modelo funcionó**

Verás errores 404 para todos los modelos.

**POSIBLES CAUSAS**:

1. **API Key Inválida**
   - La key no es válida o fue revocada
   - **Solución**: Genera una nueva en https://aistudio.google.com/app/apikey

2. **Límite de Uso Excedido**
   - Excediste el límite gratuito
   - **Solución**: Espera o actualiza a plan de pago

3. **API Key Sin Permisos**
   - La key no tiene acceso a Gemini
   - **Solución**: Crea una nueva key con permisos correctos

4. **Región No Soportada**
   - Gemini no está disponible en tu país
   - **Solución**: Usa VPN o prueba otra cuenta

---

## 🔍 PRUEBA ALTERNATIVA: Listar Modelos Disponibles

Si el diagnóstico falló, prueba esto en la consola:

```javascript
async function listarModelosDisponibles() {
  const apiKey = localStorage.getItem("rauli_gemini_key");
  
  if (!apiKey) {
    console.error("❌ No hay API Key configurada");
    return;
  }
  
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Tu API Key puede acceder a ${data.models.length} modelos:`);
      data.models.forEach(m => {
        console.log(`   - ${m.name.replace('models/', '')}`);
      });
      return data.models;
    } else {
      console.error("❌ Error:", data);
      if (response.status === 403 || response.status === 401) {
        console.error("   Tu API Key es INVÁLIDA o no tiene permisos");
      } else if (response.status === 429) {
        console.error("   Límite de uso EXCEDIDO");
      }
    }
  } catch (error) {
    console.error("❌ Excepción:", error);
  }
}

listarModelosDisponibles();
```

---

## 🎯 INTERPRETACIÓN DE RESULTADOS

### **Si lista modelos correctamente**:

Significa que tu API Key es válida, pero los nombres de modelo que estamos usando no coinciden.

**SOLUCIÓN**: Usa los nombres exactos que te muestra la lista.

---

### **Si da error 401 o 403**:

Tu API Key es **inválida** o no tiene permisos.

**SOLUCIÓN**:
1. Ve a: https://aistudio.google.com/app/apikey
2. Crea una **nueva** API Key
3. Cópiala
4. En la consola:
   ```javascript
   localStorage.setItem("rauli_gemini_key", "TU_NUEVA_KEY_AQUI");
   location.reload();
   ```

---

### **Si da error 429**:

Excediste el **límite de uso**.

**SOLUCIÓN**:
- Espera unas horas
- O actualiza a plan de pago en Google AI Studio

---

## 🔧 CONFIGURAR NUEVA API KEY DESDE CONSOLA

Si necesitas configurar una nueva key, usa este código en la consola:

```javascript
// Configurar API Key
const nuevaKey = "AIza... TU KEY AQUI ...";
localStorage.setItem("rauli_gemini_key", nuevaKey);

// Habilitar Gemini
localStorage.setItem("gemini_enabled", "true");

// Recargar página
location.reload();
```

---

## 📊 COMPARACIÓN DE MODELOS

| Modelo | Velocidad | Inteligencia | Disponibilidad |
|--------|-----------|--------------|----------------|
| `gemini-1.5-flash` | ⚡⚡⚡ Alta | 🧠🧠 Media | ✅ Siempre |
| `gemini-1.5-pro` | ⚡⚡ Media | 🧠🧠🧠 Alta | ✅ Siempre |
| `gemini-pro` | ⚡⚡ Media | 🧠🧠 Media | ⚠️ Obsoleto |
| `gemini-2.0-flash-exp` | ⚡⚡⚡ Muy alta | 🧠🧠🧠 Alta | ⚠️ Experimental |

**RECOMENDADO**: `gemini-1.5-flash` (el que configuré por defecto)

---

## 🚨 SI TODO FALLA

### **Opción 1: Desactivar Gemini**

Si no puedes hacer que Gemini funcione, desactívalo temporalmente:

```javascript
// Desactivar Gemini
localStorage.setItem("gemini_enabled", "false");
location.reload();
```

RAULI seguirá funcionando con respuestas programadas (sin IA).

---

### **Opción 2: Usar OpenAI GPT (Alternativa)**

Si tienes una API Key de OpenAI, puedes configurarla:

```javascript
// Configurar OpenAI como alternativa
localStorage.setItem("openai_key", "sk-... TU KEY DE OPENAI ...");
localStorage.setItem("openai_enabled", "true");
localStorage.setItem("primary_provider", "openai");
location.reload();
```

---

## 📝 REGISTRO DE PRUEBAS

Después de ejecutar las pruebas, anota aquí tus resultados:

### **Modelo que funcionó**:
```
__________________________
```

### **Status Code recibido**:
```
__________________________
```

### **Mensaje de error (si aplica)**:
```
__________________________
```

### **Modelos disponibles (si aplica)**:
```
__________________________
```

---

## 🎓 PARA DESARROLLADORES

Si quieres ver el código de prueba que creé, está en:
```
frontend/src/utils/testGeminiAPI.js
```

Funciones disponibles en consola:
- `testGeminiAPI(apiKey)` - Prueba rápida
- `listAvailableModels(apiKey)` - Lista modelos
- `diagnoseGemini(apiKey)` - Diagnóstico completo

---

**IMPORTANTE**: Toda la información de diagnóstico se imprime en la consola del navegador (F12 → Console). Léela cuidadosamente para encontrar el problema.

🚀 **¡Suerte con las pruebas!**
