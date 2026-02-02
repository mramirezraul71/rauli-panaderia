/**
 * Comprueba si hay una versión nueva en el servidor (version.json).
 * Gatillo manual: botón "Buscar actualización" en menú y en panel ACTUALIZACIONES.
 * Al pulsar: escaneo al instante, letrero "Buscando actualización..."; si hay nueva versión lo comunica y permite ejecutar; si no, lo comunica también.
 * Automático: si pasado un tiempo se han desplegado cambios y el usuario no ha pulsado el botón, saldrá de manera automática el mensaje de existencia de actualización en la bandeja de notificaciones (comprobación periódica en segundo plano).
 * Reutilizable en cualquier proyecto (SupportService opcional).
 */
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { APP_VERSION } from "../config/version";

function parseVersion(v) {
  if (!v || typeof v !== "string") return [0, 0, 0];
  const parts = v.trim().replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function isNewer(serverV, clientV) {
  const s = parseVersion(serverV);
  const c = parseVersion(clientV);
  for (let i = 0; i < 3; i++) {
    if (s[i] > c[i]) return true;
    if (s[i] < c[i]) return false;
  }
  return false;
}

/** Dispara escaneo inmediato de actualización (version.json). Usar desde menú "Buscar actualización" o panel ACTUALIZACIONES. */
export function requestCheckForUpdate() {
  window.dispatchEvent(new CustomEvent("app-check-update-request"));
}

export function runUpdateNow() {
  const unregisterSW = () => {
    if (!("serviceWorker" in navigator)) return Promise.resolve();
    return navigator.serviceWorker.getRegistrations().then((regs) => {
      if (regs?.length) {
        regs.forEach((r) => { if (r.waiting) r.waiting.postMessage({ type: "SKIP_WAITING" }); });
        return Promise.all(regs.map((r) => r.unregister()));
      }
    }).catch(() => {});
  };
  const clearCaches = () => {
    if (!("caches" in window)) return Promise.resolve();
    return caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
  };
  const doHardReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    const base = window.location.origin + window.location.pathname;
    const url = base + (base.includes("?") ? "&" : "?") + "_=" + Date.now();
    try {
      window.location.href = url;
    } catch {
      window.location.replace(url);
    }
  };
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch (_) {}
  clearCaches()
    .then(unregisterSW)
    .then(() => new Promise((r) => setTimeout(r, 400)))
    .then(doHardReload)
    .catch(doHardReload);
}

async function fetchServerVersion() {
  // Intentar primero desde el backend API
  try {
    const apiBase = import.meta.env.VITE_API_BASE || "https://rauli-panaderia-1.onrender.com/api";
    const res = await fetch(`${apiBase}/version?t=${Date.now()}`, {
      cache: "no-store",
      headers: { Pragma: "no-cache" },
    });
    if (res.ok) {
      const data = await res.json();
      return data.version || null;
    }
  } catch (e) {
    console.warn("No se pudo obtener versión desde API, usando fallback HTML", e);
  }
  
  // Fallback: leer desde el HTML
  try {
    const res = await fetch(`/?t=${Date.now()}`, {
      cache: "no-store",
      headers: { Pragma: "no-cache" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/window\.__APP_VERSION__\s*=\s*["']([^"']+)["']/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Intervalo de comprobación automática en segundo plano (ms). Si hay versión nueva, se añade a la bandeja de notificaciones. */
const PERIODIC_CHECK_MS = 10 * 60 * 1000; // 10 minutos

export default function VersionChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serverVersion, setServerVersion] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [checking, setChecking] = useState(false);
  const notifiedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const v = await fetchServerVersion();
        if (cancelled) return;
        if (v && isNewer(v, APP_VERSION)) {
          setServerVersion(v);
          setUpdateAvailable(true);
        }
      } catch {
        if (!cancelled) setChecking(false);
      }
    };
    const t = setTimeout(check, 2000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const periodicCheck = async () => {
      if (updateAvailable) return;
      try {
        const v = await fetchServerVersion();
        if (v && isNewer(v, APP_VERSION)) {
          setServerVersion(v);
          setUpdateAvailable(true);
        }
      } catch {}
    };
    const interval = setInterval(periodicCheck, PERIODIC_CHECK_MS);
    return () => clearInterval(interval);
  }, [updateAvailable]);

  useEffect(() => {
    const runCheck = async (manual) => {
      setChecking(true);
      try {
        const v = await fetchServerVersion();
        if (v && isNewer(v, APP_VERSION)) {
          setServerVersion(v);
          setUpdateAvailable(true);
          if (manual) {
            toast.success("Hay una actualización disponible (v" + v + "). Pulsa \"Actualizar ahora\".");
          }
        } else {
          if (manual) {
            toast.success("Ya tienes la última versión.", { icon: "✅" });
            window.dispatchEvent(new CustomEvent("app-check-update-result", { detail: { hasNew: false } }));
          }
        }
      } catch {
        if (manual) {
          toast.error("No se pudo comprobar. Revisa la conexión.");
          window.dispatchEvent(new CustomEvent("app-check-update-result", { detail: { hasNew: false, error: true } }));
        }
      } finally {
        setChecking(false);
      }
    };
    const handler = () => runCheck(true);
    window.addEventListener("app-check-update-request", handler);
    return () => window.removeEventListener("app-check-update-request", handler);
  }, []);

  useEffect(() => {
    if (!updateAvailable || !serverVersion || notifiedRef.current) return;
    import("../services/SupportService")
      .then(({ default: SupportService }) => {
        const list = SupportService.listNotifications?.() ?? [];
        if (list.some((n) => n.id === "update-available")) return;
        notifiedRef.current = true;
        SupportService.addNotification?.({
          id: "update-available",
          type: "update",
          title: "Nueva actualización disponible",
          message: `Versión ${serverVersion} desplegada. Pulsa "Actualizar ahora" para cargar la app (PC o móvil).`,
          user_id: "all",
          read: false,
          created_at: new Date().toISOString(),
        });
      })
      .catch(() => {});
  }, [updateAvailable, serverVersion]);

  useEffect(() => {
    const handler = () => {
      setUpdating(true);
      runUpdateNow();
    };
    window.addEventListener("app-update-now", handler);
    return () => window.removeEventListener("app-update-now", handler);
  }, []);

  const handleUpdateNow = () => {
    setUpdating(true);
    runUpdateNow();
  };

  if (checking) {
    return (
      <div className="fixed left-0 right-0 top-20 z-[50] px-4 py-2 bg-slate-700/95 border-b border-slate-600/50 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-white">
          <span className="animate-spin text-lg">🔄</span>
          <span className="font-semibold">Buscando actualización...</span>
        </div>
      </div>
    );
  }

  if (!updateAvailable) return null;

  return (
    <div className="fixed left-0 right-0 top-20 z-[50] px-4 py-2 bg-violet-600/95 border-b border-violet-500/50 shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-white">
          <span className="text-lg">🔄</span>
          <span className="font-semibold">Nueva actualización disponible</span>
          <span className="text-violet-200 text-sm">(v{serverVersion})</span>
        </div>
        <button
          onClick={handleUpdateNow}
          disabled={updating}
          className="px-4 py-2 bg-white text-violet-700 font-semibold rounded-lg hover:bg-violet-100 disabled:opacity-70 transition-colors text-sm"
        >
          {updating ? "Actualizando…" : "Actualizar ahora"}
        </button>
      </div>
    </div>
  );
}
