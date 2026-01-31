# -*- coding: utf-8 -*-
"""Verifica URLs de Vercel y Render."""
import sys

# Actualiza con tu URL real tras el deploy en Vercel
URL_VERCEL = "https://rauli-panaderia-app.vercel.app"
URL_RENDER = "https://rauli-panaderia.onrender.com/api/health"

def check():
    results = []
    try:
        import httpx
    except ImportError:
        print("Instala: pip install httpx")
        return 1

    # Render free tier: cold start ~50–90 s
    timeouts = {URL_RENDER: 90, URL_VERCEL: 15}
    urls_to_check = [("Vercel (frontend)", URL_VERCEL), ("Render (API)", URL_RENDER)]
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
