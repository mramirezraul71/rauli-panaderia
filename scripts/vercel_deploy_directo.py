# -*- coding: utf-8 -*-
"""
Deploy DIRECTO a Vercel: build local + upload dist. NO depende de Git ni webhooks.
Solución radical cuando Vercel no se actualiza desde el repo.
Uso: python scripts/vercel_deploy_directo.py
Requiere: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID en credenciales o env.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import zipfile
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
DIST = FRONTEND / "dist"
PROJECT_NAME = "rauli-panaderia-app"


def _vault_paths():
    yield os.environ.get("RAULI_VAULT", "")
    yield Path(r"C:\dev\credenciales.txt")
    yield ROOT / "credenciales.txt"
    home = Path.home()
    yield home / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt"
    yield home / "Escritorio" / "credenciales.txt"
    yield home / "Desktop" / "credenciales.txt"


def _load_key(key: str) -> str:
    val = os.environ.get(key, "").strip()
    if val:
        return val
    for v in _vault_paths():
        p = Path(v) if isinstance(v, str) else v
        if not p or not getattr(p, "exists", lambda: False) or not p.exists():
            continue
        try:
            for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, val = line.partition("=")
                    if k.strip().upper() == key.upper():
                        t = val.strip().strip("'\"").strip()
                        if t:
                            return t
        except Exception:
            pass
    return ""


def main() -> int:
    token = _load_key("VERCEL_TOKEN")
    if not token:
        print("ERROR: VERCEL_TOKEN no encontrado.")
        return 1

    # 1) Build frontend
    print("--- 1/3 Build frontend ---")
    r = subprocess.run(["npm", "run", "build"], cwd=str(FRONTEND), shell=True, timeout=300)
    if r.returncode != 0:
        print("ERROR: Build falló.")
        return 1
    if not DIST.exists():
        print("ERROR: dist no generado.")
        return 1
    print("  Build OK.")

    # 2) Deploy con Vercel CLI (prebuilt = subir dist, sin Git)
    print("\n--- 2/3 Deploy directo (Vercel CLI) ---")
    env = os.environ.copy()
    env["VERCEL_TOKEN"] = token
    org = _load_key("VERCEL_ORG_ID") or _load_key("VERCEL_TEAM_ID")
    proj = _load_key("VERCEL_PROJECT_ID")
    if org:
        env["VERCEL_ORG_ID"] = org
    if proj:
        env["VERCEL_PROJECT_ID"] = proj

    r = subprocess.run(
        ["npx", "vercel", "deploy", "--prebuilt", "--prod", "--yes"],
        cwd=str(FRONTEND),
        shell=True,
        timeout=180,
        env=env,
    )
    if r.returncode != 0:
        print("ERROR: vercel deploy falló. Configura VERCEL_ORG_ID y VERCEL_PROJECT_ID.")
        print("  Obtener: Vercel Dashboard -> Proyecto -> Settings -> General")
        return 1
    print("  Deploy OK.")

    print("\n--- 3/3 Listo ---")
    print("  App: https://rauli-panaderia-app.vercel.app")
    return 0


if __name__ == "__main__":
    sys.exit(main())
