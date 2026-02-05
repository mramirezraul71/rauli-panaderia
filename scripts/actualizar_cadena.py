# -*- coding: utf-8 -*-
"""
Actualiza toda la cadena de versiones y opcionalmente despliega.
Uso: python scripts/actualizar_cadena.py [--push] [--deploy-network]
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
    args = parser.parse_args()

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

    # 3. Git push (opcional)
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
