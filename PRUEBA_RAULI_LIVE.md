# 🎤 PRUEBA RÁPIDA - RAULI LIVE

## 🚀 ACCESO INMEDIATO

### **URL Directa**:
```
http://localhost:5173/rauli-live
```

### **O desde la App**:
```
1. Estás en Dashboard
2. Escribe en la barra del navegador: /rauli-live
3. Enter
```

---

## 👩 QUÉ DEBES VER

### **Al Cargar** (primeros 2 segundos):

```
✅ Fondo oscuro elegante con efectos de luz
✅ Avatar femenino en el centro
✅ Avatar respira suavemente (sube/baja)
✅ Avatar parpadea cada 3-5 segundos
✅ Mensaje flotante: "¡Hola! Soy RAULI..."
✅ Botón de micrófono flotante (centro inferior)
✅ Texto: "Click para hablar con RAULI"
```

**Si el avatar NO se mueve** → Hay un error de carga

---

## 🎤 PRUEBA DE VOZ (5 PASOS)

### **Paso 1**: Click en el Botón de Micrófono
- Botón cambia de violeta a cian
- Aparece efecto de pulso
- Texto cambia a "🎤 Escuchando..."

### **Paso 2**: Observa el Avatar
**Debe cambiar a gesto "listening"**:
- ✅ Inclina la cabeza ligeramente
- ✅ Orejas brillan con efecto cian
- ✅ Escala ligeramente (1.05x)

### **Paso 3**: Habla "Hola"
- Espera 2 segundos en silencio

### **Paso 4**: Observa la Respuesta
**Avatar debe cambiar a gesto "speaking"**:
- ✅ Labios se mueven (animación rápida)
- ✅ Barras de volumen aparecen abajo
- ✅ Escala con pulso suave

**Mensaje flotante aparece**:
- ✅ Bocadillo con texto de respuesta
- ✅ Animación de entrada suave

**VOZ debe escucharse**:
- ✅ Voz femenina clara
- ✅ Sin repeticiones
- ✅ En español

### **Paso 5**: Avatar Vuelve a "idle"
- Después de hablar, vuelve a respirar suavemente
- Botón de micrófono vuelve a violeta (si cerró el micrófono)

---

## 🧭 PRUEBA DE NAVEGACIÓN

### **Comando**: "Llévame al inventario"

**Secuencia esperada**:
```
1. Avatar: "thinking" (mano en barbilla)
2. Mensaje: "Accediendo al módulo de inventario..."
3. VOZ: "Claro, te llevo al módulo de inventario"
4. Avatar: "happy" (sonrisa, salto)
5. Navegación a /inventory
```

### **Otros comandos para probar**:
- "Ir a ventas"
- "Contabilidad"
- "Dashboard"
- "Reportes"

**Todos deben**: 
- ✅ Responder con voz
- ✅ Mostrar gesto "happy"
- ✅ Navegar correctamente

---

## 🎨 DETALLES VISUALES A NOTAR

### **Efectos de Fondo**:
- 2 círculos difuminados que pulsan lentamente
- Gradiente oscuro profesional
- Efecto de profundidad

