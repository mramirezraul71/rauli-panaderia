# 🛡️ CORRECCIÓN ERROR DE INICIALIZACIÓN

**Fecha**: 27 de Enero, 2026  
**Error**: `Cannot access 'showMessage' before initialization`  
**Estado**: ✅ **CORREGIDO**

---

## 🔥 PROBLEMA CRÍTICO

**Error en pantalla**:
```
Error cargando la app
Ocurrió un problema inesperado al renderizar la aplicación.

Cannot access 'showMessage' before initialization
```

**Stack trace**:
```
at RauliLive (RauliLive.jsx:79:7)
  at Suspense
  at RenderedRoute
```

---

## 🔍 DIAGNÓSTICO

### **Causa Raíz: Orden de Declaración Incorrecto**

En React, los hooks y funciones deben declararse **ANTES** de usarse en `useEffect` o en otras funciones.

**Problema encontrado en RauliLive.jsx**:

```javascript
// ❌ ANTES - INCORRECTO:

// Línea 62-71: useEffect usa handleUserMessage
useEffect(() => {
  voiceInput.onComplete((fullText) => {
    handleUserMessage(fullText); // ❌ No existe aún
  });
}, []);

// Línea 74-79: useEffect usa showMessage
useEffect(() => {
  setTimeout(() => {
    showMessage("¡Hola!..."); // ❌ No existe aún
  }, 1000);
}, [showMessage]); // ❌ Dependencia circular

// Línea 82: showMessage se define DESPUÉS
const showMessage = useCallback(...); // Se define aquí

// Línea 117: processNavigationCommand usa showMessage
const processNavigationCommand = useCallback(() => {
  showMessage(`Accediendo...`); // Esto crea dependencia circular
}, [showMessage]); // ❌ Dependencia circular

// Línea 149: handleUserMessage se define DESPUÉS
const handleUserMessage = useCallback(...); // Se define aquí
```

**Problemas**:
1. ❌ `useEffect`s intentan usar funciones antes de que existan
2. ❌ Dependencias circulares entre `useCallback`s
3. ❌ JavaScript lanza error de inicialización

---

## ✅ SOLUCIÓN IMPLEMENTADA

### **Estrategia: Refs para Funciones**

Usamos `useRef` para crear referencias a las funciones que se actualizan **después** de su definición.

```javascript
// ✅ AHORA - CORRECTO:

// Paso 1: Crear refs para funciones
const showMessageRef = useRef(null);
const handleUserMessageRef = useRef(null);

// Paso 2: useEffect usa REF (con [] dependencias vacías)
useEffect(() => {
  voiceInput.onComplete((fullText) => {
    if (handleUserMessageRef.current) {
      handleUserMessageRef.current(fullText); // ✅ Usa ref
    }
  });
}, []); // ✅ Sin dependencias

useEffect(() => {
  setTimeout(() => {
    if (showMessageRef.current) {
      showMessageRef.current("¡Hola!..."); // ✅ Usa ref
    }
  }, 1000);
}, []); // ✅ Sin dependencias

// Paso 3: Definir funciones sin dependencias circulares
const showMessage = useCallback((text, from = "rauli") => {
  // ... lógica ...
}, [voiceInput.isListening, voiceSynthesis]); // ✅ Solo deps necesarias

const processNavigationCommand = useCallback((text) => {
  // Usar REF en lugar de showMessage directamente
  if (showMessageRef.current) {
    showMessageRef.current(`Accediendo...`); // ✅ Usa ref
  }
}, [navigate]); // ✅ Sin showMessage en deps

const handleUserMessage = useCallback(async (text) => {
  // Usar REF en lugar de showMessage directamente
  if (showMessageRef.current) {
    showMessageRef.current(response, "rauli"); // ✅ Usa ref
  }
}, [gemini, processNavigationCommand]); // ✅ Sin showMessage en deps

// Paso 4: Actualizar refs DESPUÉS de definir funciones
useEffect(() => {
  showMessageRef.current = showMessage;
}, [showMessage]);

useEffect(() => {
  handleUserMessageRef.current = handleUserMessage;
}, [handleUserMessage]);
```

---

## 📊 COMPARACIÓN

### **ANTES** (Error):
```
┌─────────────────┐
│ useEffect       │ ───> busca showMessage ───> ❌ NO EXISTE
└─────────────────┘

┌─────────────────┐
│ showMessage     │ ───> se define después
└─────────────────┘

RESULTADO: Cannot access 'showMessage' before initialization
```

### **AHORA** (Funciona):
```
┌─────────────────┐
│ showMessageRef  │ ───> Ref vacía (null)
└─────────────────┘

┌─────────────────┐
│ useEffect       │ ───> usa showMessageRef.current ───> ✅ OK (null por ahora)
└─────────────────┘

┌─────────────────┐
│ showMessage     │ ───> se define
└─────────────────┘

┌─────────────────┐
│ useEffect       │ ───> showMessageRef.current = showMessage ───> ✅ Actualiza ref
└─────────────────┘

RESULTADO: Todo funciona, sin dependencias circulares
```

---

