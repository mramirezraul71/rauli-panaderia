# -*- coding: utf-8 -*-
"""
Verificación canónica de versión vía API.
Usado por deploy_auto.ps1, deploy_y_notificar.py y scripts de CI.
Uso: python scripts/verificar_version_api.py [version_esperada] [--max-wait segundos]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API_VERSION_URL = "https://rauli-panaderia-1.onrender.com/api/version"
DEFAULT_MAX_WAIT = 120


def fetch_version() -> dict | None:
    try:
        req = urllib.request.Request(API_VERSION_URL, headers={"Cache-Control": "no-cache"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Verificar versión vía API")
    parser.add_argument("version_esperada", nargs="?", help="Versión que debe devolver la API")
    parser.add_argument("--max-wait", type=int, default=DEFAULT_MAX_WAIT, help="Segundos máximos para esperar (cold start)")
    args = parser.parse_args()

    esperada = (args.version_esperada or "").strip()
    inicio = time.time()

    while (time.time() - inicio) < args.max_wait:
        data = fetch_version()
        if data:
            v = data.get("version", "")
            print(f"OK API version: {v}")
            if esperada and v != esperada:
                print(f"  ADVERTENCIA: esperada {esperada}, obtenida {v}", file=sys.stderr)
                return 1
            return 0
        time.sleep(5)
        print(".", end="", flush=True)

    print("\nERROR: API no respondió en el tiempo límite (cold start?)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
