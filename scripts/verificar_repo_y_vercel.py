# -*- coding: utf-8 -*-
"""
Verifica: 1) Repo local vs remoto, 2) Versión en Vercel.
Uso: python scripts/verificar_repo_y_vercel.py
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
VERSION_JS = FRONTEND / "src" / "config" / "version.js"
VERCEL_URL = "https://rauli-panaderia-app.vercel.app"


def read_local_version() -> str:
    if not VERSION_JS.exists():
        return "?"
    text = VERSION_JS.read_text(encoding="utf-8")
    m = re.search(r'APP_VERSION\s*=\s*["\']([^"\']+)["\']', text)
    return m.group(1) if m else "?"


def fetch_vercel_version() -> str:
    try:
        req = urllib.request.Request(
            VERCEL_URL + "/?_=" + str(os.urandom(4).hex()),
            headers={"Cache-Control": "no-cache", "Pragma": "no-cache"},
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode(errors="ignore")
        m = re.search(r'__APP_VERSION__\s*=\s*["\']([^"\']+)["\']', html)
        if m:
            return m.group(1)
        m2 = re.search(r'v(\d+\.\d+\.\d+)', html)
        return m2.group(1) if m2 else "?"
    except Exception as e:
        return f"Error: {e}"


def main() -> int:
    print("\n" + "=" * 55)
    print("  VERIFICACIÓN REPO Y VERCEL")
    print("=" * 55 + "\n")

    # 1) Versión local
    local_ver = read_local_version()
    print(f"  Versión en código (local): v{local_ver}")

    # 2) Git status
    print("\n  Git:")
    try:
        r = subprocess.run(
            ["git", "status", "-sb"],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=5,
        )
        if r.returncode == 0:
            print(f"    {r.stdout.strip()}")
        r2 = subprocess.run(
            ["git", "log", "origin/maestro", "--oneline", "-1"],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=5,
        )
        if r2.returncode == 0:
            print(f"    Último commit origin/maestro: {r2.stdout.strip()}")
    except Exception as e:
        print(f"    Error: {e}")

    # 3) Versión en Vercel
    vercel_ver = fetch_vercel_version()
    print(f"\n  Versión en Vercel: v{vercel_ver}")

    # 4) Diagnóstico
    print("\n  Diagnóstico:")
    if "Error" in str(vercel_ver):
        print("    Vercel no responde o no accesible.")
    elif vercel_ver == "?":
        print("    No se pudo leer versión en Vercel (caché, red, o formato distinto).")
    elif local_ver != vercel_ver:
        print(f"    DESFASADO: local v{local_ver} vs Vercel v{vercel_ver}")
        print("    Ejecutar: ACTUALIZAR_AUTO.bat o DEPLOY_DIRECTO_VERCEL.bat")
    else:
        print("    OK: Versiones coinciden.")

    print("\n" + "=" * 55 + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
