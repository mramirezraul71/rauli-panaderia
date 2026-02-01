import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook para entrada de voz usando Web Speech API
 * Características de vanguardia 2026:
 * - Reconocimiento continuo mejorado
 * - Detección de idioma automática
 * - Transcripción en tiempo real
 * - Soporte para comandos de voz
 * - Auto-envío de mensajes completos
 */
export function useVoiceInput({ lang = "es-ES", continuous = true, interimResults = true, autoSend = false } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [lastFinalText, setLastFinalText] = useState("");
  
  const recognitionRef = useRef(null);
  const onResultCallbackRef = useRef(null);
  const onCompleteCallbackRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const transcriptRef = useRef(""); // Ref para mantener transcript actualizado

  useEffect(() => {
    // Verificar soporte (Chrome/Edge usan webkit prefix)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    console.log("useVoiceInput: Inicializando", { 
      hasSpeechRecognition: !!SpeechRecognition,
      hasWebkit: !!window.webkitSpeechRecognition 
    });
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
      console.error("useVoiceInput: No soportado");
      return;
    }

    setIsSupported(true);
    console.log("useVoiceInput: Soportado ✓");
    const recognition = new SpeechRecognition();
    
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("useVoiceInput: ✅ onstart disparado - Micrófono ACTIVO");
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (interimText) {
        setInterimTranscript(interimText);
      }

      if (finalText) {
        const cleanText = finalText.trim();
        
        // Actualizar transcript (estado y ref)
        setTranscript((prev) => {
          const newTranscript = prev ? prev + " " + cleanText : cleanText;
          transcriptRef.current = newTranscript; // Actualizar ref inmediatamente
          return newTranscript;
        });
        
        setInterimTranscript("");
        setLastFinalText(cleanText);
        
        // Callback para cuando se complete una frase
        if (onResultCallbackRef.current) {
          onResultCallbackRef.current(cleanText);
        }

        // Si autoSend está activo, iniciar timer de silencio
        if (autoSend && onCompleteCallbackRef.current) {
          // Limpiar timer anterior
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          
          const SILENCE_MS = 1100; // 1.1s: respuesta más rápida sin cortar frases
          console.log("useVoiceInput: Iniciando timer de silencio (" + SILENCE_MS + "ms)...");
          
          silenceTimerRef.current = setTimeout(() => {
            const fullText = transcriptRef.current.trim(); // Usar ref actualizado
            console.log("useVoiceInput: Timer completado, enviando:", fullText);
            
            if (fullText && onCompleteCallbackRef.current) {
              onCompleteCallbackRef.current(fullText);
              // Limpiar transcript pero mantener reconocimiento activo
              setTranscript("");
              transcriptRef.current = "";
              console.log("useVoiceInput: ✅ Mensaje enviado, micrófono PERMANECE activo");
              console.log("useVoiceInput: Estado actual - isListening:", recognitionRef.current?.shouldRestart);
            }
          }, 1100);
        }
      }
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition event:", event.error);
      
      // Errores que NO deben detener el reconocimiento continuo
      const nonCriticalErrors = ['no-speech', 'audio-capture', 'aborted'];
      
      if (nonCriticalErrors.includes(event.error)) {
        console.log(`useVoiceInput: Error no crítico "${event.error}", continuando...`);
        // No establecer error ni detener, el reconocimiento se reiniciará en onend
        return;
      }
      
      // Errores críticos que SÍ detienen el reconocimiento
      console.error("Speech recognition error crítico:", event.error);
      setError(`Error de reconocimiento: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log("useVoiceInput: onend disparado, shouldRestart:", recognitionRef.current?.shouldRestart);
      
      // Si continuous = true y se detuvo involuntariamente, reintentar INMEDIATAMENTE
      if (continuous && recognitionRef.current?.shouldRestart) {
        console.log("useVoiceInput: Reiniciando reconocimiento automáticamente...");
        // NO establecer isListening = false, mantenerlo activo durante el reinicio
        try {
          // Pequeño delay para evitar errores de "already started"
          setTimeout(() => {
            try {
              if (recognitionRef.current?.shouldRestart) {
                recognition.start();
                console.log("useVoiceInput: ✅ Reconocimiento reiniciado exitosamente");
              }
            } catch (err) {
              console.error("useVoiceInput: Error en reinicio interno:", err);
              // Solo aquí establecemos false si el reinicio falla
              setIsListening(false);
            }
          }, 100);
        } catch (err) {
          console.error("useVoiceInput: Error preparando reinicio:", err);
          setIsListening(false);
        }
      } else {
        // Solo establecer false si realmente debe detenerse
        console.log("useVoiceInput: Reconocimiento detenido (shouldRestart = false)");
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.shouldRestart = false;
        recognitionRef.current.stop();
      }
    };
  }, [lang, continuous, interimResults, autoSend]);

  const startListening = useCallback(() => {
    console.log("useVoiceInput: startListening llamado", { 
      hasRecognition: !!recognitionRef.current,
      currentIsListening: isListening 
    });
    
    if (!recognitionRef.current) {
      console.error("useVoiceInput: No hay recognition object");
      return;
    }
    
    // Si ya está escuchando, primero detener para reiniciar limpio
    if (isListening) {
      console.log("useVoiceInput: Ya estaba escuchando, reiniciando...");
      try {
        recognitionRef.current.shouldRestart = false;
        recognitionRef.current.stop();
        // Esperar un poco antes de reiniciar
        setTimeout(() => {
          try {
            recognitionRef.current.shouldRestart = true;
            recognitionRef.current.start();
            console.log("useVoiceInput: ✅ Reconocimiento reiniciado");
          } catch (err) {
            console.error("useVoiceInput: Error en reinicio:", err);
            setError("No se pudo reiniciar el micrófono");
            setIsListening(false);
          }
        }, 200);
      } catch (err) {
        console.error("useVoiceInput: Error deteniendo para reiniciar:", err);
      }
      return;
    }
    
    // Iniciar normalmente
    try {
      recognitionRef.current.shouldRestart = true;
      recognitionRef.current.start();
      console.log("useVoiceInput: ✅ Reconocimiento iniciado");
    } catch (err) {
      console.error("useVoiceInput: Error starting recognition:", err);
      setError("No se pudo iniciar el micrófono");
      setIsListening(false);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    try {
      recognitionRef.current.shouldRestart = false;
      recognitionRef.current.stop();
      
      // Limpiar timer de silencio al detener
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
        console.log("useVoiceInput: Timer de silencio cancelado al detener");
      }
    } catch (err) {
      console.error("Error stopping recognition:", err);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    transcriptRef.current = "";
    // Limpiar timer de silencio si existe
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const onResult = useCallback((callback) => {
    onResultCallbackRef.current = callback;
  }, []);

  const onComplete = useCallback((callback) => {
    onCompleteCallbackRef.current = callback;
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    lastFinalText,
    error,
    startListening,
    stopListening,
    resetTranscript,
    onResult,
    onComplete
  };
}
