# -*- coding: utf-8 -*-
"""
Ejecuta los 3 pasos de forma automática: 1) Git push, 2) Deploy, 3) Verificación.
Uso: python scripts/ejecutar_pasos_completos.py
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    print("\n" + "=" * 60)
    print("  EJECUTANDO PASOS 1, 2 Y 3 (automático)")
    print("=" * 60 + "\n")

    # Paso 1 + 2: deploy_y_notificar (git add/commit/push + build + deploy)
    print(">>> Paso 1 y 2: Push a maestro + Deploy Vercel/Railway\n")
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "deploy_y_notificar.py")],
        cwd=str(ROOT),
        timeout=400,
    )
    if r.returncode != 0:
        print("\n  AVISO: deploy falló. Intentando deploy directo...")
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "vercel_deploy_directo.py")],
            cwd=str(ROOT),
            timeout=300,
            check=False,
        )

    # Paso 3: Verificación
    print("\n>>> Paso 3: Verificación repo vs Vercel\n")
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "verificar_repo_y_vercel.py")],
        cwd=str(ROOT),
        timeout=30,
        check=False,
    )

    print("\n" + "=" * 60)
    print("  COMPLETADO")
    print("=" * 60 + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
