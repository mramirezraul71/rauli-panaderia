# -*- coding: utf-8 -*-
"""Verifica estado de servicios en Render (API como fuente de verdad)."""
import json
import sys
import urllib.request

API_BASE = "https://rauli-panaderia-1.onrender.com"

def main():
    urls = [
        ("Backend /api/health", f"{API_BASE}/api/health"),
        ("Backend /api/version (cadena automatizada)", f"{API_BASE}/api/version"),
    ]

    print("\n=== VERIFICACION RENDER ===\n")
    ok_count = 0
    for name, url in urls:
        try:
            r = httpx.get(url, follow_redirects=True, timeout=30)
            status = f"HTTP {r.status_code}"
            if r.status_code == 200:
                ok_count += 1
                if "/api/health" in url:
                    try:
                        d = r.json()
                        status = f"OK - {d.get('status', d.get('service', '?'))}"
                    except Exception:
                        pass
            print(f"  [{name}]")
            print(f"    URL: {url}")
            print(f"    -> {status}\n")
        except httpx.TimeoutException:
            print(f"  [{name}]")
            print(f"    URL: {url}")
            print(f"    -> TIMEOUT (cold start o servicio detenido)\n")
        except Exception as e:
            print(f"  [{name}]")
            print(f"    URL: {url}")
            print(f"    -> ERROR: {e}\n")

    print("=" * 50)
    if ok_count == len(urls):
        print("  RENDER: Todos los servicios OK")
    else:
        print("  RENDER: Hay fallos. Revisa:")
        print("  - https://dashboard.render.com")
        print("  - Logs del servicio (build/deploy)")
        print("  - Cold start: espera 1-2 min y vuelve a ejecutar")
    print("=" * 50)
    return 0 if ok_count == len(urls) else 1

if __name__ == "__main__":
    sys.exit(main())
