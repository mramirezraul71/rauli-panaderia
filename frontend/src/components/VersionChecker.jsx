/**
 * Comprueba si hay una versión nueva en el servidor.
 * Si la hay: muestra un banner arriba en el dashboard y añade la notificación al Centro de notificaciones.
 * Al pulsar "Actualizar ahora" (banner o notificación): borra caché, desregistra SW y recarga.
 */
import { useEffect, useRef, useState } from "react";
import { APP_VERSION } from "../config/version";
import SupportService from "../services/SupportService";

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

export function runUpdateNow() {
  const doReload = () => window.location.reload();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      return navigator.serviceWorker.getRegistrations();
    }).then((regs) => {
      if (regs) regs.forEach((r) => r.unregister());
    }).catch(() => {});
  }
  if ("caches" in window) {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(doReload).catch(doReload);
  } else {
    setTimeout(doReload, 300);
  }
}

export default function VersionChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serverVersion, setServerVersion] = useState(null);
  const [updating, setUpdating] = useState(false);
  const notifiedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
          headers: { Pragma: "no-cache" },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const v = data?.version;
        if (v && isNewer(v, APP_VERSION)) {
          setServerVersion(v);
          setUpdateAvailable(true);
        }
      } catch {
        // Red o servidor no disponible; no bloquear la app
      }
    };
    const t = setTimeout(check, 2000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!updateAvailable || !serverVersion || notifiedRef.current) return;
    const list = SupportService.listNotifications();
    if (list.some((n) => n.id === "update-available")) return;
    notifiedRef.current = true;
    SupportService.addNotification({
      id: "update-available",
      type: "update",
      title: "Nueva actualización disponible",
      message: `Versión ${serverVersion} desplegada. Pulsa "Actualizar ahora" para cargar la app (PC o móvil).`,
      user_id: "all",
      read: false,
      created_at: new Date().toISOString(),
    });
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
