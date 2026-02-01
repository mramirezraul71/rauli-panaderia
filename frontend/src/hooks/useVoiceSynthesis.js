import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook para síntesis de voz (Text-to-Speech)
 * Características avanzadas:
 * - Control de velocidad, tono y volumen
 * - Voces múltiples
 * - Cola de reproducción
 * - Eventos de progreso
 */
export function useVoiceSynthesis({ lang = "es-ES", rate = 1.0, pitch = 1.0, volume = 0.8 } = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [isSupported, setIsSupported] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const synthesisRef = useRef(null);
  const utteranceRef = useRef(null);
  const lastTextRef = useRef(""); // 🛡️ Para prevenir repeticiones
  const isSpeakingRef = useRef(false); // 🛡️ Flag de estado síncrono

  useEffect(() => {
    if (!window.speechSynthesis) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    synthesisRef.current = window.speechSynthesis;

    const loadVoices = () => {
      const availableVoices = synthesisRef.current.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    
    // Chrome/Edge necesitan evento para cargar voces
    if (synthesisRef.current.onvoiceschanged !== undefined) {
      synthesisRef.current.onvoiceschanged = loadVoices;
    }

    return () => {
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
    };
  }, []);

  const speak = useCallback((text, options = {}) => {
    console.log("useVoiceSynthesis: 🔊 speak() llamado", { 
      texto: text?.substring(0, 50) + "...", 
      isSupported: !!synthesisRef.current,
      voicesLoaded: voices.length,
      currentlySpeaking: isSpeakingRef.current
    });
    
    if (!synthesisRef.current || !text) {
      console.warn("useVoiceSynthesis: ❌ No se puede hablar", { 
        noSynthesis: !synthesisRef.current,
        noText: !text
      });
      return;
    }

    // 🛡️ PREVENCIÓN DE DUPLICADOS: Si ya está hablando el mismo texto, ignorar
    if (isSpeakingRef.current && lastTextRef.current === text) {
      console.warn("useVoiceSynthesis: ⚠️ Ya estoy hablando este texto, ignorando duplicado");
      return;
    }

    // 🛡️ Si está hablando otro texto, cancelar primero
    if (isSpeakingRef.current) {
      console.log("useVoiceSynthesis: Cancelando habla anterior para nuevo mensaje");
      synthesisRef.current.cancel();
    }

    lastTextRef.current = text;
    console.log("useVoiceSynthesis: Iniciando síntesis de voz...");

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configuración
    utterance.lang = options.lang || lang;
    utterance.rate = options.rate || rate;
    utterance.pitch = options.pitch || pitch;
    utterance.volume = options.volume || volume;

    // 🎤 Seleccionar voz FEMENINA en español
    if (options.voice) {
      const selectedVoice = voices.find(v => v.name === options.voice);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    } else {
      // Preferencia: Voces femeninas en español
      const langPrefix = lang.split("-")[0]; // "es"
      
      // Lista de nombres de voces femeninas comunes en español (por navegador)
      const femaleNames = [
        "Google español de Estados Unidos", // Chrome
        "Microsoft Helena - Spanish (Spain)", // Edge
        "Microsoft Sabina - Spanish (Mexico)", // Edge
        "Microsoft Laura - Spanish (Spain)", // Edge  
        "Paulina", // macOS
        "Monica", // macOS
        "Amelie", // Firefox
        "es-ES-Standard-A", // Google Cloud
        "es-MX-Standard-A" // Google Cloud
      ];
      
      // 1. Buscar voz femenina por nombre conocido
      let femaleVoice = voices.find(v => 
        v.lang.startsWith(langPrefix) && 
        femaleNames.some(name => v.name.includes(name))
      );
      
      // 2. Si no encuentra por nombre, buscar cualquier voz en español
      if (!femaleVoice) {
        femaleVoice = voices.find(v => v.lang.startsWith(langPrefix));
      }
      
      if (femaleVoice) {
        console.log("useVoiceSynthesis: 👩 Voz seleccionada:", femaleVoice.name);
        utterance.voice = femaleVoice;
      } else {
        console.warn("useVoiceSynthesis: ⚠️ No se encontró voz en español, usando default");
      }
    }

    // Eventos
    utterance.onstart = () => {
      console.log("useVoiceSynthesis: ✅ Voz INICIADA - HABLANDO");
      isSpeakingRef.current = true; // 🛡️ Flag síncrono
      setIsSpeaking(true);
      setProgress(0);
      
      // Callback personalizado
      if (options.onstart) options.onstart();
    };

    utterance.onend = () => {
      console.log("useVoiceSynthesis: ✅ Voz FINALIZADA");
      isSpeakingRef.current = false; // 🛡️ Flag síncrono
      lastTextRef.current = ""; // Limpiar para permitir repetir el mismo texto después
      setIsSpeaking(false);
      setProgress(100);
      
      // Callback personalizado
      if (options.onend) options.onend();
    };

    utterance.onerror = (event) => {
      console.error("useVoiceSynthesis: ❌ Error en síntesis:", event.error);
      isSpeakingRef.current = false; // 🛡️ Flag síncrono
      lastTextRef.current = ""; // Limpiar
      setIsSpeaking(false);
    };

    utterance.onboundary = (event) => {
      // Actualizar progreso basado en posición del carácter
      const percent = (event.charIndex / text.length) * 100;
      setProgress(percent);
    };

    utteranceRef.current = utterance;
    synthesisRef.current.speak(utterance);
  }, [lang, rate, pitch, volume, voices]);

  const stop = useCallback(() => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      isSpeakingRef.current = false; // 🛡️ Limpiar flag
      lastTextRef.current = ""; // 🛡️ Limpiar último texto
      setIsSpeaking(false);
      setProgress(0);
    }
  }, []);

  const pause = useCallback(() => {
    if (synthesisRef.current && isSpeaking) {
      synthesisRef.current.pause();
    }
  }, [isSpeaking]);

  const resume = useCallback(() => {
    if (synthesisRef.current && isSpeaking) {
      synthesisRef.current.resume();
    }
  }, [isSpeaking]);

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isSupported,
    voices,
    progress
  };
}