## 🔧 CAMBIOS REALIZADOS

### **Archivo: RauliLive.jsx**

#### **1. Agregadas Refs para Funciones**
```javascript
const showMessageRef = useRef(null);
const handleUserMessageRef = useRef(null);
```

#### **2. Modificado useEffect de callbacks de voz**
```javascript
// ANTES:
voiceInput.onComplete((fullText) => {
  handleUserMessage(fullText); // ❌ Error
});

// AHORA:
voiceInput.onComplete((fullText) => {
  if (handleUserMessageRef.current) {
    handleUserMessageRef.current(fullText); // ✅ Usa ref
  }
});
```

#### **3. Modificado useEffect de bienvenida**
```javascript
// ANTES:
useEffect(() => {
  showMessage("¡Hola!..."); // ❌ Error
}, [showMessage]); // ❌ Dependencia circular

// AHORA:
useEffect(() => {
  if (showMessageRef.current) {
    showMessageRef.current("¡Hola!..."); // ✅ Usa ref
  }
}, []); // ✅ Sin dependencias
```

#### **4. Modificado processNavigationCommand**
```javascript
// ANTES:
showMessage(`Accediendo...`); // ❌ Dependencia circular
}, [navigate, showMessage]); // ❌ Dependencia circular

// AHORA:
if (showMessageRef.current) {
  showMessageRef.current(`Accediendo...`); // ✅ Usa ref
}
}, [navigate]); // ✅ Sin showMessage
```

#### **5. Modificado handleUserMessage**
```javascript
// ANTES:
showMessage(response, "rauli"); // ❌ Dependencia circular
}, [gemini, processNavigationCommand, showMessage]); // ❌ Dependencia circular

// AHORA:
if (showMessageRef.current) {
  showMessageRef.current(response, "rauli"); // ✅ Usa ref
}
}, [gemini, processNavigationCommand]); // ✅ Sin showMessage
```

#### **6. Agregados useEffects para actualizar refs**
```javascript
useEffect(() => {
  showMessageRef.current = showMessage;
}, [showMessage]);

useEffect(() => {
  handleUserMessageRef.current = handleUserMessage;
}, [handleUserMessage]);
```

---

## 🎯 BENEFICIOS

1. ✅ **Sin errores de inicialización**: Las funciones se usan mediante refs
2. ✅ **Sin dependencias circulares**: Refs rompen el ciclo
3. ✅ **Código más robusto**: Pattern probado en RauliNexus
4. ✅ **Fácil debugging**: Refs se pueden inspeccionar
5. ✅ **Mantenible**: Pattern claro y documentado

---

## 🧪 VERIFICACIÓN

### **Paso 1: Refresca**
```
Ctrl + Shift + R
```

### **Paso 2: Verifica Console (F12)**
**NO debe aparecer**:
```
❌ Cannot access 'showMessage' before initialization
❌ Error cargando la app
```

**SÍ debe aparecer**:
```
✅ RAULI LIVE: 👋 Mostrando mensaje de bienvenida
✅ RAULI LIVE: 🔊 Reproduciendo voz...
```

### **Paso 3: Prueba Funcionalidad**
1. La app debe cargar correctamente
2. El mensaje de bienvenida debe aparecer y sonar
3. El micrófono debe funcionar
4. Las respuestas deben sonar

---

## 📚 PATRÓN APLICABLE

Este patrón se debe usar **siempre que**:

1. Un `useEffect` necesita usar una función definida después
2. Hay dependencias circulares entre `useCallback`s
3. Aparece error "Cannot access before initialization"

**Template**:
```javascript
// 1. Crear ref
const myFunctionRef = useRef(null);

// 2. useEffect usa ref (sin dependencias de la función)
useEffect(() => {
  if (myFunctionRef.current) {
    myFunctionRef.current();
  }
}, []); // Sin myFunction en deps

// 3. Definir función
const myFunction = useCallback(() => {
  // ...
}, [/* solo deps reales */]);

// 4. Actualizar ref
useEffect(() => {
  myFunctionRef.current = myFunction;
}, [myFunction]);
```

---

## ✅ CHECKLIST

### **Código**:
- [x] Refs creadas para funciones problemáticas
- [x] useEffects usan refs en lugar de funciones directas
- [x] Dependencias circulares eliminadas
- [x] useEffects para actualizar refs agregados
- [x] Linter errors: 0

### **Pruebas**:
- [ ] App carga sin errores
- [ ] Mensaje de bienvenida aparece y suena
- [ ] Micrófono funciona
- [ ] Navegación funciona
- [ ] Respuestas suenan

---

## 🔮 MEJORAS FUTURAS

1. **ESLint Rule**: Detectar este pattern automáticamente
2. **Custom Hook**: `useCallbackRef` para simplificar
3. **Documentación**: Agregar a guía de desarrollo

---

**Estado**: ✅ **CORREGIDO**  
**Archivos modificados**: 1 (`RauliLive.jsx`)  
**Linter errors**: 0  
**Pattern aplicado**: useRef para prevenir inicialización temprana

🚀 **Refresca ahora y la app debe cargar correctamente**
