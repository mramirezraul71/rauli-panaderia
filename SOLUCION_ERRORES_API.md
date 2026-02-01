# 🔧 SOLUCIÓN DE ERRORES DE API

**Fecha**: 27 de Enero, 2026  
**Problemas identificados**:
1. ❌ Errores 500 en rutas del backend
2. ❌ Errores 404 al conectar con Gemini AI

---

## 🔥 PROBLEMA 1: Backend No Está Corriendo

### **Síntomas**:
```
❌ Failed to load resource: api/accounting/balance-check:1 (500)
❌ Failed to load resource: api/products?low_stock=true (500)
❌ Failed to load resource: api/inventory/lots?expiring=7:1 (500)
```

### **Causa**:
El servidor backend de Node.js no está corriendo o se detuvo.

### **✅ SOLUCIÓN**:

#### **Paso 1: Verificar si el servidor está corriendo**

Abre una terminal (PowerShell o CMD) y ejecuta:

```powershell
# Verificar si el puerto 3000 está en uso
netstat -ano | findstr :3000
```

**Si NO aparece nada**: El servidor no está corriendo.

---

#### **Paso 2: Iniciar el servidor backend**

```powershell
# Navegar a la carpeta backend
cd C:\dev\RauliERP\backend

# Instalar dependencias (si es primera vez)
npm install

# Iniciar el servidor
npm start
```

**Deberías ver**:
```
✅ Servidor corriendo en http://localhost:3000
✅ Base de datos conectada
```

---

#### **Paso 3: Mantener el servidor corriendo**

**IMPORTANTE**: Deja esta terminal abierta. Si la cierras, el servidor se detendrá.

Para usar el servidor en segundo plano:

```powershell
# Iniciar en background (opcional)
npm start &
```

---

### **Verificación**:

Abre tu navegador en:
```
http://localhost:3000/api/health
```

**Deberías ver**:
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

## 🔥 PROBLEMA 2: Gemini API - Errores 404

### **Síntomas**:
```
❌ Failed to load resource: generativelanguage.g...y-JWkGH5macgt3aZg:1 (404)
❌ gemini-1.5-flash -> 404
❌ gemini-1.5-pro -> 404
❌ gemini-pro -> 404
```

### **Causa**:
La API Key de Gemini no está configurada correctamente o el modelo no existe.

### **✅ SOLUCIÓN**:

#### **Opción A: Desactivar Gemini (Más Simple)**

Si no necesitas IA inteligente por ahora:

1. Abre consola del navegador (F12)
2. Ejecuta:
```javascript
localStorage.removeItem("rauli_gemini_key");
```
3. Refresca la página

RAULI funcionará con respuestas básicas sin IA.

---

#### **Opción B: Configurar Gemini Correctamente**

Si quieres usar IA inteligente:

##### **1. Obtener API Key de Google AI Studio**

1. Ve a: https://makersuite.google.com/app/apikey
2. Inicia sesión con tu cuenta de Google
3. Click en "Create API Key"
4. Copia la clave (algo como: `AIzaSyC...`)

##### **2. Configurar en la App**

Abre consola del navegador (F12) y ejecuta:

```javascript
localStorage.setItem("rauli_gemini_key", "TU_API_KEY_AQUI");
```

**Reemplaza** `TU_API_KEY_AQUI` con tu clave real.

##### **3. Verificar el Modelo**

El error puede ser por modelo incorrecto. Actualiza el hook:

```javascript
// En useGeminiStream, usar solo "gemini-pro"
const gemini = useGeminiStream({
  apiKey: localStorage.getItem("rauli_gemini_key"),
  model: "gemini-pro",  // ✅ Este es el modelo correcto
  systemPrompt: rauliContext
});
```

---

## 🔧 SOLUCIÓN COMPLETA PASO A PASO

### **1. Iniciar el Backend**

```powershell
# Terminal 1 (dejar abierta)
cd C:\dev\RauliERP\backend
npm start
```

**Espera ver**: `✅ Servidor corriendo en http://localhost:3000`

---

### **2. Iniciar el Frontend**

```powershell
# Terminal 2 (nueva terminal)
cd C:\dev\RauliERP\frontend
npm run dev
```

**Espera ver**: `✅ Local: http://localhost:5173`

---

