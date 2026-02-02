# -*- coding: utf-8 -*-
"""
Dispara deploy en Render vía Deploy Hook.
Render → Dashboard → Servicio → Settings → Deploy Hook → copia la URL.
Añade RENDER_DEPLOY_HOOK=https://api.render.com/deploy/srv-xxx?key=xxx en credenciales.txt
Uso: python scripts/render_deploy_hook.py
"""
from __future__ import annotations

import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_hook():
    for p in [
        Path(r"C:\dev\credenciales.txt"),
        ROOT / "credenciales.txt",
        Path.home() / "credenciales.txt",
    ]:
        if p.exists():
            try:
                for line in p.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        k, _, v = line.partition("=")
                        if k.strip().upper() == "RENDER_DEPLOY_HOOK" and v.strip():
                            return v.strip().strip("'\"")
            except Exception:
                pass
    return os.environ.get("RENDER_DEPLOY_HOOK", "").strip()


def main() -> int:
    url = _load_hook()
    if not url or "render.com" not in url:
        print("RENDER_DEPLOY_HOOK no configurado. Añade la URL en credenciales.txt")
        print("  Obtener: Render Dashboard → Servicio → Settings → Deploy Hook")
        return 1
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=30) as r:
            if r.status in (200, 201, 202):
                print("OK Render deploy disparado")
                return 0
            print(f"Render respondio HTTP {r.status}")
            return 1
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
