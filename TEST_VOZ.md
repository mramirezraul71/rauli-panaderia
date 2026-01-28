# 🎤 TEST DE VOZ - DIAGNÓSTICO

## ✅ CORRECCIONES APLICADAS

### 1. **Prevención de Repeticiones**
- ✅ Flag síncrono `isSpeakingRef` para evitar llamadas múltiples
- ✅ `lastTextRef` para detectar si es el mismo texto
- ✅ Ignorar duplicados automáticamente
- ✅ Callbacks de voz configurados UNA SOLA VEZ (sin dependencias)

### 2. **Voz Femenina en Español**
- ✅ Prioriza voces femeninas conocidas
- ✅ Busca en esta orden:
  1. Google español de Estados Unidos
  2. Microsoft Helena/Sabina/Laura (España/México)
  3. Paulina/Monica (macOS)
  4. Amelie (Firefox)
  5. Cualquier voz en español disponible

---

## 🧪 PRUEBA AHORA (3 PASOS)

### PASO 1: Refresca
```
Ctrl + Shift + R
```

### PASO 2: Abre la Consola
```
F12
```

### PASO 3: Activa Micrófono y Habla
```
1. Pestaña "🎤 Voz"
2. Click en botón de micrófono
3. Di: "Hola"
4. Espera 2 segundos
```

---

## ✅ QUÉ DEBES VER EN CONSOLA

### **Si funciona correctamente**:

```
✅ RAULI: 🎯 Configurando callbacks de voz (solo una vez)
✅ RAULI: 🎙️ ACTIVANDO micrófono
✅ useVoiceInput: ✅ onstart disparado - Micrófono ACTIVO
✅ RAULI: Texto reconocido Hola
✅ useVoiceInput: Timer completado, enviando: Hola
✅ RAULI: Mensaje completo detectado, enviando... Hola
✅ RAULI: 🚀 Ejecutando handleSendMessage desde onComplete
✅ RAULI: 📨 Mensaje detectado { canal: '🎤 VOZ' }
✅ RAULI: Comando detectado
✅ RAULI: 🔊 Respondiendo con VOZ - UNA VEZ
✅ useVoiceSynthesis: 🔊 speak() llamado { currentlySpeaking: false }
✅ useVoiceSynthesis: 👩 Voz seleccionada: [NOMBRE DE VOZ FEMENINA]
✅ useVoiceSynthesis: ✅ Voz INICIADA - HABLANDO
[Escuchas con VOZ FEMENINA]: "¡Hola Jefe! Sistemas de GENESIS..."
✅ useVoiceSynthesis: ✅ Voz FINALIZADA
```

**NOTA**: Solo debe aparecer **UN** "Voz INICIADA" y **UN** "Voz FINALIZADA"

---

### **Si sigue repitiendo**:

```
❌ useVoiceSynthesis: 🔊 speak() llamado
❌ useVoiceSynthesis: ✅ Voz INICIADA
❌ useVoiceSynthesis: 🔊 speak() llamado  ← DUPLICADO
❌ useVoiceSynthesis: ✅ Voz INICIADA      ← DUPLICADO
❌ useVoiceSynthesis: 🔊 speak() llamado  ← DUPLICADO
```

**Acción**: Copia TODO el log desde "RAULI: 🎯 Configurando" hasta el final

---

## 🔍 VERIFICAR VOZ FEMENINA

### En la consola busca:
```
useVoiceSynthesis: 👩 Voz seleccionada: [NOMBRE]
```

### Voces Femeninas Comunes:

**Windows (Edge/Chrome)**:
- ✅ Microsoft Helena - Spanish (Spain) 👩
- ✅ Microsoft Sabina - Spanish (Mexico) 👩
- ✅ Microsoft Laura - Spanish (Spain) 👩
- ❌ Microsoft Pablo - Spanish (Spain) 👨 (masculina)

**macOS (Safari)**:
- ✅ Paulina 👩
- ✅ Monica 👩
- ❌ Juan 👨 (masculina)

**Chrome (Google)**:
- ✅ Google español de Estados Unidos 👩

---

## 🎧 PRUEBA DE CALIDAD DE VOZ

### Comando de Prueba:
```
Di o escribe: "Mi nombre es RAULI NEXUS y soy tu asistente inteligente"
```

**Resultado esperado**:
- ✅ Voz clara y femenina
- ✅ Pronunciación correcta
- ✅ Sin repeticiones
- ✅ Una sola reproducción completa

---

