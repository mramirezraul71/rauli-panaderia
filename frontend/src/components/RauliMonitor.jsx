import { useEffect, useMemo, useRef, useState } from "react";
import { HiOutlineCamera, HiOutlineMicrophone, HiOutlinePaperAirplane, HiOutlineSparkles } from "react-icons/hi";
import { useRauli } from "../context/RauliContext";

const SOUND_SEND =
  "data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAAAAAA//8AAP//AAD//wAA//8AAP//AAD//wAA";
const SOUND_RECEIVE =
  "data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAAAAAAAP//AAD//wAAAP//AAD//wAAAP//AAD//wAA";

export default function RauliMonitor() {
  const { isOnline, isProcessing, pendingCount, enqueueCommand, lastSyncAt } = useRauli();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("idle");
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const sendSoundRef = useRef(null);
  const receiveSoundRef = useRef(null);

  useEffect(() => {
    sendSoundRef.current = new Audio(SOUND_SEND);
    receiveSoundRef.current = new Audio(SOUND_RECEIVE);
    sendSoundRef.current.volume = 0.12;
    receiveSoundRef.current.volume = 0.12;
  }, []);

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
      const amplitude = mode === "thinking" ? height * 0.22 : height * 0.08;
      const speed = mode === "thinking" ? 0.014 : 0.008;

      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      if (mode === "thinking") {
        gradient.addColorStop(0, "rgba(139, 92, 246, 0.9)");
        gradient.addColorStop(1, "rgba(34, 211, 238, 0.9)");
      } else {
        gradient.addColorStop(0, "rgba(139, 92, 246, 0.55)");
        gradient.addColorStop(1, "rgba(99, 102, 241, 0.65)");
      }

      ctx.lineWidth = 2;
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 6) {
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
  }, [mode]);

  const playSound = (ref) => {
    if (!ref?.current) return;
    try {
      ref.current.currentTime = 0;
      ref.current.play();
    } catch {}
  };

  const statusTone = isOnline ? "from-indigo-500/25 via-slate-900/70 to-violet-500/20" : "from-amber-500/20 via-slate-900/70 to-orange-500/20";
  const statusBorder = isOnline ? "border-violet-500/30" : "border-amber-500/40";
  const statusGlow = isOnline ? "shadow-[0_0_40px_rgba(99,102,241,0.25)]" : "shadow-[0_0_40px_rgba(245,158,11,0.25)]";

  const onSend = () => {
    const text = input.trim();
    if (!text) return;
    enqueueCommand({ kind: "text", text, source: "dashboard" });
    playSound(sendSoundRef);
    setInput("");
    setMode("thinking");
    window.setTimeout(() => {
      setMode("idle");
      playSound(receiveSoundRef);
    }, 1200);
  };

  const statusCopy = useMemo(() => {
    if (!isOnline) return "MODO OFFLINE - Grabando órdenes...";
    if (isProcessing) return "Sincronizando órdenes con GENESIS Cloud...";
    return "RAULI en línea · Escuchando instrucciones";
  }, [isOnline, isProcessing]);

  return (
    <section className={`relative h-full min-h-[420px] rounded-3xl border ${statusBorder} ${statusGlow} bg-gradient-to-br ${statusTone} overflow-hidden`}>
      <div className="absolute inset-0 rauli-grid opacity-40" />
      <div className="absolute inset-0 rauli-scanline opacity-30" />
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-violet-600/20 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-cyan-500/10 blur-3xl" />

      <div className="relative z-10 h-full flex flex-col gap-6 p-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl border ${statusBorder} bg-slate-900/60 flex items-center justify-center rauli-pulse`}>
              <HiOutlineSparkles className="w-6 h-6 text-violet-200" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Núcleo RAULI</p>
              <h2 className="text-2xl font-semibold text-white">Monitor Vivo</h2>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className={`px-3 py-1 rounded-full border ${statusBorder} bg-slate-900/60`}>
              {isOnline ? "Online" : "Offline"}
            </span>
            <span className="px-3 py-1 rounded-full border border-slate-700 bg-slate-900/60">
              Cola: {pendingCount}
            </span>
          </div>
        </header>

        <div className="flex-1 grid lg:grid-cols-[1.1fr_0.9fr] gap-6 min-h-[260px]">
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-amber-400"} animate-pulse`} />
                  {statusCopy}
                </div>
                {lastSyncAt && (
                  <span className="text-[11px] text-slate-500">Última sync: {new Date(lastSyncAt).toLocaleTimeString()}</span>
                )}
              </div>
              <div className={`flex-1 rounded-xl border border-slate-800/60 bg-slate-950/60 rauli-breathe ${mode === "thinking" ? "rauli-thinking" : ""}`}>
                <canvas ref={canvasRef} className="w-full h-full" />
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Estado IA: {mode === "thinking" ? "Analizando flujos y señales..." : "Respiración estable · Escuchando"}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">Canales de Entrada</h3>
                <span className="text-[11px] text-slate-500">Prioridad RAULI</span>
              </div>
              <div className="flex items-center gap-3">
                <button className="rauli-icon-btn">
                  <HiOutlineMicrophone className="w-5 h-5" />
                  <span className="text-xs">🎤</span>
                </button>
                <button className="rauli-icon-btn">
                  <HiOutlineCamera className="w-5 h-5" />
                  <span className="text-xs">📷</span>
                </button>
                <div className="flex-1 text-xs text-slate-400">
                  Micrófono y cámara listos para próxima fase.
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4 flex flex-col gap-3">
              <label className="text-sm text-slate-300">Comando directo</label>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Enviar orden a RAULI (ej: revisar inventario, abrir ventas...)"
                rows={4}
                className="w-full rounded-xl bg-slate-900/70 border border-slate-700/60 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {isOnline ? "IA en tiempo real" : "Órdenes se guardan localmente"}
                </div>
                <button
                  onClick={onSend}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm shadow-lg shadow-violet-500/30 hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-95"
                >
                  Enviar
                  <HiOutlinePaperAirplane className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
