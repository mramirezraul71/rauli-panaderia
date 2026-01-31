import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { APP_VERSION } from "../config/version";

export default function AppUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState("");
  const notifiedRef = useRef(false);

  const formatTime = (value) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString("es-ES", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    } catch {
      return "";
    }
  };

  const checkForUpdate = async (manual = false) => {
    try {
      if (!("serviceWorker" in navigator)) {
        if (manual) toast("No hay service worker activo", { icon: "ℹ️" });
        setLastCheckedAt(new Date().toISOString());
        return;
      }
      setIsChecking(true);
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        if (manual) toast("No hay actualizaciones disponibles", { icon: "✅" });
        setLastCheckedAt(new Date().toISOString());
        return;
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });

      await registration.update();
      if (registration.waiting) {
        setUpdateAvailable(true);
      } else if (manual) {
        toast("Sin actualizaciones nuevas", { icon: "✅" });
      }
      setLastCheckedAt(new Date().toISOString());
    } catch (error) {
      // En PWA/Vercel el SW puede no estar disponible; no ensuciar consola
      if (manual) {
        console.warn("AppUpdater:", error?.message || error);
        toast("No se pudo buscar actualizaciones", { icon: "⚠️" });
      }
      setLastCheckedAt(new Date().toISOString());
    } finally {
      setIsChecking(false);
    }
  };

  const handleUpdateCheck = async () => {
    if (updateAvailable) {
      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration?.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        } catch {}
      }
      window.location.reload(true);
      return;
    }
    await checkForUpdate(true);
  };

  useEffect(() => {
    checkForUpdate(false);
  }, []);

  useEffect(() => {
    if (updateAvailable && !notifiedRef.current) {
      notifiedRef.current = true;
      toast("Hay una actualización disponible", {
        icon: "🔔",
        style: { background: "#1e293b", color: "#fff", border: "1px solid #334155" }
      });
    }
  }, [updateAvailable]);

  return (
    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400">ACTUALIZACIONES</span>
        <span className="text-xs text-emerald-400 font-medium">v{APP_VERSION}</span>
      </div>
      <div className={`mb-2 px-2 py-1 rounded-lg text-xs font-medium ${
        updateAvailable
          ? "bg-amber-500/10 text-amber-400"
          : "bg-emerald-500/10 text-emerald-400"
      }`}>
        {updateAvailable ? "Actualización disponible" : isChecking ? "Buscando actualización..." : "Sin actualizaciones"}
      </div>
      {lastCheckedAt && (
        <div className="mb-2 text-[11px] text-slate-400">
          Última revisión: {formatTime(lastCheckedAt)}
        </div>
      )}
      <button
        onClick={handleUpdateCheck}
        disabled={isChecking}
        className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
      >
        {updateAvailable ? "⚡ Actualizar ahora" : isChecking ? "Buscando..." : "🔄 Buscar actualizaciones"}
      </button>
    </div>
  );
}
