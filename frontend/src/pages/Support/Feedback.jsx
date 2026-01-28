import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AIEngine } from "../../services/AIEngine";
import SupportService from "../../services/SupportService";
import { APP_VERSION } from "../../config/version";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";

const TYPES = [
  { value: "bug", label: "Bug/Error" },
  { value: "suggestion", label: "Sugerencia" },
  { value: "positive", label: "Aspecto Positivo" }
];

export default function Feedback() {
  const location = useLocation();
  const { user } = useAuth();
  const { plan } = useSubscription();
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    SupportService.trackActivity();
    SupportService.upsertUser({
      id: user?.id || "anon",
      plan: plan || "FREE",
      device: navigator.userAgent
    });
  }, [user?.id, plan]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    const context = {
      url: window.location.href,
      route: location.pathname,
      version: APP_VERSION,
      device: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      console: SupportService.getRecentConsoleLogs(5)
    };

    const ticket = {
      id: `tk_${Date.now()}`,
      type,
      message,
      status: "open",
      user_id: user?.id || "anon",
      plan: plan || "FREE",
      context,
      created_at: new Date().toISOString()
    };

    SupportService.createTicket(ticket);
    SupportService.trackActivity();

    try {
      const ai = await AIEngine.processText(
        `Usuario reporta (${type}): ${message}. Responde empático y breve.`,
        "Responde en español."
      );
      setAiResponse(ai?.text || "Entiendo el problema, ya notifiqué a Raúl.");
    } catch {
      setAiResponse("Entiendo el problema, ya notifiqué a Raúl.");
    } finally {
      setSending(false);
      setMessage("");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="glass-panel p-6 border border-slate-700/50 rounded-2xl">
        <h2 className="text-2xl font-semibold text-white mb-2">Feedback y Soporte</h2>
        <p className="text-sm text-slate-400">
          Tu reporte ayuda a mejorar la plataforma. Adjuntamos contexto técnico automáticamente.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel p-6 border border-slate-700/50 rounded-2xl space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-2">Tipo de reporte</label>
          <div className="flex gap-2">
            {TYPES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setType(item.value)}
                className={`px-4 py-2 rounded-lg text-sm ${type === item.value ? "bg-violet-500/20 text-violet-300" : "bg-slate-800/60 text-slate-300"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-2">Detalle</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white"
            placeholder="Describe el problema o sugerencia..."
          />
        </div>
        <button
          type="submit"
          disabled={sending}
          className="px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg text-sm disabled:opacity-50"
        >
          {sending ? "Enviando..." : "Enviar reporte"}
        </button>
      </form>

      {aiResponse && (
        <div className="glass-panel p-4 border border-emerald-500/30 rounded-2xl text-sm text-emerald-200">
          {aiResponse}
        </div>
      )}
    </div>
  );
}
