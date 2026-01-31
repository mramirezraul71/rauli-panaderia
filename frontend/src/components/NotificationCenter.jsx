import { useEffect, useMemo, useState } from "react";
import SupportService from "../services/SupportService";
import { HiOutlineBell, HiOutlineX } from "react-icons/hi";
import { useAuth } from "../context/AuthContext";
import { runUpdateNow } from "./VersionChecker";

export default function NotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const refresh = () => setNotifications(SupportService.listNotifications());
    refresh();
    const handler = () => refresh();
    window.addEventListener("support-updated", handler);
    return () => window.removeEventListener("support-updated", handler);
  }, []);

  const visibleNotifications = useMemo(
    () =>
      notifications.filter(
        (n) => n.user_id === "all" || n.user_id === user?.id || n.user_id === "anon"
      ),
    [notifications, user?.id]
  );

  const unreadCount = useMemo(
    () => visibleNotifications.filter((n) => !n.read).length,
    [visibleNotifications]
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border bg-slate-800/60 text-slate-200 border-slate-700 hover:bg-slate-700/60"
      >
        <span className={`w-2.5 h-2.5 rounded-full ${unreadCount > 0 ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
        Notificaciones
        <HiOutlineBell className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-900/90 border border-slate-700 rounded-xl shadow-xl p-4 z-40 glass-panel">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-semibold">Centro de notificaciones</h4>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
              <HiOutlineX className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 max-h-80 overflow-auto">
            {visibleNotifications.length === 0 && (
              <div className="text-xs text-slate-500">Sin notificaciones.</div>
            )}
            {visibleNotifications.map((note) => (
              <div key={note.id} className={`p-3 rounded-lg border ${note.read && note.type !== "update" ? "bg-slate-800/50 border-slate-700" : "bg-emerald-500/10 border-emerald-500/30"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-white">{note.title}</p>
                    <p className="text-xs text-slate-400 mt-1">{note.message}</p>
                  </div>
                  {!note.read && note.type !== "update" && (
                    <button
                      onClick={() => SupportService.markNotificationRead(note.id)}
                      className="text-xs text-emerald-300 hover:text-emerald-200"
                    >
                      Marcar leído
                    </button>
                  )}
                </div>
                {(note.type === "update" || note.id === "update-available") && (
                  <button
                    onClick={() => runUpdateNow()}
                    className="mt-2 w-full py-2 px-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg"
                  >
                    Actualizar ahora
                  </button>
                )}
                <p className="text-[11px] text-slate-500 mt-2">{note.created_at && new Date(note.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
