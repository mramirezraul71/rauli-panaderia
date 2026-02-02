# -*- coding: utf-8 -*-
"""Verifica estado de servicios en Render."""
import sys

def main():
    try:
        import httpx
    except ImportError:
        print("pip install httpx")
        return 1

    urls = [
        ("Backend (rauli-panaderia)", "https://rauli-panaderia.onrender.com"),
        ("Backend /api/health", "https://rauli-panaderia.onrender.com/api/health"),
        ("Frontend (rauli-panaderia-app)", "https://rauli-panaderia-app.onrender.com"),
    ]

    print("\n=== VERIFICACION RENDER ===\n")
    ok_count = 0
    for name, url in urls:
        try:
            r = httpx.get(url, follow_redirects=True, timeout=90)
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
