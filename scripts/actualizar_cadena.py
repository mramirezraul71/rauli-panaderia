# -*- coding: utf-8 -*-
"""
Actualiza toda la cadena de versiones y opcionalmente despliega.
Uso: python scripts/actualizar_cadena.py [--push] [--deploy-network] [--android]
     python scripts/actualizar_cadena.py --todo   # bump + push + android (actualizar todo)
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    parser = argparse.ArgumentParser(description="Actualizar cadena de versiones")
    parser.add_argument("--push", action="store_true", help="git add, commit, push")
    parser.add_argument("--deploy-network", action="store_true", help="Ejecutar deploy_network.js")
    parser.add_argument("--android", action="store_true", help="Generar AAB para Google Play")
    parser.add_argument("--todo", action="store_true", help="Actualizar todo: bump + push + android")
    args = parser.parse_args()

    if args.todo:
        args.push = True
        args.android = True

    # 1. Bump version (hoy)
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "bump_version.py"), "--today"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        print("Error bump_version:", r.stderr or r.stdout, file=sys.stderr)
        return 1
    version = (r.stdout or "").strip()
    print(f"Versión: {version}")

    # 2. Deploy network (opcional)
    if args.deploy_network:
        subprocess.run(
            ["node", str(ROOT / "deploy_network.js")],
            cwd=str(ROOT),
        )

    # 3. Android AAB (Google Play)
    if args.android:
        print("Generando AAB para Google Play...")
        r2 = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "actualizar_app_android.py")],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=300,
        )
        if r2.returncode != 0:
            print("Warning Android:", r2.stderr or r2.stdout or "Error", file=sys.stderr)
        else:
            print("AAB generado. Sube a Play Console (Internal testing).")

    # 4. Git push (opcional)
    if args.push:
        subprocess.run(["git", "add", "-A"], cwd=str(ROOT), check=True)
        subprocess.run(
            ["git", "commit", "-m", f"chore: bump version {version}"],
            cwd=str(ROOT),
        )
        subprocess.run(["git", "push"], cwd=str(ROOT), check=True)
        print("Push realizado. Render + Vercel desplegarán.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
