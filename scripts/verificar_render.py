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

    print("\n=== VERIFICACION RENDER (API) ===\n")
    ok_count = 0
    for name, url in urls:
        try:
            req = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode())
                ok_count += 1
                if "/api/version" in url:
                    status = f"OK - version {data.get('version', '?')}"
                else:
                    status = f"OK - {data.get('status', data.get('name', '?'))}"
                print(f"  [{name}]")
                print(f"    URL: {url}")
                print(f"    -> {status}\n")
        except urllib.error.HTTPError as e:
            print(f"  [{name}]")
            print(f"    URL: {url}")
            print(f"    -> HTTP {e.code}\n")
        except Exception as e:
            print(f"  [{name}]")
            print(f"    URL: {url}")
            print(f"    -> ERROR: {e} (cold start?)\n")

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
