import { useEffect, useMemo, useState } from "react";
import SupportService from "../../services/SupportService";
import { useAuth } from "../../context/AuthContext";
import { accounting } from "../../services/api";
import { formatCurrency } from "../../config/businessConfig";

const statusColor = (status) =>
  status === "resolved"
    ? "bg-emerald-500/20 text-emerald-300"
    : status === "applied"
      ? "bg-blue-500/20 text-blue-300"
      : "bg-amber-500/20 text-amber-300";

const suggestSolution = (ticket) => {
  const text = `${ticket.message} ${(ticket.context?.console || []).map((c) => c.message).join(" ")}`.toLowerCase();
  if (text.includes("indexeddb") || text.includes("db") || text.includes("base de datos")) {
    return {
      type: "data",
      summary: "Posible inconsistencia en IndexedDB",
      detail: "Sugerencia: limpiar el registro afectado o recalcular el índice.",
      applyLabel: "Aplicar ajuste de datos"
    };
  }
  if (text.includes("render") || text.includes("error") || text.includes("jsx")) {
    return {
      type: "code",
      summary: "Posible error de render/JSX",
      detail: "Sugerencia: revisar el componente asociado al error.",
      snippet: `// Ejemplo de manejo defensivo\nif (!data) return null;`
    };
  }
  return {
    type: "general",
    summary: "Revisión manual requerida",
    detail: "Se recomienda inspeccionar logs y reproducir el caso."
  };
};

export default function ControlTower() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState({});
  const [installs, setInstalls] = useState(0);
  const [announcement, setAnnouncement] = useState({ title: "", message: "" });
  const [cashBalance, setCashBalance] = useState(null);

  useEffect(() => {
    const refresh = () => {
      setTickets(SupportService.listTickets());
      setUsers(SupportService.listUsers());
      setActivity(JSON.parse(localStorage.getItem("support_activity") || "{}"));
      setInstalls(Number(localStorage.getItem("support_installations") || 0));
    };
    refresh();
    const handler = () => refresh();
    window.addEventListener("support-updated", handler);
    return () => window.removeEventListener("support-updated", handler);
  }, []);

  useEffect(() => {
    const loadCashBalance = async () => {
      try {
        const res = await accounting.cashBalance();
        setCashBalance(res.data?.total ?? 0);
      } catch (err) {
        console.error("Error cargando balance de caja:", err);
      }
    };
    if (user?.role === "SUPER_ADMIN") {
      loadCashBalance();
    }
  }, [user]);

  if (user?.role !== "SUPER_ADMIN") {
    return (
      <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6 text-slate-300">
        Acceso restringido.
      </div>
    );
  }

  const planBreakdown = useMemo(() => {
    return users.reduce(
      (acc, u) => {
        acc[u.plan || "FREE"] = (acc[u.plan || "FREE"] || 0) + 1;
        return acc;
      },
      { FREE: 0, PRO: 0, MAX: 0 }
    );
  }, [users]);

  const dailyActivity = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      return { day: key, count: activity[key] || 0 };
    });
    return days;
  }, [activity]);


  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 border border-slate-700/50 rounded-2xl">
        <h2 className="text-2xl font-semibold text-white mb-2">Control Tower</h2>
        <p className="text-sm text-slate-400">Modo Dios · Telemetría y administración</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Dinero real en caja</p>
          <p className="text-lg text-emerald-300 font-semibold">
            {cashBalance === null ? "..." : formatCurrency(cashBalance)}
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Instalaciones</p>
          <p className="text-lg text-white font-semibold">{installs}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Usuarios registrados</p>
          <p className="text-lg text-white font-semibold">{users.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Tickets activos</p>
          <p className="text-lg text-white font-semibold">{tickets.filter((t) => t.status === "open").length}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Plan Free</p>
          <p className="text-lg text-white font-semibold">{planBreakdown.FREE || 0}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Plan Pro</p>
          <p className="text-lg text-white font-semibold">{planBreakdown.PRO || 0}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Plan Max</p>
          <p className="text-lg text-white font-semibold">{planBreakdown.MAX || 0}</p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <h3 className="text-white font-semibold mb-3">Actividad diaria</h3>
        <div className="grid grid-cols-7 gap-2">
          {dailyActivity.map((item) => (
            <div key={item.day} className="bg-slate-900/60 border border-slate-700 rounded-lg p-2 text-center">
              <p className="text-xs text-slate-400">{item.day.slice(5)}</p>
              <p className="text-sm text-white font-semibold">{item.count}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
        <h3 className="text-white font-semibold">Aviso masivo</h3>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={announcement.title}
            onChange={(e) => setAnnouncement((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Título"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          />
          <input
            value={announcement.message}
            onChange={(e) => setAnnouncement((prev) => ({ ...prev, message: e.target.value }))}
            placeholder="Mensaje"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          />
        </div>
        <button
          onClick={() => {
            if (!announcement.title || !announcement.message) return;
            SupportService.addNotification({
              id: `note_${Date.now()}`,
              title: announcement.title,
              message: announcement.message,
              user_id: "all",
              read: false,
              created_at: new Date().toISOString()
            });
            setAnnouncement({ title: "", message: "" });
          }}
          className="px-3 py-2 bg-violet-500/20 text-violet-300 rounded-lg text-xs"
        >
          Enviar aviso
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
        <h3 className="text-white font-semibold">Buzón de soluciones IA</h3>
        {tickets.length === 0 && <p className="text-xs text-slate-500">Sin tickets.</p>}
        {tickets.map((ticket) => {
          const suggestion = suggestSolution(ticket);
          return (
            <div key={ticket.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{ticket.type.toUpperCase()} · {ticket.message}</p>
                  <p className="text-xs text-slate-400">{ticket.created_at}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${statusColor(ticket.status)}`}>
                  {ticket.status}
                </span>
              </div>
              <div className="text-xs text-slate-300">
                <p className="font-semibold text-slate-200">Solución sugerida</p>
                <p>{suggestion.summary}</p>
                <p className="text-slate-400">{suggestion.detail}</p>
                {suggestion.snippet && (
                  <pre className="mt-2 text-xs bg-slate-800/80 border border-slate-700 rounded-lg p-2 text-slate-200">
                    {suggestion.snippet}
                  </pre>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (suggestion.snippet) {
                      navigator.clipboard?.writeText(suggestion.snippet);
                    }
                    SupportService.updateTicket(ticket.id, { status: "applied" });
                  }}
                  className="px-3 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs"
                >
                  EJECUTAR/APLICAR
                </button>
                <button
                  onClick={() => {
                    SupportService.updateTicket(ticket.id, { status: "resolved" });
                    SupportService.addNotification({
                      id: `note_${Date.now()}`,
                      title: "Ticket resuelto",
                      message: "Tu solicitud fue resuelta por el equipo.",
                      user_id: ticket.user_id,
                      read: false,
                      created_at: new Date().toISOString()
                    });
                  }}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
                >
                  Responder al usuario
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
