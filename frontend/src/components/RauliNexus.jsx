import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiOutlineCamera,
  HiOutlineMicrophone,
  HiOutlinePaperAirplane,
  HiOutlineSparkles,
  HiOutlineStop,
  HiOutlineX,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineLightningBolt,
  HiOutlineCog
} from "react-icons/hi";
import { useRauli } from "../context/RauliContext";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { useVoiceSynthesis } from "../hooks/useVoiceSynthesis";
import { useGeminiStream } from "../hooks/useGeminiStream";
import { useCameraVision } from "../hooks/useCameraVision";
import { RAULI_SYSTEM_PROMPT, getRauliContext } from "../config/rauliPersonality";

const SOUND_SEND =
  "data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAAAAAA//8AAP//AAD//wAA//8AAP//AAD//wAA";
const SOUND_RECEIVE =
  "data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAAAAAAAP//AAD//wAAAP//AAD//wAAAP//AAD//wAA";

/**
 * RAULI NEXUS - Sistema de IA de última generación
 * Innovaciones 2026:
 * ✨ Entrada multimodal (voz, texto, visión)
 * 🌊 Respuestas en streaming (token por token)
 * 🎤 Conversación continua
 * 📷 Análisis visual con cámara
 * 🧠 Memoria contextual
 * 🚀 Navegación autónoma
 * ⚡ Shortcuts de teclado
 * 🎨 Avatar animado 3D
 * 🌐 Multi-idioma
 */
