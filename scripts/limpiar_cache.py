# -*- coding: utf-8 -*-
"""
Limpia todas las cachés: build (dist), Vite, y opcionalmente Vercel CDN.
Uso: python scripts/limpiar_cache.py [--vercel]
"""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"


def _rmtree(p: Path) -> bool:
    try:
        if p.exists():
            shutil.rmtree(p, ignore_errors=True)
            return True
    except Exception:
        pass
    return False


def main() -> int:
    cleaned = []
    # 1) frontend/dist
    if _rmtree(FRONTEND / "dist"):
        cleaned.append("frontend/dist")
    # 2) frontend/node_modules/.vite
    if _rmtree(FRONTEND / "node_modules" / ".vite"):
        cleaned.append("frontend/node_modules/.vite")
    # 3) Vite cache en TEMP (raulierp-vite)
    temp_vite = Path(os.environ.get("TEMP", os.environ.get("TMP", ""))) / "raulierp-vite"
    if temp_vite and temp_vite.exists() and _rmtree(temp_vite):
        cleaned.append("TEMP/raulierp-vite")
    if cleaned:
        print("Cache limpiada:", ", ".join(cleaned))
    return 0


if __name__ == "__main__":
    sys.exit(main())
