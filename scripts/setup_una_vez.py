# -*- coding: utf-8 -*-
"""
Setup UNA SOLA VEZ: configuración inicial del proyecto.
Solo se ejecuta la primera vez; en ejecuciones posteriores indica que ya fue aplicado.
Para repetir: borrar scripts/.setup-una-vez-done o ejecutar con --force
Uso: python scripts/setup_una_vez.py [--force]
"""
from __future__ import annotations

import argparse
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MARKER_FILE = ROOT / "scripts" / ".setup-una-vez-done"


def main() -> int:
    parser = argparse.ArgumentParser(description="Setup inicial del proyecto (una sola vez)")
    parser.add_argument("--force", action="store_true", help="Ejecutar de nuevo aunque ya se haya corrido")
    args = parser.parse_args()

    if MARKER_FILE.exists() and not args.force:
        try:
            content = MARKER_FILE.read_text(encoding="utf-8").strip()
            print("Setup una sola vez YA fue ejecutado.")
            print("  Marcador:", MARKER_FILE)
            if content:
                print("  ", content)
            print()
            print("Para repetir: borra el archivo o ejecuta:")
            print("  python scripts/setup_una_vez.py --force")
            return 0
        except Exception:
            pass

    if args.force and MARKER_FILE.exists():
        try:
            MARKER_FILE.unlink()
            print("Marcador eliminado. Ejecutando setup de nuevo...\n")
        except Exception:
            pass

    print("=== SETUP UNA SOLA VEZ ===\n")

    steps = []

    # 1) credenciales.txt desde ejemplo si no existe
    cred_example = ROOT / "credenciales.txt.example"
    cred_dest = ROOT / "credenciales.txt"
    if cred_example.exists() and not cred_dest.exists():
        try:
            shutil.copy(cred_example, cred_dest)
            steps.append("Creado credenciales.txt desde credenciales.txt.example")
        except Exception as e:
            steps.append(f"No se pudo crear credenciales.txt: {e}")
    elif cred_dest.exists():
        steps.append("credenciales.txt ya existe (boveda)")
    else:
        steps.append("No hay credenciales.txt.example; crea credenciales.txt a mano")

    # 2) frontend/.env desde .env.example si no existe
    fe_env_example = ROOT / "frontend" / ".env.example"
    fe_env_dest = ROOT / "frontend" / ".env"
    if fe_env_example.exists() and not fe_env_dest.exists():
        try:
            shutil.copy(fe_env_example, fe_env_dest)
            steps.append("Creado frontend/.env desde .env.example")
        except Exception as e:
            steps.append(f"No se pudo crear frontend/.env: {e}")
    elif fe_env_dest.exists():
        steps.append("frontend/.env ya existe")
    else:
        steps.append("Opcional: crea frontend/.env con VITE_API_BASE=...")

    # 3) Bóveda: rutas típicas
    home = Path.home()
    vault_paths = [
        ROOT / "credenciales.txt",
        Path(r"C:\dev\credenciales.txt"),
        home / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt",
        home / "Escritorio" / "credenciales.txt",
        home / "Desktop" / "credenciales.txt",
    ]
    found = [p for p in vault_paths if p.exists()]
    if found:
        steps.append(f"Boveda encontrada en: {found[0]}")
    else:
        steps.append("Boveda: crea credenciales.txt en la raiz o en Escritorio y anade VERCEL_TOKEN, RAILWAY_TOKEN, GH_TOKEN")

    for s in steps:
        print("  -", s)
    print()

    # Escribir marcador
    try:
        MARKER_FILE.parent.mkdir(parents=True, exist_ok=True)
        MARKER_FILE.write_text(
            f"Ejecutado: {datetime.now().isoformat()}\nSetup una sola vez.",
            encoding="utf-8",
        )
        print("Marcador creado:", MARKER_FILE)
        print("Setup una sola vez completado.")
    except Exception as e:
        print("Aviso: no se pudo escribir marcador:", e)
        print("Setup aplicado pero se volvera a ejecutar en la proxima vez.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
