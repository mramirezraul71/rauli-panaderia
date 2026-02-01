/**
 * VoiceAssistant.jsx - Asistente de Voz GENESIS
 * Botón flotante + Chat Modal con IA
 * Desarrollador: Ing. RAUL MARTINEZ RAMIREZ
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { AIEngine } from "../services/AIEngine";
import { useLocalBrain } from "../services/ai/LocalBrain";
import { useWelcomeTour } from "./WelcomeTour";
import { db } from "../services/dataService";
import toast from "react-hot-toast";
import { HiOutlineMicrophone, HiOutlineX, HiOutlinePaperAirplane, HiOutlineSparkles, HiOutlineCamera } from "react-icons/hi";
import PremiumFeature from "./PremiumFeature";

export default function VoiceAssistant({ onAction }) {
  const localBrain = useLocalBrain();
  const { openTour } = useWelcomeTour();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "¡Hola! Soy GENESIS, tu asistente inteligente. Puedo ayudarte con ventas, inventario, reportes y más. ¿Qué necesitas?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [aiAutomationEnabled, setAiAutomationEnabled] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [fabPosition, setFabPosition] = useState({ x: null, y: null });
  const [isDragging, setIsDragging] = useState(false);
  const dragEnabled = false;
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragMovedRef = useRef(false);
  const fabButtonRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const sendSoundRef = useRef(null);
  const receiveSoundRef = useRef(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    if (!dragEnabled) return;
    try {
      const stored = localStorage.getItem("genesis_ai_fab_pos");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
          setFabPosition(clampFabPosition(parsed.x, parsed.y));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setFabPosition(prev => {
        if (!Number.isFinite(prev?.x) || !Number.isFinite(prev?.y)) return prev;
        return clampFabPosition(prev.x, prev.y);
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let rafId = null;
    const ensureFabVisible = () => {
      if (isDragging) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const node = fabButtonRef.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const margin = 12;
        const outOfView = rect.bottom < margin ||
          rect.top > window.innerHeight - margin ||
          rect.right < margin ||
          rect.left > window.innerWidth - margin;
        if (outOfView) {
          setFabPosition({ x: null, y: null });
          try { localStorage.removeItem("genesis_ai_fab_pos"); } catch {}
          return;
        }
        if (Number.isFinite(fabPosition?.x) && Number.isFinite(fabPosition?.y)) {
          const clamped = clampFabPosition(fabPosition.x, fabPosition.y);
          if (clamped.x !== fabPosition.x || clamped.y !== fabPosition.y) {
            setFabPosition(clamped);
          }
        }
      });
    };
    ensureFabVisible();
    window.addEventListener("resize", ensureFabVisible);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", ensureFabVisible);
    };
  }, [fabPosition, isDragging]);

  useEffect(() => {
    try {
      sendSoundRef.current = new Audio(
        "data:audio/wav;base64,UklGRuQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVwAAABg/1b/YP9i/1j/YP9m/2T/YP9k/1v/WP9Y/1T/Uf9Q/0v/S/9I/0X/Q/9A/zv/O/84/zb/Nf80/zP/Mv8y/zH/Mf8x/zH/Mf8x/zH/Mf8x/zH/Mf8x/zH/Mf8x/zH/Mf8x/zH/Mf8x/zH/Mf8x/zH/Mf8x/zH/Mf8x"
      );
      receiveSoundRef.current = new Audio(
        "data:audio/wav;base64,UklGRvQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YbQAAABg/2T/aP9s/3D/dP94/37/gf+F/4n/jf+R/5T/l/+a/53/oP+i/6T/pf+m/6b/p/+n/6b/pf+k/6L/oP+d/5r/l/+U/5H/jf+J/4b/gv9+/3r/dv9y/27/a/9n/2P/X/9b/1T/Uv9Q/07/Tf9K/0f/RP9B/z//Pf87/zn/N/82/zT/M/8z/zL/Mv8y/zL/Mv8y"
      );
      sendSoundRef.current.volume = 0.2;
      receiveSoundRef.current.volume = 0.25;
    } catch {}
  }, []);

  useEffect(() => {
    const loadAutomation = async () => {
      try {
        const setting = await db.settings?.get("ai_automation_enabled");
        if (setting?.value !== undefined) {
          setAiAutomationEnabled(setting.value === "true" || setting.value === true);
        }
      } catch {}
    };
    loadAutomation();
  }, []);

  const playSound = (ref, frequency = 520) => {
    if (ref.current) {
      try {
        ref.current.currentTime = 0;
        ref.current.play();
        return;
      } catch {}
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {}
  };

  const clampFabPosition = (x, y) => {
    const size = 64;
    const padding = 20;
    const safeBottom = 96;
    const maxX = window.innerWidth - size - padding;
    const maxY = window.innerHeight - size - safeBottom;
    return {
      x: Math.min(Math.max(padding, x), Math.max(padding, maxX)),
      y: Math.min(Math.max(padding, y), Math.max(padding, maxY))
    };
  };

  const startDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const point = event;
    const rect = event.currentTarget.getBoundingClientRect();
    dragStartRef.current = { x: point.clientX, y: point.clientY };
    dragMovedRef.current = false;
    dragOffsetRef.current = {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
    setIsOpen(false);
    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    if (!isDragging) return;
    const point = event;
    const dx = Math.abs(point.clientX - dragStartRef.current.x);
    const dy = Math.abs(point.clientY - dragStartRef.current.y);
    if (dx + dy > 8) dragMovedRef.current = true;
    const next = clampFabPosition(point.clientX - dragOffsetRef.current.x, point.clientY - dragOffsetRef.current.y);
    setFabPosition(next);
  };

  const handlePointerUp = (event) => {
    if (!isDragging) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    setIsDragging(false);
    try {
      const current = fabPosition;
      if (typeof current?.x === "number" && typeof current?.y === "number") {
        localStorage.setItem("genesis_ai_fab_pos", JSON.stringify(current));
      }
    } catch {}
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Speech Recognition Setup
  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = "es-ES";
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        // Auto-enviar después de reconocimiento
        setTimeout(() => sendMessage(transcript), 500);
      };
      
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Tu navegador no soporta reconocimiento de voz");
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      toast(" Escuchando...", { duration: 2000 });
    }
  };

  const runAction = (action) => {
    if (!action) return;
    if (action.action === "OPEN_TOUR") {
      openTour({ force: true });
      return;
    }
    if (onAction) onAction(action);
  };

  const sendMessage = async (overrideText = null) => {
    const userText = overrideText || input.trim();
    if (!userText || isLoading) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userText }]);
    playSound(sendSoundRef, 520);
    setIsLoading(true);

    try {
      const localResult = await localBrain.process(userText);
      if (localResult?.handled) {
        setMessages(prev => [...prev, { role: "assistant", content: localResult.response }]);
        playSound(receiveSoundRef, 620);

        if (localResult.action) {
          if (aiAutomationEnabled) {
            runAction(localResult.action);
          } else {
            setPendingAction(localResult.action);
            setMessages(prev => [...prev, {
              role: "assistant",
              content: "ℹ️ Sugerencia disponible. Pulsa “Ejecutar acción” para aplicarla o activa la automatización IA en Configuración."
            }]);
          }
        }
      } else {
        // Usar el AIEngine corregido
        const result = await AIEngine.processText(userText);

        setMessages(prev => [...prev, { role: "assistant", content: result.text }]);
        playSound(receiveSoundRef, 620);

        // Ejecutar acción si existe
        if (result.action) {
          if (aiAutomationEnabled) {
            runAction(result.action);
          } else {
            setPendingAction(result.action);
            setMessages(prev => [...prev, {
              role: "assistant",
              content: "ℹ️ Sugerencia disponible. Pulsa “Ejecutar acción” para aplicarla o activa la automatización IA en Configuración."
            }]);
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: " Error al procesar tu mensaje. Verifica tu conexión." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setMessages(prev => [...prev, { role: "user", content: " [Imagen enviada]" }]);
    playSound(sendSoundRef, 520);

    try {
      const result = await AIEngine.processVision(
        file,
        "Analiza esta imagen para el contexto de un negocio. Si es un ticket o factura, extrae los datos."
      );
      
      setMessages(prev => [...prev, { role: "assistant", content: result.text }]);
      playSound(receiveSoundRef, 620);
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: " Error al analizar imagen." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: " Ventas de hoy", prompt: "¿Cuánto vendimos hoy?" },
    { label: " Stock bajo", prompt: "¿Qué productos tienen poco stock?" },
    { label: " Ir al POS", prompt: "Llévame al punto de venta" },
    { label: " Resumen", prompt: "Dame un resumen del negocio" },
  ];

  useEffect(() => {
    if (!dragEnabled) {
      setFabPosition({ x: null, y: null });
      try { localStorage.removeItem("genesis_ai_fab_pos"); } catch {}
    }
  }, [dragEnabled]);

  const portalTarget = useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.body;
  }, []);

  const effectiveFabPosition = useMemo(() => {
    const pinned = { right: 24, bottom: 96, left: "auto" };
    if (!dragEnabled) return pinned;
    if (!Number.isFinite(fabPosition?.x) || !Number.isFinite(fabPosition?.y)) return pinned;
    const next = clampFabPosition(fabPosition.x, fabPosition.y);
    return { left: next.x, top: next.y };
  }, [fabPosition]);

  const assistantUI = (
    <>
      {/* FAB Button */}
      <button
        onClick={() => {
          if (isDragging) return;
          if (dragMovedRef.current) return;
          setIsOpen(true);
        }}
        onDoubleClick={() => {
          setFabPosition({ x: null, y: null });
          try { localStorage.removeItem("genesis_ai_fab_pos"); } catch {}
        }}
        ref={fabButtonRef}
        onPointerDown={(event) => {
          if (dragEnabled) startDrag(event);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`fixed w-16 h-16 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-full shadow-2xl shadow-violet-500/40 flex items-center justify-center z-[90] transition-all hover:scale-110 group btn-micro cursor-pointer select-none relative ${
          isListening ? "ring-4 ring-violet-400/70 animate-pulse shadow-[0_0_30px_rgba(139,92,246,0.6)]" : ""
        }`}
        style={{
          inset: "auto 24px 96px auto",
          right: 24,
          bottom: 96,
          left: "unset",
          top: "auto",
          transform: "none",
          touchAction: "none"
        }}
        title="Asistente GENESIS IA"
        aria-label="Asistente GENESIS IA"
      >
        {isListening && (
          <>
            <span className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping pointer-events-none" />
            <span className="absolute inset-0 rounded-full ring-2 ring-violet-300/70 pointer-events-none" />
          </>
        )}
        <HiOutlineSparkles className="w-7 h-7 text-white group-hover:animate-pulse" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[95] p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4" 
               style={{
                 background: 'rgba(15, 23, 42, 0.8)',
                 backdropFilter: 'blur(20px)',
                 WebkitBackdropFilter: 'blur(20px)',
                 border: '1px solid rgba(255, 255, 255, 0.1)',
                 boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
               }}>
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg transition-all hover:scale-110">
                  <span className="text-2xl">🤖</span>
                </div>
                <div>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    GENESIS IA
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full animate-pulse">Online</span>
                    {isListening && (
                      <span className="px-2 py-0.5 bg-violet-500/20 text-violet-300 text-xs rounded-full animate-pulse">
                        🎤 Escuchando
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">Asistente inteligente con Gemini</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} 
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all hover:scale-110">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-4" 
                 style={{
                   background: 'rgba(15, 23, 42, 0.3)',
                   backdropFilter: 'blur(10px)'
                 }}>
              {messages.map((msg, idx) => (
                <div key={idx} 
                     className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                     style={{
                       animationDelay: `${idx * 100}ms`
                     }}>
                  <div className={`max-w-[85%] p-3 rounded-2xl transition-all hover:scale-105 ${
                      msg.role === "user" 
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-md shadow-lg shadow-violet-500/25" 
                        : "bg-slate-800/80 text-slate-200 rounded-bl-md border border-slate-700/50 backdrop-blur-sm"
                    }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start animate-in fade-in duration-300">
                  <div className="bg-slate-800/80 p-4 rounded-2xl rounded-bl-md border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-bounce" />
                      <span className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                      <span className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
              {quickActions.map((action, idx) => (
                <button key={idx} onClick={() => { setInput(action.prompt); sendMessage(action.prompt); }}
                  className="flex-shrink-0 px-3 py-1.5 bg-slate-800/80 hover:bg-violet-600/20 text-slate-300 hover:text-violet-300 text-xs rounded-full border border-slate-700/50 hover:border-violet-500/50 transition-all">
                  {action.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-700/50 bg-slate-900/50">
              <div className="flex gap-2">
                {/* Voice Button */}
                <PremiumFeature requiredPlan="MAX">
                  <button onClick={toggleListening}
                    className={`p-3 rounded-xl transition-all ${
                      isListening 
                        ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30" 
                        : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                    } btn-micro`}
                    title="Hablar">
                    <HiOutlineMicrophone className="w-5 h-5" />
                  </button>
                </PremiumFeature>

                {/* Image Button */}
                <PremiumFeature requiredPlan="MAX">
                  <button onClick={() => fileInputRef.current?.click()}
                    className="p-3 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all btn-micro"
                    title="Enviar imagen">
                    <HiOutlineCamera className="w-5 h-5" />
                  </button>
                </PremiumFeature>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

                {/* Text Input */}
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={isListening ? "Escuchando..." : "Escribe o habla..."}
                  disabled={isListening}
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:opacity-50 transition-all"
                />

                {/* Send Button */}
                <button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
                  className="p-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-lg shadow-violet-500/25 transition-all btn-micro">
                  <HiOutlinePaperAirplane className="w-5 h-5" />
                </button>
              </div>
              {!aiAutomationEnabled && pendingAction && (
                <div className="mt-3">
                  <button
                    onClick={() => {
                      onAction?.(pendingAction);
                      setPendingAction(null);
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
                  >
                    Ejecutar acción
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  return portalTarget ? createPortal(assistantUI, portalTarget) : assistantUI;
}
