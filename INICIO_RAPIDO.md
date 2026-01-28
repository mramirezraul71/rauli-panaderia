# 🚀 INICIO RÁPIDO - GENESIS ERP

**Guía rápida para iniciar tu aplicación sin errores**

---

## ⚡ OPCIÓN 1: Inicio Automático (Recomendado)

### **Paso Único**:

1. **Doble click** en el archivo:
   ```
   START_APP.bat
   ```

2. **Espera** a que se abran 2 ventanas (Backend y Frontend)

3. **Listo** - El navegador se abrirá automáticamente

---

## 🛠️ OPCIÓN 2: Inicio Manual

### **Paso 1: Iniciar Backend**

Abre una terminal (CMD o PowerShell):

```powershell
cd C:\dev\RauliERP\backend
npm start
```

**Deja esta ventana abierta** ⚠️

**Deberías ver**:
```
✅ Servidor corriendo en http://localhost:3000
✅ Base de datos conectada
```

---

### **Paso 2: Iniciar Frontend**

Abre **OTRA** terminal (nueva ventana):

```powershell
cd C:\dev\RauliERP\frontend
npm run dev
```

**Deja esta ventana abierta también** ⚠️

**Deberías ver**:
```
✅ VITE ready in XXX ms
✅ Local: http://localhost:5173/
```

---

### **Paso 3: Abrir en Navegador**

Abre tu navegador en:
```
http://localhost:5173/dashboard
```

---

## 🔍 DIAGNÓSTICO

Si algo no funciona:

1. **Doble click** en:
   ```
   DIAGNOSTICO.bat
   ```

2. **Lee los resultados** - Te dirá qué falta

---

## 🚨 PROBLEMAS COMUNES

### ❌ Error: "EADDRINUSE: port already in use"

**Solución**:
```powershell
# Matar el proceso que usa el puerto
netstat -ano | findstr :3000
taskkill /PID [NUMERO] /F

# Luego iniciar de nuevo
npm start
```

---

### ❌ Error: "Cannot find module"

**Solución**:
```powershell
# Instalar dependencias
cd C:\dev\RauliERP\backend
npm install

cd C:\dev\RauliERP\frontend
npm install

# Luego iniciar
```

---

### ❌ Error: API 500 en el navegador

**Causa**: Backend no está corriendo

**Solución**: Ver "Paso 1: Iniciar Backend" arriba

---

### ❌ Error: Gemini 404

**Solución Rápida** (Desactivar Gemini):

1. Abre consola del navegador (F12)
2. Ejecuta:
```javascript
localStorage.removeItem("rauli_gemini_key");
```
3. Refresca (Ctrl + Shift + R)

**Solución Completa** (Configurar Gemini):

1. Ve a: https://makersuite.google.com/app/apikey
2. Crea una API Key
3. En consola del navegador (F12):
```javascript
localStorage.setItem("rauli_gemini_key", "TU_KEY_AQUI");
```
4. Refresca

---

## ✅ VERIFICACIÓN

Tu app está funcionando si:

- ✅ Backend muestra: "Servidor corriendo en http://localhost:3000"
- ✅ Frontend muestra: "Local: http://localhost:5173/"
- ✅ Navegador carga Dashboard sin errores
- ✅ RAULI Assistant responde
- ✅ No hay errores 500 en consola (F12)

---

## 📞 AYUDA ADICIONAL

Para más información detallada:
- Ver: `SOLUCION_ERRORES_API.md`

---

**¡Listo! Tu GENESIS ERP está funcionando.**

🎯 Acceso rápido: http://localhost:5173/dashboard
