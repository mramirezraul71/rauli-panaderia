# -*- coding: utf-8 -*-
"""
Actualización completa: despliega en Vercel y Railway y comprueba URLs.
Usa credenciales de C:\\dev\\credenciales.txt (VERCEL_TOKEN, RAILWAY_TOKEN, RAILWAY_PUBLIC_URL).
Uso: python scripts/deploy_completo.py
"""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run(script: str, desc: str) -> bool:
    print(f"\n--- {desc} ---\n")
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / script)],
        cwd=str(ROOT),
        timeout=120,
    )
    ok = r.returncode == 0
    if not ok:
        print(f"  [AVISO] {script} salió con código {r.returncode}")
    return ok


def main() -> int:
    print("=== ACTUALIZACIÓN COMPLETA (Vercel + Railway + comprobación) ===\n")

    # 1) Vercel
    run("vercel_config_deploy.py", "1/3 Vercel (frontend)")
    # 2) Railway
    run("railway_deploy.py", "2/3 Railway (backend)")

    print("\n--- Esperando 90 s para que los deploys terminen ---\n")
    time.sleep(90)

    # 3) Comprobar URLs
    ok = run("comprobar_urls.py", "3/3 Comprobar servicio completo")
    print("\n" + "=" * 50)
    if ok:
        print("  Todo alineado. Servicio completo operativo.")
    else:
        print("  Revisa los fallos arriba. Puedes volver a ejecutar:")
        print("  python scripts/comprobar_urls.py")
    print("=" * 50)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