### **3. Configurar Gemini (Opcional)**

En el navegador (F12 → Consola):

```javascript
// Opción A: Desactivar Gemini
localStorage.removeItem("rauli_gemini_key");

// Opción B: Configurar con tu API Key
localStorage.setItem("rauli_gemini_key", "AIzaSyC...");
```

---

### **4. Refresca la Página**

```
Ctrl + Shift + R
```

---

## 🧪 VERIFICACIÓN

### **Test 1: Backend Corriendo**

Abre: http://localhost:3000/api/health

**Debe mostrar**:
```json
{"status":"ok","database":"connected"}
```

---

### **Test 2: Frontend Funcionando**

Abre: http://localhost:5173/dashboard

**Debes ver**:
- ✅ RAULI Assistant cargado
- ✅ Sin errores en consola (F12)
- ✅ Widgets funcionando

---

### **Test 3: RAULI Assistant**

1. Escribe "Hola"
2. Presiona Enter
3. **Verifica**:
   - ✅ Respuesta aparece (con o sin IA)
   - ✅ Sin errores en consola

---

## 📊 CHECKLIST DE SOLUCIÓN

### **Backend**:
- [ ] Backend corriendo en puerto 3000
- [ ] Endpoint /api/health responde correctamente
- [ ] Terminal backend abierta (no cerrada)

### **Gemini AI**:
- [ ] Decisión tomada: ¿Con o sin Gemini?
- [ ] Si CON Gemini: API Key configurada
- [ ] Si SIN Gemini: Key removida
- [ ] Modelo correcto: "gemini-pro"

### **Frontend**:
- [ ] Frontend corriendo en puerto 5173
- [ ] Sin errores 500 en consola
- [ ] Sin errores 404 de Gemini (o Gemini desactivado)
- [ ] RAULI Assistant responde

---

## 🚨 ERRORES COMUNES

### **Error: "EADDRINUSE: port 3000 already in use"**

**Causa**: Ya hay otro proceso usando el puerto 3000.

**Solución**:
```powershell
# Encontrar el proceso
netstat -ano | findstr :3000

# Copiar el PID (última columna)
# Matar el proceso (reemplaza 1234 con el PID real)
taskkill /PID 1234 /F

# Iniciar servidor de nuevo
npm start
```

---

### **Error: "Cannot find module 'express'"**

**Causa**: Dependencias no instaladas.

**Solución**:
```powershell
cd C:\dev\RauliERP\backend
npm install
npm start
```

---

### **Error: "ERR_CONNECTION_REFUSED"**

**Causa**: Backend no está corriendo.

**Solución**: Ver "Problema 1" arriba.

---

### **Error: Gemini 404 persiste**

**Causa**: API Key inválida o modelo incorrecto.

**Solución**:
1. Verifica que la API Key sea correcta
2. Usa solo modelo "gemini-pro"
3. O desactiva Gemini:
```javascript
localStorage.removeItem("rauli_gemini_key");
```

---

## 🎯 RESULTADO ESPERADO

Después de aplicar las soluciones:

✅ **Backend**:
- Servidor corriendo en puerto 3000
- Responde a todas las rutas de API
- Sin errores 500

✅ **Gemini**:
- Configurado correctamente (si se usa)
- O desactivado (si no se usa)
- Sin errores 404

✅ **Frontend**:
- Carga sin errores
- RAULI Assistant funciona
- Widgets funcionan
- Navegación fluida

---

## 📞 SI PERSISTEN LOS PROBLEMAS

1. **Verifica logs del backend**:
   - Revisa la terminal donde corre `npm start`
   - Busca errores específicos

2. **Verifica consola del navegador**:
   - F12 → Console
   - Copia los errores exactos

3. **Reinicia ambos servidores**:
   ```powershell
   # Terminal backend: Ctrl+C, luego npm start
   # Terminal frontend: Ctrl+C, luego npm run dev
   ```

4. **Limpia caché**:
   ```
   Ctrl + Shift + Delete
   → Borrar todo
   → Recargar
   ```

---

**Estado**: ✅ **SOLUCIONES DOCUMENTADAS**  
**Prioridad**: 🔴 **ALTA** (App no funciona sin backend)

🚀 **Sigue estos pasos en orden y tu app funcionará correctamente.**
