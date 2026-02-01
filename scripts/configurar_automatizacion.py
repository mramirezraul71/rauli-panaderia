# -*- coding: utf-8 -*-
"""
Configura todo el sistema automático: keep-alive, tarea programada, deploy inicial.
Ejecutar UNA VEZ. Luego todo es automático.
Uso: python scripts/configurar_automatizacion.py
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _vault_paths():
    yield Path(r"C:\dev\credenciales.txt")
    yield ROOT / "credenciales.txt"
    home = Path.home()
    yield home / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt"
    yield home / "Escritorio" / "credenciales.txt"
    yield home / "Desktop" / "credenciales.txt"


def _has_credenciales() -> bool:
    for p in _vault_paths():
        if not p.exists():
            continue
        try:
            vals = {}
            for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, v = line.partition("=")
                    vals[k.strip().upper()] = v.strip().strip("'\"")
            v = vals.get("VERCEL_TOKEN", "")
            g = vals.get("GH_TOKEN", "") or vals.get("GITHUB_TOKEN", "")
            if v and len(v) > 10 and g and len(g) > 10:
                return True
        except Exception:
            pass
    return False


def crear_tarea_programada() -> bool:
    bat = ROOT / "scripts" / "ejecutar_deploy_silencioso.bat"
    script_completo = ROOT / "scripts" / "ejecutar_pasos_completos.py"
    exe = str(script_completo) if script_completo.exists() else str(bat)
    if not bat.exists() and not script_completo.exists():
        return False
    task_name = "RauliERP_Deploy_Automatico"
    py = sys.executable
    tr_arg = f'"{py}" "{exe}"' if exe.endswith(".py") else f'"{exe}"'
    cmd = [
        "schtasks", "/create", "/tn", task_name,
        "/tr", tr_arg,
        "/sc", "daily", "/st", "08:00", "/f"
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return r.returncode == 0
    except Exception:
        return False


def main() -> int:
    print("\n" + "=" * 60)
    print("  CONFIGURACION AUTOMATICA RAULI")
    print("=" * 60 + "\n")

    if not _has_credenciales():
        print("  AVISO: credenciales.txt sin VERCEL_TOKEN o GH_TOKEN.")
        print("  Rellena credenciales.txt y vuelve a ejecutar este script.\n")
        print("  Ubicaciones buscadas:")
        for p in _vault_paths():
            print(f"    - {p}")
        print()
        return 1

    # 1) Deploy inicial (push incluye keep-alive workflow)
    print("--- 1/2 Deploy inicial (Build + Push + Vercel + Railway) ---\n")
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "ejecutar_pasos_completos.py")],
        cwd=str(ROOT), timeout=450
    )
    if r.returncode != 0:
        print("\n  Deploy fallo. Revisa credenciales y logs.")
        return 1
    print("\n  Deploy OK.\n")

    # 2) Tarea programada
    print("--- 2/2 Tarea programada (deploy diario 8:00) ---\n")
    if crear_tarea_programada():
        print("  Tarea 'RauliERP_Deploy_Automatico' creada.\n")
    else:
        print("  No se pudo crear la tarea. Ejecuta configurar_todo_automatico.bat como Administrador.\n")

    print("=" * 60)
    print("  LISTO. Automatizacion activa:")
    print("    - Keep-alive Render: cada 15 min (GitHub Actions)")
    print("    - Deploy diario: 8:00 (Tarea programada)")
    print("  Sin pasos manuales pendientes.")
    print("=" * 60 + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
