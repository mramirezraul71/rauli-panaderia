/**
 * Escudo anti-caché: wrapper de fetch que fuerza no-store en todos los intentos.
 * Usar para peticiones que no pasan por api.js.
 */
export function fetchShield(url, options = {}) {
  const opts = { ...options };
  opts.cache = opts.cache ?? 'no-store';
  opts.headers = { ...opts.headers, 'Pragma': 'no-cache', 'Cache-Control': 'no-cache, no-store' };
  return fetch(url, opts);
}