export default function RauliNexus() {
  const navigate = useNavigate();
  const { isOnline, isProcessing, pendingCount, enqueueCommand, lastSyncAt } = useRauli();
  
  // Estados core
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState("chat"); // chat | voice | vision | settings
  
  // Estados de configuración
  const [settings, setSettings] = useState({
    useVoiceInput: false,
    useVoiceOutput: false,
    autoNavigate: true,
    geminiApiKey: localStorage.getItem("rauli_gemini_key") || "",
    useGeminiAI: false,
    language: "es-ES",
    voiceSpeed: 1.0,
    thinkMode: false
  });

  // Refs
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const sendSoundRef = useRef(null);
  const receiveSoundRef = useRef(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Hooks avanzados
  const voiceInput = useVoiceInput({ 
    lang: settings.language,
    continuous: true, // ✓ Modo continuo mejorado
    interimResults: true,
    autoSend: true // ✓ Auto-envío tras 2 segundos de silencio
  });

  const voiceSynthesis = useVoiceSynthesis({
    lang: settings.language,
    rate: settings.voiceSpeed,
    volume: 0.8
  });

  // 🧠 Contexto dinámico para RAULI
  const rauliContext = useMemo(() => {
    const appState = {
      currentRoute: window.location.pathname,
      userName: "Jefe", // Obtener del auth context en producción
      companyName: "GENESIS",
      isOnline,
      pendingCount
    };
    return RAULI_SYSTEM_PROMPT + "\n\n" + getRauliContext(appState);
  }, [isOnline, pendingCount]);

  const gemini = useGeminiStream({
    apiKey: settings.geminiApiKey,
    model: "gemini-1.5-flash",
    temperature: settings.thinkMode ? 0.3 : 0.7,
    systemPrompt: rauliContext // ✅ Inyectar personalidad de RAULI
  });

  const camera = useCameraVision({
    facingMode: "user",
    resolution: "hd"
  });

  // Inicializar sonidos
  useEffect(() => {
    sendSoundRef.current = new Audio(SOUND_SEND);
    receiveSoundRef.current = new Audio(SOUND_RECEIVE);
    sendSoundRef.current.volume = 0.12;
    receiveSoundRef.current.volume = 0.12;
  }, []);

  // Auto-scroll del chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Refs para evitar dependencias circulares y acceso desde useEffects
  const handleSendRef = useRef(null);
  const handleCaptureRef = useRef(null);
  const toggleVoiceRef = useRef(null);
  const toggleCameraRef = useRef(null);
  const stopAllRef = useRef(null);
  const wasVoiceInputRef = useRef(false); // 🎤 Flag para recordar que vino de voz

  // ✅ Configurar callbacks de voz (UNA SOLA VEZ)
  useEffect(() => {
    console.log("RAULI: 🎯 Configurando callbacks de voz (solo una vez)");
    
    // Callback cuando se reconoce texto (en tiempo real)
    voiceInput.onResult((finalText) => {
      console.log("RAULI: Texto reconocido", finalText);
      setInput(prev => {
        const newText = prev ? prev + " " + finalText : finalText;
        return newText.trim();
      });
    });

    // Callback cuando termina una frase completa (auto-send)
    voiceInput.onComplete((fullText) => {
      console.log("RAULI: Mensaje completo detectado, enviando...", fullText);
      setInput(fullText);
      // 🎤 MARCAR que este mensaje vino de VOZ
      wasVoiceInputRef.current = true;
      console.log("RAULI: 🎤 Flag wasVoiceInput = true (vino de voz)");
      
      // Enviar automáticamente después de un pequeño delay
      setTimeout(() => {
        if (fullText.trim() && handleSendRef.current) {
          console.log("RAULI: 🚀 Ejecutando handleSendMessage desde onComplete (VOZ)");
          handleSendRef.current();
        }
      }, 100);
    });
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ Solo al montar - sin dependencias

  // ✅ Sincronizar modo con estado del micrófono (mantener "listening" si está activo)
  useEffect(() => {
    if (voiceInput.isListening && mode === "idle") {
      setMode("listening");
      console.log("RAULI: Micrófono activo detectado, cambiando de idle a listening");
    } else if (!voiceInput.isListening && mode === "listening") {
      setMode("idle");
      console.log("RAULI: Micrófono inactivo detectado, cambiando de listening a idle");
    }
    // No incluir 'mode' en dependencias para evitar loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceInput.isListening]);

  // Animación de la onda de audio (Canvas)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const draw = (time) => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const centerY = height / 2;
      
      // Animación diferente según el estado
      let amplitude, speed, gradient;
      
      if (mode === "thinking" || gemini.isLoading) {
        amplitude = height * 0.28;
        speed = 0.018;
        gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, "rgba(139, 92, 246, 0.95)");
        gradient.addColorStop(0.5, "rgba(34, 211, 238, 0.95)");
        gradient.addColorStop(1, "rgba(16, 185, 129, 0.95)");
      } else if (voiceInput.isListening) {
        amplitude = height * 0.35;
        speed = 0.022;
        gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, "rgba(244, 63, 94, 0.9)");
        gradient.addColorStop(1, "rgba(251, 146, 60, 0.9)");
      } else if (voiceSynthesis.isSpeaking) {
        amplitude = height * 0.25;
        speed = 0.016;
        gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, "rgba(59, 130, 246, 0.9)");
        gradient.addColorStop(1, "rgba(147, 51, 234, 0.9)");
      } else {
        amplitude = height * 0.08;
        speed = 0.008;
        gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, "rgba(139, 92, 246, 0.55)");
        gradient.addColorStop(1, "rgba(99, 102, 241, 0.65)");
      }

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = gradient;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "rgba(139, 92, 246, 0.4)";
      ctx.beginPath();
      
      for (let x = 0; x <= width; x += 4) {
        const phase = time * speed + x * 0.02;
        const pulse = Math.sin(time * 0.002) * 0.35 + 0.65;
        const y = centerY + Math.sin(phase) * amplitude * pulse;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [mode, voiceInput.isListening, voiceSynthesis.isSpeaking, gemini.isLoading]);

  // Shortcuts de teclado (usando refs para evitar dependencias circulares)
  useEffect(() => {
    const handleKeyboard = (e) => {
      // Ctrl/Cmd + K: Focus en input
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        console.log("RAULI: Shortcut Ctrl+K detectado");
        inputRef.current?.focus();
      }
      // Ctrl/Cmd + M: Toggle micrófono
      if ((e.ctrlKey || e.metaKey) && e.key === "m") {
        e.preventDefault();
        console.log("RAULI: ⌨️ Shortcut Ctrl+M detectado - Toggle micrófono");
        toggleVoiceRef.current?.();
      }
      // Ctrl/Cmd + Shift + C: Toggle cámara
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
        e.preventDefault();
        console.log("RAULI: Shortcut Ctrl+Shift+C detectado");
        toggleCameraRef.current?.();
      }
      // Escape: Detener todo
      if (e.key === "Escape") {
        console.log("RAULI: Shortcut Escape detectado - Deteniendo todo");
        stopAllRef.current?.();
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []); // Sin dependencias - usa refs

  const playSound = (ref) => {
    if (!ref?.current) return;
    try {
      ref.current.currentTime = 0;
      ref.current.play();
    } catch {}
  };

  const executeRauliCommand = useCallback((userText) => {
    const text = userText.toLowerCase().trim();
    let action = null;
    let response = "";

    // Comandos de control del asistente
    if (text.match(/\b(detener|detén|desactiva|desactiva el micrófono|deja de escuchar|silencio|callate|cállate|para de escuchar|apaga el micrófono|apaga micrófono)\b/i)) {
      action = () => {
        if (voiceInput.isListening) {
          voiceInput.stopListening();
          setSettings(prev => ({ ...prev, useVoiceInput: false }));
          setMode("idle");
        }
      };
      response = "✅ Entendido, desactivando micrófono. Cuando me necesites, haz clic en el botón de micrófono.";
    }
    else if (text.match(/\b(gracias|muchas gracias|eso es todo|ya está|ya esta|hasta luego|adiós|adios|nos vemos)\b/i)) {
      action = () => {
        if (voiceInput.isListening) {
          voiceInput.stopListening();
          setSettings(prev => ({ ...prev, useVoiceInput: false }));
          setMode("idle");
        }
      };
      response = "👋 ¡De nada! Ha sido un placer asistirte. Micrófono desactivado. ¡Hasta pronto!";
    }
    // Comando especial: capturar imagen (si cámara activa)
    else if (text.match(/\b(captura|capturar|foto|toma foto|tomar foto|fotografía|fotografiar|analiza esto|analizar esto)\b/i)) {
      if (camera.isActive) {
        action = () => {
          if (handleCaptureRef.current) {
            handleCaptureRef.current();
          }
        };
        response = "📸 ¡Capturando imagen! Analizando con IA...";
      } else {
        response = "La cámara no está activa. Ve a la pestaña 📷 Visión para activarla primero.";
      }
    }
    // Sistema de comandos de navegación
    else if (text.match(/\b(hola|hi|hey|buenos días|buenas tardes|buenas noches)\b/i)) {
      response = "¡Hola! 👋 Soy RAULI NEXUS, tu asistente inteligente. Mi micrófono permanecerá activo para que puedas hablarme naturalmente mientras trabajas. Puedo llevarte a cualquier módulo, responder preguntas y hasta analizar imágenes. ¿A dónde quieres ir primero? O dime 'ayuda' para ver todo lo que puedo hacer.";
    }
    else if (text.match(/\b(pos|punto de venta|caja|cobrar|vender)\b/i)) {
      if (settings.autoNavigate) action = () => navigate("/pos");
      response = "✅ Perfecto, te llevo al Punto de Venta. Puedes decirme 'buscar producto', 'ver ventas del día' o lo que necesites. Sigo escuchando.";
    }
    else if (text.match(/\b(inventario|stock|existencias|almacén|almacen)\b/i)) {
      if (settings.autoNavigate) action = () => navigate("/inventory");
      response = "📦 Listo, accediendo al inventario. ¿Quieres ver productos específicos, revisar stock bajo o agregar nuevos artículos? Estoy aquí para ayudarte.";
    }
    else if (text.match(/\b(productos|artículos|articulos|catálogo|catalogo)\b/i)) {
      if (settings.autoNavigate) action = () => navigate("/products");
      response = "🏷️ Entrando al catálogo de productos. Puedo ayudarte a buscar, editar o crear productos. ¿Qué necesitas?";
    }
    else if (text.match(/\b(ventas|historial de ventas)\b/i)) {
      if (settings.autoNavigate) action = () => navigate("/sales");
      response = "📊 Abriendo historial de ventas. ¿Quieres ver las ventas de hoy, esta semana o buscar algo específico? Dime y lo hacemos.";
    }
    else if (text.match(/\b(clientes|cliente|compradores)\b/i)) {
      if (settings.autoNavigate) action = () => navigate("/customers");
      response = "👥 Accediendo a clientes. ¿Buscas un cliente específico, quieres agregar uno nuevo o revisar el historial? Pregúntame lo que necesites.";
    }
    else if (text.match(/\b(dashboard|inicio|home|regresa|volver)\b/i)) {
      if (settings.autoNavigate) action = () => navigate("/");
      response = "🏠 De vuelta al Dashboard principal. Desde aquí puedes navegar a cualquier módulo. ¿A dónde quieres ir ahora?";
    }
    else if (text.match(/\b(ayuda|help|comandos|qué puedes hacer|que puedes hacer|qué sabes hacer|que sabes hacer)\b/i)) {
      response = `🤖 **RAULI NEXUS - Tu Asistente de Voz**

Estoy aquí para acompañarte. Puedes decirme:

📍 **Navegación**: "abrir ventas", "ir a inventario", "muestra clientes", "regresa al inicio"
🎤 **Control**: "detener micrófono", "gracias, eso es todo"  
📷 **Visión**: "capturar foto", "analiza esto" (con cámara activa)  
💬 **Conversación**: Habla naturalmente, te entiendo

Mi micrófono permanece activo hasta que me digas "detener" o hagas clic en el botón. ¿A dónde vamos?`;
    }
    else if (text.match(/\b(dónde estoy|donde estoy|dónde estamos|donde estamos|qué módulo|que modulo|ubicación)\b/i)) {
      const currentPath = window.location.pathname;
      let currentModule = "Dashboard principal";
      if (currentPath.includes("/inventory")) currentModule = "Inventario";
      else if (currentPath.includes("/pos")) currentModule = "Punto de Venta";
      else if (currentPath.includes("/products")) currentModule = "Productos";
      else if (currentPath.includes("/sales")) currentModule = "Ventas";
      else if (currentPath.includes("/customers")) currentModule = "Clientes";
      else if (currentPath.includes("/accounting")) currentModule = "Contabilidad";
      
      response = `📍 Estás en **${currentModule}**. ¿Necesitas ir a otro lugar? Solo dime "ir a [módulo]" y te llevo.`;
    }
    else if (text.match(/\b(repite|otra vez|no entendí|no escuché|qué dijiste|que dijiste)\b/i)) {
      response = "Disculpa, ¿puedes repetir? A veces el micrófono no capta bien. Habla un poco más fuerte o acércate más.";
    }
    else if (text.match(/\b(ir a|abrir|mostrar|ver|dirigete|dirijete|lleva|llevame|ve a|navegar a|acceder a|entrar a)\b/i)) {
      const moduleMatch = text.match(/\b(ventas|inventario|productos|clientes|pos|reportes|contabilidad|seccion de inventario|sección de inventario)\b/i);
      if (moduleMatch) {
        const moduleMap = {
          ventas: "/sales",
          inventario: "/inventory",
          "seccion de inventario": "/inventory",
          "sección de inventario": "/inventory",
          productos: "/products",
          clientes: "/customers",
          pos: "/pos",
          reportes: "/reports",
          contabilidad: "/accounting"
        };
        const module = moduleMatch[1].toLowerCase();
        const route = moduleMap[module];
        if (route && settings.autoNavigate) action = () => navigate(route);
        const displayModule = module === "seccion de inventario" || module === "sección de inventario" ? "inventario" : module;
        response = `✅ Navegando a ${displayModule}... Módulo cargándose.`;
      } else {
        response = "No detecté el módulo. Intenta: 'ir a inventario', 'abrir ventas', etc.";
      }
    }
    else {
      response = "🤔 Entendido. ¿Quieres que navegue a algún módulo específico? Di por ejemplo: 'abrir ventas' o 'ir a inventario'.";
    }

    return { response, action };
  }, [navigate, settings.autoNavigate, camera, voiceInput, setSettings, setMode]);

  const handleSendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text) return;

    // 🎤 Detectar canal de entrada para responder en el mismo canal
    // Usar flag en lugar de isListening porque el micrófono puede estar inactivo ya
    const isVoiceInput = wasVoiceInputRef.current || voiceInput.isListening;
    const isCameraActive = camera.isActive;
    
    console.log("RAULI: 📨 Mensaje detectado", { 
      text, 
      canal: isVoiceInput ? "🎤 VOZ" : isCameraActive ? "📷 CÁMARA" : "⌨️ TEXTO",
      wasVoiceFlag: wasVoiceInputRef.current,
      isListening: voiceInput.isListening
    });
    
    // 🧹 Limpiar flag de voz después de usarlo
    wasVoiceInputRef.current = false;
    
    // 🛡️ Prevenir procesamiento múltiple del mismo mensaje
    if (mode === "thinking") {
      console.warn("RAULI: ⚠️ Ya estoy procesando un mensaje, ignorando duplicado");
      return;
    }

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
      inputMode: isVoiceInput ? "voice" : isCameraActive ? "camera" : "text" // 🔖 Marcar el canal
    };

    setMessages(prev => [...prev, userMessage]);
    enqueueCommand({ kind: "text", text, source: "rauli-nexus" });
    playSound(sendSoundRef);
    setInput("");
    setMode("thinking");

    // Si está activada Gemini API
    if (settings.useGeminiAI && settings.geminiApiKey) {
      try {
        // ✅ Esperar a que termine el streaming y obtener respuesta completa
        const fullResponse = await gemini.sendMessage(text);
        
        console.log("RAULI: Gemini respondió (completo)", { 
          length: fullResponse?.length,
          preview: fullResponse?.substring(0, 50) 
        });
        
        const botMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: fullResponse || "Lo siento, no pude procesar tu solicitud.",
          timestamp: new Date().toISOString(),
          source: "gemini"
        };

        setMessages(prev => [...prev, botMessage]);
        
        // 🔊 RESPUESTA MULTIMODAL: Hablar UNA SOLA VEZ cuando termina el streaming
        const shouldSpeak = (isVoiceInput || settings.useVoiceOutput) && voiceSynthesis.isSupported;
        if (shouldSpeak && fullResponse) {
          console.log("RAULI: 🔊 Respondiendo con VOZ (entrada fue por voz) - UNA VEZ");
          voiceSynthesis.speak(fullResponse);
        } else {
          console.log("RAULI: 💬 Respondiendo con TEXTO (entrada fue por texto)");
        }
        
        // ✅ Mantener modo "listening" si el micrófono sigue activo
        setMode(prev => voiceInput.isListening ? "listening" : "idle");
        console.log("RAULI: Modo actualizado (Gemini), micrófono activo:", voiceInput.isListening);
      } catch (error) {
        console.error("Error con Gemini:", error);
        setMode("idle"); // En caso de error, volver a idle
      }
    } else {
      // Modo local (fallback)
      window.setTimeout(() => {
        const { response, action } = executeRauliCommand(text);
        
        console.log("RAULI: Comando detectado", { text, response, hasAction: !!action });
        
        const botMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: response,
          timestamp: new Date().toISOString(),
          source: "local"
        };

        setMessages(prev => [...prev, botMessage]);
        
        // 🔊 RESPUESTA MULTIMODAL: Si el usuario usó VOZ, responder con VOZ
        const shouldSpeak = (isVoiceInput || settings.useVoiceOutput) && voiceSynthesis.isSupported;
        if (shouldSpeak) {
          console.log("RAULI: 🔊 Respondiendo con VOZ (entrada fue por voz)");
          voiceSynthesis.speak(response);
        } else {
          console.log("RAULI: 💬 Respondiendo con TEXTO (entrada fue por texto)");
        }

        if (action && typeof action === "function") {
          console.log("RAULI: Ejecutando acción de navegación");
          window.setTimeout(() => {
            try {
              action();
              console.log("RAULI: Navegación ejecutada");
            } catch (err) {
              console.error("RAULI: Error en navegación", err);
            }
          }, 800);
        }
        
        playSound(receiveSoundRef);
        
        // ✅ Mantener modo "listening" si el micrófono sigue activo (DESPUÉS de responder)
        setMode(prev => voiceInput.isListening ? "listening" : "idle");
        console.log("RAULI: Modo actualizado, micrófono activo:", voiceInput.isListening);
      }, 1500);
    }
  }, [input, settings, gemini, voiceSynthesis, executeRauliCommand, enqueueCommand, voiceInput, camera]);

  // Actualizar ref para evitar dependencias circulares
  useEffect(() => {
    handleSendRef.current = handleSendMessage;
  }, [handleSendMessage]);

  const toggleVoiceInput = useCallback(() => {
    // Obtener stack trace para debugging
    const stack = new Error().stack;
    console.log("RAULI: Toggle voz LLAMADO", { 
      isSupported: voiceInput.isSupported, 
      isListening: voiceInput.isListening,
      recognitionExists: !!voiceInput.startListening,
      mode: mode,
      caller: stack?.split('\n')[2] // Muestra quién llamó a esta función
    });
    
    if (!voiceInput.isSupported) {
      alert("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
      console.error("RAULI: Voz no soportada");
      return;
    }

    // ✅ PREVENCIÓN: No detener si estamos procesando (thinking)
    if (mode === "thinking" && voiceInput.isListening) {
      console.warn("RAULI: ⚠️ Ignorando toggle - estamos procesando un mensaje");
      return;
    }

    if (voiceInput.isListening) {
      console.log("RAULI: ⏹ Deteniendo micrófono (usuario lo solicitó)");
      voiceInput.stopListening();
      voiceInput.resetTranscript();
      setSettings(prev => ({ ...prev, useVoiceInput: false }));
      setMode("idle");
    } else {
      console.log("RAULI: 🎙️ ACTIVANDO micrófono");
      voiceInput.resetTranscript();
      
      // Intentar iniciar el reconocimiento
      try {
        voiceInput.startListening();
        setSettings(prev => ({ ...prev, useVoiceInput: true }));
        setMode("listening");
        console.log("RAULI: ✅ Micrófono activado exitosamente");
      } catch (err) {
        console.error("RAULI: ❌ Error al activar micrófono:", err);
        alert("No se pudo activar el micrófono. Intenta de nuevo.");
      }
    }
  }, [voiceInput, mode]);

  // Actualizar ref de toggleVoiceInput
  useEffect(() => {
    toggleVoiceRef.current = toggleVoiceInput;
  }, [toggleVoiceInput]);

  const toggleCamera = useCallback(() => {
    console.log("RAULI: Toggle cámara", { isSupported: camera.isSupported, isActive: camera.isActive });
    
    if (!camera.isSupported) {
      alert("Tu navegador no soporta acceso a cámara.");
      console.error("RAULI: Cámara no soportada");
      return;
    }

    if (camera.isActive) {
      console.log("RAULI: Deteniendo cámara");
      camera.stopCamera();
    } else {
      console.log("RAULI: Iniciando cámara");
      camera.startCamera();
      setActiveTab("vision");
    }
  }, [camera]);

  // Actualizar ref de toggleCamera
  useEffect(() => {
    toggleCameraRef.current = toggleCamera;
  }, [toggleCamera]);

  const handleCaptureAndAnalyze = useCallback(async () => {
    const photo = camera.capturePhoto();
    if (!photo) {
      console.error("RAULI: No se pudo capturar foto");
      return;
    }

    const question = input.trim() || "¿Qué ves en esta imagen?";
    
    console.log("RAULI: Capturando y analizando", { question, hasGemini: !!settings.geminiApiKey });
    
    setInput("");
    setMode("thinking");
    playSound(sendSoundRef);

    // 📷 Detectar si estamos en modo voz + cámara (multimodal completo)
    const isMultimodal = voiceInput.isListening;
    
    console.log("RAULI: 📷 Captura", { 
      pregunta: question,
      multimodal: isMultimodal ? "🎤📷 VOZ+CÁMARA" : "📷 SOLO CÁMARA"
    });
    
    const userMessage = {
      id: Date.now(),
      role: "user",
      content: question,
      image: photo.dataUrl,
      timestamp: new Date().toISOString(),
      inputMode: "camera"
    };

    setMessages(prev => [...prev, userMessage]);

    if (settings.useGeminiAI && settings.geminiApiKey) {
      try {
        const response = await gemini.sendMessageWithImage(question, photo);
        
        const botMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: response || "No pude analizar la imagen.",
          timestamp: new Date().toISOString(),
          source: "gemini-vision"
        };

        setMessages(prev => [...prev, botMessage]);
        playSound(receiveSoundRef);

        // 🔊 RESPUESTA MULTIMODAL: Si hay voz activa O configuración de voz, hablar
        const shouldSpeak = (isMultimodal || settings.useVoiceOutput) && voiceSynthesis.isSupported;
        if (shouldSpeak) {
          console.log("RAULI: 🔊 Respondiendo análisis visual con VOZ");
          voiceSynthesis.speak(response);
        } else {
          console.log("RAULI: 💬 Respondiendo análisis visual con TEXTO");
        }
      } catch (error) {
        console.error("RAULI: Error en análisis visual", error);
        const errorMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: "❌ Error al analizar la imagen. Verifica tu API key de Gemini.",
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } else {
      const botMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: "📷 Imagen capturada. Activa Gemini API en Settings (pestaña ⚙️) para análisis visual avanzado con IA.",
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, botMessage]);
      playSound(receiveSoundRef);
      
      // 🔊 También hablar en modo local si hay voz activa
      const shouldSpeak = (isMultimodal || settings.useVoiceOutput) && voiceSynthesis.isSupported;
      if (shouldSpeak) {
        console.log("RAULI: 🔊 Notificando captura con VOZ");
        voiceSynthesis.speak("Imagen capturada. Activa Gemini API para análisis visual.");
      }
    }

    setMode("idle");
  }, [camera, input, gemini, settings, voiceSynthesis, playSound, voiceInput]);

  // Actualizar ref para evitar dependencias circulares
  useEffect(() => {
    handleCaptureRef.current = handleCaptureAndAnalyze;
  }, [handleCaptureAndAnalyze]);

  const stopAll = useCallback(() => {
    voiceInput.stopListening();
    voiceSynthesis.stop();
    gemini.stopStream();
    camera.stopCamera();
    setMode("idle");
  }, [voiceInput, voiceSynthesis, gemini, camera]);

  // Actualizar ref de stopAll
  useEffect(() => {
    stopAllRef.current = stopAll;
  }, [stopAll]);

  const statusTone = isOnline ? "from-indigo-500/25 via-slate-900/70 to-violet-500/20" : "from-amber-500/20 via-slate-900/70 to-orange-500/20";
  const statusBorder = isOnline ? "border-violet-500/30" : "border-amber-500/40";
  const statusGlow = isOnline ? "shadow-[0_0_40px_rgba(99,102,241,0.25)]" : "shadow-[0_0_40px_rgba(245,158,11,0.25)]";

  const statusCopy = useMemo(() => {
    if (voiceInput.isListening) return "🎤 Escuchando tu voz...";
    if (voiceSynthesis.isSpeaking) return "🔊 RAULI está hablando...";
    if (gemini.isLoading) return "🧠 Procesando con Gemini AI...";
    if (!isOnline) return "📵 MODO OFFLINE - Grabando órdenes...";
    if (isProcessing) return "🔄 Sincronizando con GENESIS Cloud...";
    return "✨ RAULI NEXUS en línea · Escuchando";
  }, [isOnline, isProcessing, voiceInput.isListening, voiceSynthesis.isSpeaking, gemini.isLoading]);

  return (
    <section className={`relative h-full min-h-[520px] rounded-3xl border ${statusBorder} ${statusGlow} bg-gradient-to-br ${statusTone} overflow-hidden transition-all duration-300`}>
      {/* Efectos de fondo */}
      <div className="absolute inset-0 rauli-grid opacity-40" />
      <div className="absolute inset-0 rauli-scanline opacity-30" />
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-violet-600/20 blur-3xl animate-pulse" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-cyan-500/10 blur-3xl animate-pulse" />

      <div className="relative z-10 h-full flex flex-col gap-4 p-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl border ${statusBorder} bg-slate-900/60 flex items-center justify-center rauli-pulse shadow-lg`}>
              <HiOutlineSparkles className="w-7 h-7 text-violet-200" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400 font-semibold">Núcleo RAULI</p>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                NEXUS <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white">2026</span>
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={stopAll}
              className="px-3 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/30 transition-all text-xs flex items-center gap-1.5"
              title="Detener todo (Esc)"
            >
              <HiOutlineStop className="w-4 h-4" />
              Stop
            </button>
            
            <span className={`px-3 py-1.5 rounded-full border ${statusBorder} bg-slate-900/60 text-xs text-slate-300`}>
              {isOnline ? "🟢 Online" : "🟡 Offline"}
            </span>
            
            <span className="px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900/60 text-xs text-slate-300">
              Cola: {pendingCount}
            </span>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-xl bg-slate-900/60 border border-slate-700 text-slate-300 hover:bg-slate-800/60 transition-all"
              title="Expandir/Contraer"
            >
              {isExpanded ? <HiOutlineChevronUp className="w-5 h-5" /> : <HiOutlineChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {isExpanded && (
          <>
            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-2 rounded-xl border border-slate-700/50 bg-slate-950/40">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-amber-400"} animate-pulse`} />
                {statusCopy}
              </div>
              {lastSyncAt && (
                <span className="text-[11px] text-slate-500">
                  Última sync: {new Date(lastSyncAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            {/* Onda de audio */}
            <div className="relative">
              <div className={`h-20 rounded-2xl border border-slate-800/60 bg-slate-950/60 rauli-breathe overflow-hidden ${mode === "thinking" ? "rauli-thinking" : ""}`}>
                <canvas ref={canvasRef} className="w-full h-full" />
              </div>
              
              {/* Indicador de micrófono activo */}
              {voiceInput.isListening && (
                <div className="absolute top-2 right-2 px-3 py-1.5 rounded-full bg-red-600/90 border border-red-400/50 backdrop-blur-sm animate-pulse shadow-lg shadow-red-500/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span className="text-xs font-semibold text-white">🎤 Escuchando</span>
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2">
              {[
                { id: "chat", label: "💬 Chat", icon: null },
                { id: "voice", label: "🎤 Voz", icon: null },
                { id: "vision", label: "📷 Visión", icon: null },
                { id: "settings", label: "⚙️ Config", icon: HiOutlineCog }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-violet-600/80 to-indigo-600/80 text-white shadow-lg"
                      : "bg-slate-900/40 text-slate-400 hover:bg-slate-800/60"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "chat" && (
                <div className="h-full flex flex-col gap-4">
                  {/* Chat messages */}
                  {messages.length > 0 ? (
                    <div className="flex-1 rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 overflow-y-auto max-h-[280px] space-y-3 no-scrollbar">
                      {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fadeIn`}>
                          <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                            msg.role === "user"
                              ? "bg-gradient-to-br from-violet-600/90 to-indigo-600/90 text-white shadow-lg shadow-violet-500/20"
                              : "bg-slate-800/80 text-slate-200 border border-slate-700/50"
                          }`}>
                            {msg.image && (
                              <img src={msg.image} alt="Captura" className="w-full rounded-lg mb-2" />
                            )}
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            <span className="text-[10px] opacity-60 mt-1 block">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                              {msg.source && <span className="ml-2">· {msg.source}</span>}
                            </span>
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  ) : (
                    <div className="flex-1 rounded-xl border border-slate-800/60 bg-slate-950/60 p-8 flex flex-col items-center justify-center text-center">
                      <HiOutlineLightningBolt className="w-16 h-16 text-violet-400 mb-4 animate-pulse" />
                      <p className="text-lg font-semibold text-slate-300 mb-2">RAULI NEXUS está listo</p>
                      <p className="text-sm text-slate-500 max-w-md">
                        Sistema de IA multimodal con voz, visión y navegación autónoma. Habla, escribe o usa la cámara.
                      </p>
                    </div>
                  )}

                  {/* Input */}
                  <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4 flex flex-col gap-3">
                    <textarea
                      ref={inputRef}
                      value={input + (voiceInput.interimTranscript ? " " + voiceInput.interimTranscript : "")}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Escribe, habla o captura con la cámara... (Ctrl+K para focus)"
                      rows={3}
                      className="w-full rounded-xl bg-slate-900/70 border border-slate-700/60 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none"
                    />
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            console.log("RAULI: 🖱️ Click en botón de micrófono (chat input)");
                            toggleVoiceInput();
                          }}
                          className={`rauli-icon-btn ${voiceInput.isListening ? "bg-red-600/20 border-red-500/50 text-red-300 animate-pulse" : ""}`}
                          title="Activar micrófono (Ctrl+M)"
                        >
                          <HiOutlineMicrophone className="w-5 h-5" />
                        </button>
                        
                        <button
                          onClick={() => {
                            console.log("RAULI: 🖱️ Click en botón de cámara");
                            toggleCamera();
                          }}
                          className={`rauli-icon-btn ${camera.isActive ? "bg-green-600/20 border-green-500/50 text-green-300" : ""}`}
                          title="Activar cámara (Ctrl+Shift+C)"
                        >
                          <HiOutlineCamera className="w-5 h-5" />
                        </button>
                      </div>

                      <button
                        onClick={handleSendMessage}
                        disabled={!input.trim()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium shadow-lg shadow-violet-500/30 hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Enviar
                        <HiOutlinePaperAirplane className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "voice" && (
                <div className="h-full rounded-xl border border-slate-800/60 bg-slate-950/60 p-6 flex flex-col items-center justify-center">
                  <div className="relative mb-6">
                    <HiOutlineMicrophone className={`w-24 h-24 ${voiceInput.isListening ? "text-red-500 animate-pulse" : "text-violet-400"}`} />
                    {voiceInput.isListening && (
                      <div className="absolute inset-0 rounded-full border-4 border-red-500/30 animate-ping" />
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2">
                    {voiceInput.isListening ? "🎤 Escuchando..." : "Control por Voz"}
                  </h3>
                  <p className="text-sm text-slate-400 mb-6 text-center max-w-md">
                    {voiceInput.isListening 
                      ? "Habla ahora. Tu mensaje se enviará automáticamente después de 2 segundos de silencio."
                      : "Haz clic abajo para activar el micrófono. El texto se reconocerá automáticamente."
                    }
                  </p>
                  
                  {/* Mostrar texto reconocido en tiempo real */}
                  {voiceInput.isListening && (input || voiceInput.interimTranscript) && (
                    <div className="w-full max-w-md mb-6 p-4 rounded-xl bg-slate-900/60 border border-violet-500/30 animate-fadeIn">
                      <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Reconociendo:</p>
                      <p className="text-white text-lg">
                        {input}
                        {voiceInput.interimTranscript && (
                          <span className="text-slate-400 italic"> {voiceInput.interimTranscript}</span>
                        )}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      console.log("RAULI: 🖱️ Click en botón grande de micrófono (pestaña Voz)");
                      toggleVoiceInput();
                    }}
                    className={`px-8 py-4 rounded-2xl font-semibold text-lg transition-all shadow-lg ${
                      voiceInput.isListening
                        ? "bg-red-600 hover:bg-red-500 text-white ring-4 ring-red-500/20"
                        : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white"
                    }`}
                  >
                    {voiceInput.isListening ? "⏹ Detener y Enviar" : "🎙️ Activar Micrófono"}
                  </button>

                  {voiceInput.error && (
                    <p className="mt-4 text-sm text-red-400">{voiceInput.error}</p>
                  )}
                </div>
              )}

              {activeTab === "vision" && (
                <div className="h-full rounded-xl border border-slate-800/60 bg-slate-950/60 p-6 flex flex-col">
                  {camera.isActive ? (
                    <>
                      <video
                        ref={camera.videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-64 rounded-xl bg-black mb-4 shadow-2xl"
                      />
                      
                      {/* Indicador de micrófono activo en modo visión */}
                      {voiceInput.isListening && (
                        <div className="mb-3 px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/30 text-red-300 text-sm flex items-center gap-2 animate-fadeIn">
                          <HiOutlineMicrophone className="w-4 h-4 animate-pulse" />
                          <span>Micrófono activo - Di "capturar" o haz clic abajo</span>
                        </div>
                      )}

                      {/* Mostrar input de voz si hay texto */}
                      {(input || voiceInput.interimTranscript) && (
                        <div className="mb-3 p-3 rounded-lg bg-slate-900/60 border border-violet-500/30 animate-fadeIn">
                          <p className="text-xs text-slate-500 mb-1">Tu pregunta:</p>
                          <p className="text-white text-sm">
                            {input}
                            {voiceInput.interimTranscript && (
                              <span className="text-slate-400 italic"> {voiceInput.interimTranscript}</span>
                            )}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleCaptureAndAnalyze}
                          className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg"
                        >
                          📸 Capturar y Analizar
                        </button>
                        <button
                          onClick={toggleVoiceInput}
                          className={`px-4 py-3 rounded-xl font-semibold transition-all ${
                            voiceInput.isListening
                              ? "bg-red-600/30 border border-red-500/50 text-red-300 ring-2 ring-red-500/30"
                              : "bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30"
                          }`}
                          title={voiceInput.isListening ? "Detener micrófono" : "Activar micrófono para describir qué analizar"}
                        >
                          <HiOutlineMicrophone className="w-5 h-5" />
                        </button>
                        <button
                          onClick={camera.stopCamera}
                          className="px-4 py-3 rounded-xl bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/30 transition-all"
                          title="Cerrar cámara"
                        >
                          <HiOutlineX className="w-5 h-5" />
                        </button>
                      </div>

                      <p className="mt-3 text-xs text-slate-500 text-center">
                        💡 Tip: Activa el micrófono y describe qué quieres saber sobre la imagen antes de capturar
                      </p>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <HiOutlineCamera className="w-24 h-24 text-violet-400 mb-6" />
                      <h3 className="text-xl font-bold text-white mb-2">Análisis Visual</h3>
                      <p className="text-sm text-slate-400 mb-6 text-center max-w-md">
                        Activa la cámara para capturar imágenes y analizarlas con IA
                      </p>
                      <button
                        onClick={() => camera.startCamera()}
                        className="px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-lg hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg"
                      >
                        Activar Cámara
                      </button>
                      {camera.error && (
                        <p className="mt-4 text-sm text-red-400">{camera.error}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "settings" && (
                <div className="h-full rounded-xl border border-slate-800/60 bg-slate-950/60 p-6 overflow-y-auto space-y-4">
                  <h3 className="text-lg font-bold text-white mb-4">⚙️ Configuración Avanzada</h3>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-700/50">
                      <span className="text-sm text-slate-300">Navegación automática</span>
                      <input
                        type="checkbox"
                        checked={settings.autoNavigate}
                        onChange={(e) => setSettings(prev => ({ ...prev, autoNavigate: e.target.checked }))}
                        className="w-5 h-5 rounded accent-violet-600"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-700/50">
                      <span className="text-sm text-slate-300">Salida de voz (TTS)</span>
                      <input
                        type="checkbox"
                        checked={settings.useVoiceOutput}
                        onChange={(e) => setSettings(prev => ({ ...prev, useVoiceOutput: e.target.checked }))}
                        className="w-5 h-5 rounded accent-violet-600"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-700/50">
                      <span className="text-sm text-slate-300">Modo Think (Extended Reasoning)</span>
                      <input
                        type="checkbox"
                        checked={settings.thinkMode}
                        onChange={(e) => setSettings(prev => ({ ...prev, thinkMode: e.target.checked }))}
                        className="w-5 h-5 rounded accent-violet-600"
                      />
                    </label>

                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/50">
                      <label className="text-sm text-slate-300 mb-2 block">Velocidad de voz</label>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={settings.voiceSpeed}
                        onChange={(e) => setSettings(prev => ({ ...prev, voiceSpeed: parseFloat(e.target.value) }))}
                        className="w-full accent-violet-600"
                      />
                      <span className="text-xs text-slate-500">{settings.voiceSpeed}x</span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/50">
                      <label className="text-sm text-slate-300 mb-2 block">Idioma</label>
                      <select
                        value={settings.language}
                        onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm"
                      >
                        <option value="es-ES">🇪🇸 Español</option>
                        <option value="en-US">🇺🇸 English</option>
                        <option value="fr-FR">🇫🇷 Français</option>
                        <option value="de-DE">🇩🇪 Deutsch</option>
                        <option value="it-IT">🇮🇹 Italiano</option>
                        <option value="pt-BR">🇧🇷 Português</option>
                      </select>
                    </div>

                    <div className="p-3 rounded-lg bg-gradient-to-r from-violet-900/40 to-indigo-900/40 border border-violet-500/30">
                      <label className="text-sm text-violet-300 mb-2 block font-semibold">🤖 Gemini API Key</label>
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={settings.geminiApiKey}
                        onChange={(e) => {
                          const key = e.target.value;
                          setSettings(prev => ({ ...prev, geminiApiKey: key }));
                          localStorage.setItem("rauli_gemini_key", key);
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-violet-500/50 text-slate-200 text-sm placeholder:text-slate-500 mb-2"
                      />
                      <label className="flex items-center gap-2 text-sm text-violet-300">
                        <input
                          type="checkbox"
                          checked={settings.useGeminiAI}
                          onChange={(e) => setSettings(prev => ({ ...prev, useGeminiAI: e.target.checked }))}
                          className="w-4 h-4 rounded accent-violet-600"
                        />
                        Usar Gemini AI (Streaming)
                      </label>
                      <p className="text-xs text-slate-500 mt-2">
                        Obtén tu API key en: <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">Google AI Studio</a>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