## 🛠️ SI QUIERES CAMBIAR LA VOZ MANUALMENTE

### Ver todas las voces disponibles:
1. Abre consola (F12)
2. Escribe:
```javascript
speechSynthesis.getVoices().forEach(v => console.log(v.name, v.lang))
```

### Las voces aparecerán en consola

---

## 📊 CHECKLIST DE VERIFICACIÓN

- [ ] Refrescaste con `Ctrl+Shift+R`
- [ ] Consola abierta (F12)
- [ ] Activaste micrófono
- [ ] Dijiste "Hola" y esperaste 2 segundos
- [ ] Viste: `"🎯 Configurando callbacks de voz (solo una vez)"`
- [ ] Viste: `"👩 Voz seleccionada: [NOMBRE FEMENINO]"`
- [ ] Viste: Solo **UN** `"Voz INICIADA"`
- [ ] Viste: Solo **UN** `"Voz FINALIZADA"`
- [ ] Escuchaste voz femenina clara
- [ ] NO hubo repeticiones

---

## 🚨 SI FALLA

### Problema 1: Sigue Repitiendo

**Verifica**:
```
¿Aparece múltiples veces?:
  "RAULI: 🎯 Configurando callbacks de voz"
```

**Si SÍ** → El componente se está montando múltiples veces
→ Copia TODO el log

**Si NO** → Busca si aparece múltiples veces:
```
"useVoiceSynthesis: 🔊 speak() llamado"
```

→ Copia TODO el log

---

### Problema 2: Voz Masculina

**Verifica en consola**:
```
useVoiceSynthesis: 👩 Voz seleccionada: [NOMBRE]
```

**Si dice voz masculina** (ej. "Pablo", "Juan"):
- Tu sistema solo tiene voces masculinas en español
- Puedes instalar voces femeninas:
  - **Windows**: Configuración → Hora e idioma → Voz
  - **macOS**: Preferencias → Accesibilidad → Contenido Hablado
  - **Linux**: Instalar `espeak-ng` con voces femeninas

---

### Problema 3: No Aparece "👩 Voz seleccionada"

**Causa**: Las voces aún no se cargaron

**Solución**:
1. Espera 2-3 segundos después de recargar
2. Prueba de nuevo
3. Si persiste, copia el log completo

---

## 🎯 RESULTADO ESPERADO FINAL

```
Activar micrófono → Di "Hola" → Espera 2s →
ESCUCHAS (con voz femenina agradable): 
  "¡Hola Jefe! Sistemas de GENESIS en línea y listos."
  
✅ Sin repetir palabras
✅ Voz femenina
✅ Clara y completa
✅ Solo una vez
```

---

## 📝 FORMATO DE REPORTE

Si falla, copia y pega:

```
### RESULTADO DE PRUEBA

**¿Repitió palabras?**: [SÍ/NO]
**¿Voz femenina?**: [SÍ/NO - nombre de voz]
**¿Cuántas veces dijo "Voz INICIADA"?**: [Número]

### LOG COMPLETO
[Pega TODOS los logs desde "🎯 Configurando" hasta el final]

### VOCES DISPONIBLES
[Ejecuta speechSynthesis.getVoices() y pega el resultado]
```

---

## ✅ MEJORAS IMPLEMENTADAS

### Código Anterior (Problemático):
```javascript
// Callbacks se configuraban cada vez que voiceInput cambiaba
useEffect(() => {
  voiceInput.onComplete(...);
}, [voiceInput]); // ❌ Dependencia causa re-ejecución

// speak() no validaba duplicados
const speak = (text) => {
  synthesisRef.current.speak(utterance); // ❌ Sin protección
};
```

### Código Nuevo (Corregido):
```javascript
// Callbacks se configuran UNA SOLA VEZ
useEffect(() => {
  voiceInput.onComplete(...);
  // eslint-disable-next-line
}, []); // ✅ Sin dependencias

// speak() con protección contra duplicados
const speak = (text) => {
  if (isSpeakingRef.current && lastTextRef.current === text) {
    return; // ✅ Ignora duplicado
  }
  isSpeakingRef.current = true;
  lastTextRef.current = text;
  synthesisRef.current.speak(utterance);
};
```

---

**🎤 ¡Listo para probar!**

1. Refresca (`Ctrl+Shift+R`)
2. Abre consola (F12)
3. Activa micrófono
4. Di "Hola"
5. **Verifica que NO repita y que sea voz femenina** ✨

**Cópiame el resultado.**
