/**
 * Servicio compartido para detección de actualizaciones (web y móvil).
 * API primero, fallback a HTML para máxima compatibilidad.
 */

export function parseVersion(v) {
  if (!v || typeof v !== "string") return [0, 0, 0];
  const parts = v.trim().replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

export function isNewer(serverV, clientV) {
  const s = parseVersion(serverV);
  const c = parseVersion(clientV);
  for (let i = 0; i < 3; i++) {
    if (s[i] > c[i]) return true;
    if (s[i] < c[i]) return false;
  }
  return false;
}

/** Obtiene la versión del servidor: API primero, fallback a HTML. */
export async function fetchServerVersion() {
  const apiBase = (import.meta.env.VITE_API_BASE || "https://rauli-panaderia-1.onrender.com/api").replace(/\/+$/, "");
  try {
    const res = await fetch(`${apiBase}/version?t=${Date.now()}`, {
      cache: "no-store",
      headers: { Pragma: "no-cache" },
    });
    if (res.ok) {
      const data = await res.json();
      return data.version || null;
    }
  } catch (e) {
    console.warn("[versionService] API no disponible, usando fallback HTML:", e.message);
  }

  try {
    const res = await fetch(`${window.location.origin}/?t=${Date.now()}`, {
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
