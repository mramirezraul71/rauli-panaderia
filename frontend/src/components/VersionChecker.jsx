/**
 * Comprueba si hay una versión nueva en el servidor.
 * Si la hay, muestra modal "Nueva actualización disponible" y al confirmar:
 * borra caché, desregistra SW y recarga para que PC y móvil carguen la versión nueva sin pasos manuales.
 */
import { useEffect, useState } from "react";
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

export default function VersionChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serverVersion, setServerVersion] = useState(null);
  const [updating, setUpdating] = useState(false);

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

  const handleUpdateNow = async () => {
    setUpdating(true);
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {}
    window.location.reload();
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-violet-500/50 rounded-2xl shadow-xl max-w-md w-full p-6 text-center">
        <div className="text-4xl mb-3">🔄</div>
        <h3 className="text-xl font-bold text-white mb-2">Nueva actualización disponible</h3>
        <p className="text-slate-300 text-sm mb-4">
          Versión {serverVersion} ya está desplegada. Se actualizará la app para cargar los últimos cambios (PC y móvil).
        </p>
        <p className="text-slate-500 text-xs mb-6">
          Se borrará la caché y se recargará la página.
        </p>
        <button
          onClick={handleUpdateNow}
          disabled={updating}
          className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
        >
          {updating ? "Actualizando…" : "Actualizar ahora"}
        </button>
      </div>
    </div>
  );
}
