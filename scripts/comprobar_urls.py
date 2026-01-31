# -*- coding: utf-8 -*-
"""Verifica URLs de Vercel y Render."""
import sys

# Actualiza con tu URL real tras el deploy
URL_VERCEL = "https://rauli-panaderia-app.vercel.app"
URL_RENDER = "https://rauli-panaderia.onrender.com/api/health"
# Si usas Railway, pon aquí la URL /api/health o define RAILWAY_PUBLIC_URL al ejecutar
URL_RAILWAY = ""  # ej. "https://rauli-panaderia-production.up.railway.app/api/health"

def check():
    import os
    results = []
    try:
        import httpx
    except ImportError:
        print("Instala: pip install httpx")
        return 1

    url_railway = (os.environ.get("RAILWAY_PUBLIC_URL", "") or URL_RAILWAY or "").strip()
    urls_to_check = [("Vercel (frontend)", URL_VERCEL)]
    api_url = url_railway if url_railway else URL_RENDER
    urls_to_check.append(("API (Render/Railway)", api_url))
    timeouts = {URL_RENDER: 90, URL_VERCEL: 15}
    if URL_RAILWAY.strip():
        timeouts[URL_RAILWAY.strip()] = 30
    timeouts[api_url] = timeouts.get(api_url, 60)
    for name, url in urls_to_check:
        try:
            r = httpx.get(url, follow_redirects=True, timeout=timeouts.get(url, 20))
            ok = r.status_code == 200
            status = f"OK {r.status_code}" if ok else f"HTTP {r.status_code}"
            results.append((name, url, status, ok))
        except Exception as e:
            results.append((name, url, str(e)[:60], False))

    print("\n=== SERVICIO COMPLETO (Vercel + Render) ===\n")
    all_ok = True
    for name, url, status, ok in results:
        icon = "OK" if ok else "FALLO"
        print(f"  [{icon}] {name}")
        print(f"       {url}")
        print(f"       -> {status}\n")
        if not ok:
            all_ok = False

    print("=" * 40)
    if all_ok:
        print("  Servicio completo: frontend y API operativos.")
    else:
        print("  Si Render da timeout: plan free tarda ~1 min en despertar.")
        print("  Vuelve a ejecutar: python scripts/comprobar_urls.py")
    print("=" * 40)
    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(check())
