/**
 * Servicio compartido para detección de actualizaciones (web y móvil).
 * Usa SOLO la API para mantener la cadena automatizada.
 */
import { API_BASE } from '../config/api';
const API_BASE_NORM = (typeof API_BASE === 'string' ? API_BASE : '').replace(/\/+$/, '') || 'https://rauli-panaderia-1.onrender.com/api';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

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

/** Obtiene la versión del servidor SOLO vía API (cadena automatizada). */
export async function fetchServerVersion() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/version?t=${Date.now()}`, {
        cache: "no-store",
        headers: { Pragma: "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();
        const v = data.version || null;
        if (v) return v;
      }
    } catch (e) {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        console.warn("[versionService] API no disponible tras", MAX_RETRIES, "intentos:", e.message);
      }
    }
  }
  return null;
}
