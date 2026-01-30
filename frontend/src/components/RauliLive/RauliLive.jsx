import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { HiOutlineMicrophone, HiOutlineX } from "react-icons/hi";
import RauliAvatar from "./RauliAvatar";
import { useVoiceInput } from "../../hooks/useVoiceInput";
import { useVoiceSynthesis } from "../../hooks/useVoiceSynthesis";
import { useGeminiStream } from "../../hooks/useGeminiStream";
import { getGeminiApiKey } from "../../services/aiConfigPersistence";
import { RAULI_SYSTEM_PROMPT, getRauliContext } from "../../config/rauliPersonality";
import { useRauli } from "../../context/RauliContext";

/**
 * RAULI LIVE - Interfaz Conversacional Natural
 * 
 * Una sola pantalla. Un personaje. Conversación total.
 * Diseñado siguiendo principios de Conversation Design (Google)
 * y Voice User Interface Best Practices.
 */
export default function RauliLive() {
  const navigate = useNavigate();
  const { isOnline, pendingCount } = useRauli();

  // Estados
  const [gesture, setGesture] = useState("idle"); // idle, listening, thinking, speaking, happy, concerned
  const [currentMessage, setCurrentMessage] = useState("");
  const [conversationHistory, setConversationHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");

  useEffect(() => {
    getGeminiApiKey().then((k) => setGeminiApiKey(k || ""));
  }, []);

  // Refs
  const messageTimeoutRef = useRef(null);
  const wasVoiceInputRef = useRef(false);
  
  // 🛡️ Refs para funciones (prevenir "Cannot access before initialization")
  const showMessageRef = useRef(null);
  const handleUserMessageRef = useRef(null);

  // Hooks
  const voiceInput = useVoiceInput({
    lang: "es-ES",
    continuous: true,
    autoSend: true
  });

  const voiceSynthesis = useVoiceSynthesis({
    lang: "es-ES",
    rate: 1.0,
    volume: 0.9
  });

  // Context dinámico para RAULI
  const rauliContext = RAULI_SYSTEM_PROMPT + "\n\n" + getRauliContext({
    currentRoute: window.location.pathname,
    userName: "Jefe",
    companyName: "GENESIS",
    isOnline,
    pendingCount
  });

  const gemini = useGeminiStream({
    apiKey: geminiApiKey,
    model: "gemini-2.5-flash",
    systemPrompt: rauliContext
  });

  // Configurar callbacks de voz una sola vez
  useEffect(() => {
    voiceInput.onResult((text) => {
      setCurrentMessage(text);
    });

    voiceInput.onComplete((fullText) => {
      wasVoiceInputRef.current = true;
      if (handleUserMessageRef.current) {
        handleUserMessageRef.current(fullText);
      }
    });
  }, []);

  // Mensaje de bienvenida inicial (SOLO TEXTO, sin voz automática)
  useEffect(() => {
    setTimeout(() => {
      console.log("RAULI LIVE: 👋 Mostrando mensaje de bienvenida (solo texto)");
      setCurrentMessage("¡Hola! Soy RAULI, tu asistente inteligente. Click en el micrófono para hablar.");
    }, 1000);
  }, []);

  // Mostrar mensaje (temporal)
  const showMessage = useCallback((text, from = "rauli") => {
    console.log("RAULI LIVE: 📢 showMessage llamado", { 
      text: text.substring(0, 50) + "...", 
      from, 
      wasVoiceInput: wasVoiceInputRef.current 
    });
    
    setCurrentMessage(text);
    
    // Solo reproducir voz si:
    // 1. Es mensaje de RAULI
    // 2. El usuario inició la interacción por voz (wasVoiceInputRef)
    const shouldSpeak = from === "rauli" && wasVoiceInputRef.current;
    
    if (shouldSpeak) {
      console.log("RAULI LIVE: 🔊 Reproduciendo voz:", text.substring(0, 50) + "...");
      setGesture("speaking");
      
      // Reproducir voz
      voiceSynthesis.speak(text, {
        onend: () => {
          console.log("RAULI LIVE: ✅ Voz finalizada, reseteando flag");
          setGesture(voiceInput.isListening ? "listening" : "idle");
          
          // Resetear flag DESPUÉS de reproducir
          wasVoiceInputRef.current = false;
        }
      });
    } else {
      console.log("RAULI LIVE: 🔇 No se reproduce voz (shouldSpeak:", shouldSpeak, ")");
      
      // Si no se reproduce voz, resetear el flag inmediatamente
      if (from === "rauli") {
        wasVoiceInputRef.current = false;
      }
    }

    // Auto-ocultar después de 8 segundos
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    messageTimeoutRef.current = setTimeout(() => {
      setCurrentMessage("");
    }, 8000);
  }, [voiceInput.isListening, voiceSynthesis]);

  // Procesar comando de navegación
  const processNavigationCommand = useCallback((text) => {
    const textLower = text.toLowerCase();
    
    // Patrones de navegación
    const navPatterns = {
      inventario: /inventario|productos|stock/i,
      ventas: /ventas|vender|factura/i,
      compras: /compras|comprar|proveedor/i,
      contabilidad: /contabilidad|contable|asiento|balance/i,
      clientes: /clientes|cliente/i,
      reportes: /reportes|reporte|informe/i,
      dashboard: /dashboard|inicio|principal|panel/i
    };

    for (const [route, pattern] of Object.entries(navPatterns)) {
      if (pattern.test(textLower)) {
        setGesture("happy");
        setTimeout(() => {
          navigate(`/${route}`);
          if (showMessageRef.current) {
            showMessageRef.current(`Accediendo a ${route}...`, "rauli");
          }
          setGesture("idle");
        }, 500);
        return true;
      }
    }

    return false;
  }, [navigate]);

  // Manejar mensaje del usuario
  const handleUserMessage = useCallback(async (text) => {
    if (!text.trim()) return;

    console.log("RAULI LIVE: 📨 Mensaje recibido:", text);

    // Agregar a historial
    setConversationHistory(prev => [...prev, {
      id: Date.now(),
      from: "user",
      text,
      timestamp: new Date()
    }]);

    // Mostrar mensaje del usuario brevemente
    if (showMessageRef.current) {
      showMessageRef.current(text, "user");
    }

    // Cambiar a gesto pensando
    setGesture("thinking");

    // Verificar si es comando de navegación
    if (processNavigationCommand(text)) {
      wasVoiceInputRef.current = false;
      return;
    }

    // Procesar con Gemini (si está configurado - persistencia dual)
    if (geminiApiKey && geminiApiKey.length > 10) {
      try {
        const response = await gemini.sendMessage(text);
        
        setConversationHistory(prev => [...prev, {
          id: Date.now() + 1,
          from: "rauli",
          text: response,
          timestamp: new Date()
        }]);

        if (showMessageRef.current) {
          showMessageRef.current(response, "rauli");
        }
      } catch (error) {
        console.error("Error con Gemini:", error);
        if (showMessageRef.current) {
          showMessageRef.current("Lo siento, tuve un problema al procesar tu mensaje. ¿Puedes intentar de nuevo?", "rauli");
        }
      }
    } else {
      // Respuesta local básica
      const responses = [
        "Entendido. ¿Hay algo más en lo que pueda ayudarte?",
        "De acuerdo. ¿Necesitas algo más?",
        "Perfecto. Estoy aquí si necesitas ayuda.",
        "Claro. ¿Qué más puedo hacer por ti?"
      ];
      
      const response = responses[Math.floor(Math.random() * responses.length)];
      
      setTimeout(() => {
        setConversationHistory(prev => [...prev, {
          id: Date.now() + 1,
          from: "rauli",
          text: response,
          timestamp: new Date()
        }]);

        if (showMessageRef.current) {
          showMessageRef.current(response, "rauli");
        }
      }, 800);
    }
    
    // NOTA: wasVoiceInputRef se resetea dentro de showMessage después de reproducir voz
  }, [gemini, geminiApiKey, processNavigationCommand]);

  // 🛡️ Actualizar refs de funciones después de sus definiciones
  useEffect(() => {
    showMessageRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    handleUserMessageRef.current = handleUserMessage;
  }, [handleUserMessage]);

  // Toggle micrófono
  const toggleMicrophone = useCallback(() => {
    if (voiceInput.isListening) {
      console.log("RAULI LIVE: 🛑 Deteniendo micrófono y voz");
      
      // Detener escucha
      voiceInput.stopListening();
      
      // Detener voz si está hablando
      voiceSynthesis.stop();
      
      // Resetear flags
      wasVoiceInputRef.current = false;
      
      // Gesto idle
      setGesture("idle");
    } else {
      console.log("RAULI LIVE: 🎤 Activando micrófono");
      voiceInput.startListening();
      setGesture("listening");
    }
  }, [voiceInput, voiceSynthesis]);

  // Detener voz si el micrófono se detiene inesperadamente
  useEffect(() => {
    if (!voiceInput.isListening && voiceSynthesis.isSpeaking) {
      console.log("RAULI LIVE: ⚠️ Micrófono detenido, deteniendo voz");
      voiceSynthesis.stop();
      setGesture("idle");
    }
  }, [voiceInput.isListening, voiceSynthesis]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center overflow-hidden relative">
      {/* Background effects mejorados */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grid sutil de fondo */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        
        {/* Efectos de luz */}
        <motion.div
          className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px]"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.2, 0.4, 0.2],
            x: [0, 30, 0]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px]"
          animate={{
            scale: [1.15, 1, 1.15],
            opacity: [0.4, 0.2, 0.4],
            x: [0, -30, 0]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[100px]"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.15, 0.25, 0.15]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 py-8">
        
        {/* Logo/Título RAULI LIVE */}
        <motion.div 
          className="absolute top-8 left-8"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <span className="text-xl">👩</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">RAULI</h1>
              <p className="text-xs text-violet-400 font-medium">Live Assistant</p>
            </div>
          </div>
        </motion.div>
        
        {/* Top Info Bar - Elegante */}
        <motion.div 
          className="absolute top-8 right-8 flex items-center gap-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Status Online/Offline */}
          <motion.div 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl ${
              isOnline 
                ? 'bg-emerald-500/10 border border-emerald-500/30' 
                : 'bg-amber-500/10 border border-amber-500/30'
            }`}
            whileHover={{ scale: 1.05 }}
          >
            <div className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-emerald-400 shadow-emerald-400/50' : 'bg-amber-400 shadow-amber-400/50'
            } animate-pulse shadow-lg`} />
            <span className={`text-xs font-medium ${
              isOnline ? 'text-emerald-300' : 'text-amber-300'
            }`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </motion.div>

          {/* Historial Button */}
          {conversationHistory.length > 0 && (
            <motion.button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-1.5 rounded-full bg-slate-800/50 hover:bg-slate-700/60 backdrop-blur-xl border border-slate-700/50 transition-all text-xs text-slate-300 font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Historial · {conversationHistory.length}
            </motion.button>
          )}
        </motion.div>

        {/* Avatar Central */}
        <motion.div
          className="flex flex-col items-center justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <RauliAvatar
            gesture={gesture}
            isListening={voiceInput.isListening}
            isSpeaking={voiceSynthesis.isSpeaking}
          />
        </motion.div>

        {/* Mensaje Flotante Elegante */}
        <AnimatePresence>
          {currentMessage && (
            <motion.div
              className="mt-10 mx-auto max-w-2xl px-6"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-3xl blur-xl" />
                
                {/* Contenido */}
                <div className="relative bg-gradient-to-br from-slate-800/95 via-slate-800/90 to-slate-900/95 backdrop-blur-2xl rounded-3xl px-8 py-6 shadow-2xl border border-slate-700/50">
                  <p className="text-slate-50 text-lg leading-relaxed text-center font-light tracking-wide">
                    {currentMessage}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botón de Micrófono Profesional */}
        <motion.div
          className="mt-12 flex justify-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="relative">
            {/* Anillos de pulso cuando está activo */}
            {voiceInput.isListening && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500"
                  animate={{
                    scale: [1, 1.6, 1.6],
                    opacity: [0.5, 0, 0]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500"
                  animate={{
                    scale: [1, 1.4, 1.4],
                    opacity: [0.4, 0, 0]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                />
              </>
            )}
            
            {/* Botón principal */}
            <motion.button
              onClick={toggleMicrophone}
              className={`relative p-8 rounded-full shadow-2xl transition-all ${
                voiceInput.isListening
                  ? 'bg-gradient-to-br from-cyan-500 via-blue-500 to-blue-600 shadow-cyan-500/50'
                  : 'bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 shadow-violet-500/50'
              }`}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              style={{
                boxShadow: voiceInput.isListening 
                  ? '0 0 50px rgba(6, 182, 212, 0.4), 0 0 20px rgba(34, 211, 238, 0.3)' 
                  : '0 0 40px rgba(139, 92, 246, 0.3), 0 0 15px rgba(167, 139, 250, 0.2)'
              }}
            >
              {/* Círculo interno con efecto */}
              <div className={`absolute inset-2 rounded-full ${
                voiceInput.isListening ? 'bg-cyan-400/20' : 'bg-violet-400/20'
              } animate-pulse`} />
              
              <HiOutlineMicrophone 
                className={`w-10 h-10 relative z-10 transition-all ${
                  voiceInput.isListening ? 'text-white scale-110' : 'text-white/95'
                }`}
              />
            </motion.button>
          </div>
        </motion.div>

        {/* Indicador de Estado Elegante */}
        <motion.div
          className="text-center mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {voiceInput.isListening ? (
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-cyan-300 font-medium text-sm tracking-wide">Escuchando...</span>
            </motion.div>
          ) : (
            <p className="text-slate-400 text-sm font-light tracking-wide">
              Click en el micrófono para comenzar
            </p>
          )}
        </motion.div>

        {/* Panel de Historial (Drawer lateral) */}
        <AnimatePresence>
          {showHistory && (
            <>
              {/* Overlay */}
              <motion.div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowHistory(false)}
              />

              {/* Drawer */}
              <motion.div
                className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-slate-800 shadow-2xl z-50 overflow-y-auto"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-slate-100">Historial de Conversación</h3>
                    <button
                      onClick={() => setShowHistory(false)}
                      className="p-2 rounded-lg hover:bg-slate-700/50 transition-all"
                    >
                      <HiOutlineX className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="space-y-4">
                    {conversationHistory.map((msg) => (
                      <motion.div
                        key={msg.id}
                        className={`p-4 rounded-xl ${
                          msg.from === "user"
                            ? "bg-indigo-600/20 ml-8"
                            : "bg-violet-600/20 mr-8"
                        }`}
                        initial={{ opacity: 0, x: msg.from === "user" ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <p className="text-sm text-slate-300 mb-1 font-medium">
                          {msg.from === "user" ? "Tú" : "RAULI"}
                        </p>
                        <p className="text-slate-100 text-sm">{msg.text}</p>
                        <p className="text-xs text-slate-500 mt-2">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
