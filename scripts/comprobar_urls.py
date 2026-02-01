# -*- coding: utf-8 -*-
"""Verifica URLs de Vercel y API (Render o Railway)."""
import os
import sys
from pathlib import Path

# URLs por defecto (env en CI: URL_VERCEL, RAILWAY_PUBLIC_URL)
URL_VERCEL = os.environ.get("URL_VERCEL", "https://rauli-panaderia-app.vercel.app").strip()
URL_RENDER = "https://rauli-panaderia.onrender.com/api/health"
URL_RAILWAY = ""  # Se rellena desde credenciales (RAILWAY_PUBLIC_URL) si existe

def _vault_paths():
    yield Path(r"C:\dev\credenciales.txt")
    yield Path(__file__).resolve().parent.parent / "credenciales.txt"
    yield Path(__file__).resolve().parent.parent / "backend" / ".env"
    home = Path.home()
    yield home / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt"
    yield home / "Escritorio" / "credenciales.txt"
    yield home / "Desktop" / "credenciales.txt"

def _load_railway_url():
    v = os.environ.get("RAILWAY_PUBLIC_URL", "").strip()
    if v:
        return v if "/api" in v else v.rstrip("/") + "/api/health"
    for p in _vault_paths():
        if not p.exists():
            continue
        try:
            for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, val = line.partition("=")
                    if k.strip().upper() == "RAILWAY_PUBLIC_URL":
                        v = val.strip().strip("'\"").strip()
                        if v:
                            return v if "/api" in v else v.rstrip("/") + "/api/health"
        except Exception:
            pass
    return (URL_RAILWAY or "").strip()

def check():
    results = []
    try:
        import httpx
    except ImportError:
        print("Instala: pip install httpx")
        return 1

    url_railway = _load_railway_url()
    urls_to_check = [("Vercel (frontend)", URL_VERCEL), ("Vercel /api/version", URL_VERCEL.rstrip("/") + "/api/version")]
    api_url = url_railway if url_railway else URL_RENDER
    api_label = "API (Railway)" if url_railway else "API (Render)"
    urls_to_check.append((api_label, api_url))
    timeouts = {URL_RENDER: 90, URL_VERCEL: 15}
    if url_railway:
        timeouts[url_railway] = 30
    timeouts[api_url] = timeouts.get(api_url, 60)
    for name, url in urls_to_check:
        try:
            r = httpx.get(url, follow_redirects=True, timeout=timeouts.get(url, 20))
            ok = r.status_code == 200
            if ok and "/api/version" in url:
                try:
                    d = r.json()
                    ok = isinstance(d.get("version"), str)
                    status = f"OK v{d.get('version', '?')}" if ok else "No es JSON de version"
                except Exception:
                    ok = False
                    status = "Respuesta no es JSON (¿index.html?)"
            else:
                status = f"OK {r.status_code}" if ok else f"HTTP {r.status_code}"
            results.append((name, url, status, ok))
        except Exception as e:
            results.append((name, url, str(e)[:60], False))

    print("\n=== SERVICIO COMPLETO (Vercel + API) ===\n")
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
        print("  Si la API da timeout: espera 1 min (cold start) y vuelve a ejecutar:")
        print("  python scripts/comprobar_urls.py")
    print("=" * 40)
    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(check())
