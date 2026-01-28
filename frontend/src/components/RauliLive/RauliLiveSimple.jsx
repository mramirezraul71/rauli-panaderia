import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { HiOutlineMicrophone, HiOutlineX, HiOutlineArrowLeft } from "react-icons/hi";
import RauliAvatar from "./RauliAvatar";
import { useVoiceInput } from "../../hooks/useVoiceInput";
import { useVoiceSynthesis } from "../../hooks/useVoiceSynthesis";
import { useRauli } from "../../context/RauliContext";

/**
 * RAULI LIVE - Versión Simplificada y Estable
 * 
 * Arquitectura simple sin callbacks complejos
 */
export default function RauliLiveSimple() {
  const navigate = useNavigate();
  const { isOnline } = useRauli();

  // Estados
  const [gesture, setGesture] = useState("idle");
  const [currentMessage, setCurrentMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs
  const lastProcessedTextRef = useRef("");
  const isSpeakingRef = useRef(false);
  const wasListeningRef = useRef(false); // Para detectar cambio de estado

  // Hooks
  const voiceInput = useVoiceInput({
    lang: "es-ES",
    continuous: false, // Cambiar a false para más control
    autoSend: false     // Cambiar a false para control manual
  });

  const voiceSynthesis = useVoiceSynthesis({
    lang: "es-ES",
    rate: 1.0,
    volume: 0.9
  });

  // Procesar comando de navegación
  const processNavigationCommand = useCallback((text) => {
    const textLower = text.toLowerCase();
    
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
        }, 500);
        return `Accediendo a ${route}...`;
      }
    }

    return null;
  }, [navigate]);

  // Generar respuesta simple
  const generateResponse = useCallback((text) => {
    // Verificar navegación
    const navResponse = processNavigationCommand(text);
    if (navResponse) return navResponse;

    // Respuestas básicas
    const textLower = text.toLowerCase();
    
    if (/hola|hey|buenos|buenas/i.test(textLower)) {
      return "¡Hola! ¿En qué puedo ayudarte?";
    }
    
    if (/adiós|chao|hasta luego/i.test(textLower)) {
      return "¡Hasta luego! Que tengas un buen día.";
    }
    
    if (/gracias/i.test(textLower)) {
      return "De nada, estoy aquí para ayudarte.";
    }

    // Respuesta genérica
    const responses = [
      "Entendido. ¿Hay algo más en lo que pueda ayudarte?",
      "De acuerdo. ¿Necesitas algo más?",
      "Perfecto. Estoy aquí si necesitas ayuda."
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }, [processNavigationCommand]);

  // Manejar resultado de voz (mostrar mientras habla)
  useEffect(() => {
    if (voiceInput.transcript && voiceInput.isListening) {
      setCurrentMessage(voiceInput.transcript);
    }
  }, [voiceInput.transcript, voiceInput.isListening]);

  // Manejar cuando el reconocimiento se detiene (procesar mensaje)
  useEffect(() => {
    // Detectar cuando isListening cambia de TRUE a FALSE
    const justStopped = wasListeningRef.current && !voiceInput.isListening;
    
    console.log("RAULI LIVE: 🔍 useEffect disparado", {
      wasListening: wasListeningRef.current,
      isListening: voiceInput.isListening,
      justStopped,
      transcript: voiceInput.transcript,
      isProcessing
    });
    
    // Actualizar ref para próxima vez
    wasListeningRef.current = voiceInput.isListening;
    
    // Solo procesar si:
    // 1. Acabamos de dejar de escuchar (justStopped)
    // 2. Hay un transcript
    // 3. No estamos procesando ya
    if (justStopped && voiceInput.transcript && !isProcessing) {
      const text = voiceInput.transcript.trim();
      
      // Prevenir procesar texto vacío o duplicado
      if (text && text !== lastProcessedTextRef.current) {
        console.log("RAULI LIVE: 📨 Procesando mensaje:", text);
        lastProcessedTextRef.current = text;
        setIsProcessing(true);
        
        // Cambiar a pensando
        setGesture("thinking");
        
        // Procesar después de un delay
        setTimeout(() => {
          const response = generateResponse(text);
          
          console.log("RAULI LIVE: 🔊 Reproduciendo respuesta:", response);
          
          // Mostrar y hablar
          setCurrentMessage(response);
          setGesture("speaking");
          isSpeakingRef.current = true;
          
          voiceSynthesis.speak(response, {
            onend: () => {
              console.log("RAULI LIVE: ✅ Voz finalizada");
              isSpeakingRef.current = false;
              setGesture("idle");
              setIsProcessing(false);
              
              // Limpiar después de 3 segundos
              setTimeout(() => {
                setCurrentMessage("");
              }, 3000);
            }
          });
        }, 800);
      }
    }
  }, [voiceInput.isListening, voiceInput.transcript, isProcessing, generateResponse, voiceSynthesis]);

  // Toggle micrófono
  const toggleMicrophone = useCallback(() => {
    if (voiceInput.isListening) {
      console.log("RAULI LIVE: 🛑 Deteniendo");
      
      // Detener todo
      voiceInput.stopListening();
      voiceSynthesis.stop();
      
      // Resetear
      isSpeakingRef.current = false;
      wasListeningRef.current = false;
      setIsProcessing(false);
      setGesture("idle");
      
    } else {
      console.log("RAULI LIVE: 🎤 Activando");
      
      // Limpiar estado anterior
      lastProcessedTextRef.current = "";
      wasListeningRef.current = false;
      setCurrentMessage("");
      
      // Iniciar
      voiceInput.startListening();
      setGesture("listening");
    }
  }, [voiceInput, voiceSynthesis]);

  // Sincronizar gesto con estado
  useEffect(() => {
    if (voiceInput.isListening && gesture === "idle" && !isProcessing) {
      setGesture("listening");
    }
  }, [voiceInput.isListening, gesture, isProcessing]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center overflow-hidden relative">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        
        <motion.div
          className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px]"
          animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <motion.div
          className="absolute bottom-1/4 -right-20 w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[140px]"
          animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.35, 0.15], x: [-20, 20, -20] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-fuchsia-600/10 rounded-full blur-[160px]"
          animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.25, 0.1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </div>

      {/* Contenido principal */}
      <div className="relative z-10 flex flex-col items-center gap-12 px-4">
        {/* Avatar */}
        <RauliAvatar 
          gesture={gesture}
          isListening={voiceInput.isListening}
          isSpeaking={isSpeakingRef.current}
          volume={0.5}
        />

        {/* Mensaje flotante */}
        {currentMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="relative max-w-2xl"
          >
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-violet-600/30 via-purple-600/30 to-fuchsia-600/30 rounded-3xl blur-2xl opacity-75" />
            
            {/* Contenido */}
            <div className="relative px-8 py-5 bg-gradient-to-br from-slate-800/90 via-slate-900/95 to-indigo-900/90 backdrop-blur-2xl rounded-3xl border border-violet-500/20 shadow-2xl">
              <p className="text-white text-lg font-medium text-center tracking-wide leading-relaxed">
                {currentMessage}
              </p>
            </div>
          </motion.div>
        )}

        {/* Botón micrófono */}
        <motion.button
          onClick={toggleMicrophone}
          disabled={isProcessing && !voiceInput.isListening}
          className="relative group disabled:opacity-50 disabled:cursor-not-allowed"
          whileTap={{ scale: 0.95 }}
        >
          {/* Pulso 1 */}
          {voiceInput.isListening && (
            <motion.div
              className="absolute inset-0 rounded-full bg-cyan-500/30"
              animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          
          {/* Pulso 2 */}
          {voiceInput.isListening && (
            <motion.div
              className="absolute inset-0 rounded-full bg-cyan-400/20"
              animate={{ scale: [1, 2, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
            />
          )}

          {/* Botón */}
          <div 
            className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
              voiceInput.isListening
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_40px_rgba(6,182,212,0.6)]'
                : 'bg-gradient-to-br from-violet-600 to-purple-700 shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:shadow-[0_0_40px_rgba(139,92,246,0.6)]'
            }`}
          >
            {/* Círculo interno pulsante */}
            {voiceInput.isListening && (
              <motion.div
                className="absolute inset-2 rounded-full bg-white/20"
                animate={{ scale: [1, 0.8, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            <motion.div
              animate={voiceInput.isListening ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <HiOutlineMicrophone className="w-9 h-9 text-white relative z-10" />
            </motion.div>
          </div>
        </motion.button>

        {/* Estado */}
        <div className="text-center">
          {voiceInput.isListening ? (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-400/30 rounded-full text-cyan-300 text-sm font-medium backdrop-blur-sm"
            >
              <motion.span
                className="w-2 h-2 bg-cyan-400 rounded-full"
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              Escuchando...
            </motion.span>
          ) : (
            <span className="text-slate-400 text-sm">
              {isProcessing ? "Procesando..." : "Click para hablar"}
            </span>
          )}
        </div>
      </div>

      {/* Botón volver */}
      <button
        onClick={() => navigate("/dashboard")}
        className="fixed top-6 left-6 p-3 bg-slate-800/80 hover:bg-slate-700/80 backdrop-blur-sm rounded-xl border border-slate-700/50 text-white transition-all hover:scale-105"
      >
        <HiOutlineArrowLeft className="w-6 h-6" />
      </button>

      {/* Info */}
      <div className="fixed top-6 right-6 flex items-center gap-3">
        <div className={`px-3 py-1.5 rounded-lg backdrop-blur-sm text-xs font-medium ${
          isOnline 
            ? 'bg-emerald-500/10 border border-emerald-400/30 text-emerald-300'
            : 'bg-red-500/10 border border-red-400/30 text-red-300'
        }`}>
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>
    </div>
  );
}
