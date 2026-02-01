import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { APP_VERSION } from "../config/version";
import { runUpdateNow } from "./VersionChecker";

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
async function fetchServerVersion() {
  const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store", headers: { Pragma: "no-cache" } });
  if (!res.ok) return null;
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("text/html")) return null;
  let data;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  if (!data || typeof data.version !== "string") return null;
  return data.version;
}

export default function AppUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serverVersion, setServerVersion] = useState(null);
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
    setIsChecking(true);
    setLastCheckedAt(new Date().toISOString());
    try {
      const v = await fetchServerVersion();
      if (v && isNewer(v, APP_VERSION)) {
        setServerVersion(v);
        setUpdateAvailable(true);
        if (manual) toast.success("Hay actualización disponible (v" + v + "). Pulsa \"Actualizar ahora\".");
      } else {
        setUpdateAvailable(false);
        setServerVersion(null);
        if (manual) toast.success("Ya tienes la última versión.", { icon: "✅" });
      }
    } catch {
      if (manual) toast.error("No se pudo comprobar. Revisa la conexión.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleUpdateCheck = async () => {
    if (updateAvailable) {
      runUpdateNow();
      return;
    }
    await checkForUpdate(true);
  };

  useEffect(() => {
    checkForUpdate(false);
  }, []);

  useEffect(() => {
    const handler = () => checkForUpdate(true);
    window.addEventListener("app-check-update-request", handler);
    return () => window.removeEventListener("app-check-update-request", handler);
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
        {updateAvailable ? (serverVersion ? `Actualización disponible (v${serverVersion})` : "Actualización disponible") : isChecking ? "Buscando actualización..." : "Sin actualizaciones"}
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