### **Avatar**:
- Cabello oscuro (#4a4a4a)
- Piel cálida (#ffd8c8)
- Ojos azules (#5c6bc0)
- Vestimenta gradiente violeta/azul
- Sombra suave debajo (aura)

### **Animaciones**:
- 60fps (fluidas y suaves)
- Transiciones naturales
- Sin movimientos bruscos

### **Botón de Micrófono**:
- **Inactivo**: Gradiente violeta/índigo
- **Activo**: Gradiente cian/azul
- **Hover**: Escala 1.05x
- **Click**: Escala 0.95x (feedback táctil)

---

## ✅ CHECKLIST DE VERIFICACIÓN

### **Carga Inicial**:
- [ ] Página carga sin errores (F12)
- [ ] Avatar visible y centrado
- [ ] Avatar respira (movimiento sube/baja cada 4s)
- [ ] Avatar parpadea (cada 3-5s)
- [ ] Mensaje de bienvenida aparece
- [ ] Botón de micrófono visible

### **Interacción de Voz**:
- [ ] Click en micrófono activa reconocimiento
- [ ] Avatar cambia a gesto "listening"
- [ ] Orejas brillan con cian
- [ ] Reconoce voz correctamente
- [ ] Responde con voz femenina
- [ ] Avatar cambia a "speaking"
- [ ] Labios se mueven
- [ ] Sin repeticiones de palabras

### **Navegación**:
- [ ] Comando "inventario" navega a /inventory
- [ ] Avatar hace gesto "happy" antes de navegar
- [ ] Transición suave entre pantallas
- [ ] Puede volver con botón "Volver a pantalla principal"

### **Gestos**:
- [ ] idle: Respiración suave, parpadeo
- [ ] listening: Cabeza inclinada, orejas brillan
- [ ] thinking: Mano en barbilla
- [ ] speaking: Labios se mueven, barras de volumen
- [ ] happy: Sonrisa, salto pequeño, sparkles
- [ ] concerned: Ceño fruncido (para alertas)

---

## 🚨 PROBLEMAS COMUNES

### **Problema 1: Avatar No Se Ve**
**Posibles causas**:
- Framer Motion no instaló correctamente
- Error de importación

**Solución**:
```powershell
cd C:\dev\RauliERP\frontend
npm install framer-motion --save
```

---

### **Problema 2: Avatar Estático (No Se Mueve)**
**Verifica en consola (F12)**:
- ¿Hay errores rojos?
- ¿Dice algo sobre "Framer Motion"?

**Solución**:
- Copia el error completo
- Reporta para fix inmediato

---

### **Problema 3: Voz No Responde**
**Verifica**:
- ¿Apareció `"🎤 Flag wasVoiceInput = true"`?
- ¿Detectó canal como "🎤 VOZ"?
- ¿Dijo "🔊 Respondiendo con VOZ"?

**Si NO**:
- Revisa los fixes anteriores (`wasVoiceInputRef`)
- Copia logs completos

---

### **Problema 4: Navegación No Funciona**
**Verifica**:
- ¿Avatar hizo gesto "happy"?
- ¿Apareció mensaje "Accediendo a..."?
- ¿Hubo error en consola?

**Debugging**:
- Revisa que la ruta exista (`/inventory`, `/sales`, etc.)
- Verifica que `useNavigate()` no tiene errores

---

## 📊 COMPARACIÓN VISUAL

### **ANTES** (RauliNexus):
```
╔══════════════════════════════════════════╗
║ 💬 Chat | 🎤 Voz | 📷 Visión | ⚙️ Config ║ ← Tabs
╠══════════════════════════════════════════╣
║  [Onda de audio estática]                ║
║                                          ║
║  Mensaje 1: ...                          ║
║  Mensaje 2: ...                          ║
║                                          ║
║  [Input de texto]                        ║
║  [🎙️] [📷] [Enviar]                     ║
╚══════════════════════════════════════════╝
```

### **AHORA** (RauliLive):
```
╔══════════════════════════════════════════╗
║                                          ║
║            👩 RAULI                      ║
║         (Avatar animado)                 ║
║      • Respira • Parpadea                ║
║      • Gestos humanos                    ║
║                                          ║
║       "¡Hola! ¿En qué                   ║
║        puedo ayudarte?"                  ║
║                                          ║
║              🎤                          ║
║       Click para hablar                  ║
║                                          ║
╚══════════════════════════════════════════╝
```

**Diferencia**: Minimalismo radical. TODO conversacional.

---

## 🎯 SIGUIENTE PASO INMEDIATO

### **AHORA** (2 minutos):

1. ✅ **Navega a**: `http://localhost:5173/rauli-live`

2. ✅ **Verifica**:
   - Avatar se mueve (respira, parpadea)
   - Mensaje de bienvenida aparece
   - Botón de micrófono visible

3. ✅ **Interactúa**:
   - Click en micrófono
   - Di "Hola"
   - Verifica respuesta con voz

4. ✅ **Navega**:
   - Di "Llévame al inventario"
   - Verifica navegación automática

---

## 📹 CAPTURA DE PANTALLA ESPERADA

**Al cargar `/rauli-live`**:
- Fondo oscuro con efectos de luz (2 círculos difuminados)
- Avatar femenino en el centro (violeta/azul)
- Avatar se mueve suavemente
- Mensaje flotante en bocadillo blanco/gris
- Botón de micrófono flotante (violeta brillante)
- Minimalista y elegante

**Durante interacción**:
- Avatar con gesto específico (listening, thinking, speaking)
- Botón de micrófono en cian (cuando está activo)
- Mensaje flotante actualizado
- Animaciones fluidas a 60fps

---

## 🎉 RESULTADO FINAL

**Has pedido**:
> "Investiga metodología para no improvisar. Crea una sola pantalla con un personaje femenino agradable con gestos humanos. Elimina opciones innecesarias. Usa tu creatividad."

**Has recibido**:
- ✅ **Metodología**: Frameworks profesionales (Google, Microsoft, Amazon)
- ✅ **Avatar**: Femenino animado con 6 estados emocionales
- ✅ **Gestos**: Parpadeo, respiración, expresiones faciales, manos
- ✅ **Pantalla**: UNA sola, minimalista
- ✅ **Botones**: UNO principal (micrófono)
- ✅ **Interacción**: 100% conversacional
- ✅ **Creatividad**: Avatar con personalidad, animaciones fluidas, diseño elegante

---

**🎤 ¡MOMENTO DE LA VERDAD!**

**Navega a**: `http://localhost:5173/rauli-live`

**Copia un screenshot o descríbeme**:
1. ¿Ves el avatar?
2. ¿Se mueve (respira/parpadea)?
3. ¿El botón de micrófono funciona?
4. ¿Responde con voz?
5. ¿Los gestos cambian?

🎨 **RAULI LIVE te espera.**
