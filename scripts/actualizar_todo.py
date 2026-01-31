# -*- coding: utf-8 -*-
"""
Actualiza TODO: push a GitHub (hub) con token de bóveda + deploy Vercel + Railway + comprobación.
Carga desde bóveda: GH_TOKEN o GITHUB_TOKEN (push), VERCEL_TOKEN, RAILWAY_TOKEN (deploy).
Uso: python scripts/actualizar_todo.py [mensaje_commit]
      python scripts/actualizar_todo.py --solo-deploy   (solo Vercel + Railway, sin git)
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _vault_paths():
    yield os.environ.get("RAULI_VAULT", "")
    yield Path(r"C:\dev\credenciales.txt")
    yield Path(r"C:\Users\Raul\OneDrive\RAUL - Personal\Escritorio\credenciales.txt")
    yield ROOT / "credenciales.txt"
    home = Path.home()
    yield home / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt"
    yield home / "Escritorio" / "credenciales.txt"
    yield home / "Desktop" / "credenciales.txt"


def _load_from_vault(keys: tuple) -> str:
    for key in keys:
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
                    if k.strip().upper() in keys:
                        t = val.strip().strip("'\"").strip()
                        if t:
                            return t
        except Exception:
            pass
    return ""


def git_push_with_token(token: str, branch: str = "maestro") -> bool:
    """Push usando token en URL para evitar credenciales interactivas."""
    # Obtener remote URL
    r = subprocess.run(
        ["git", "remote", "get-url", "origin"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=5,
    )
    if r.returncode != 0:
        print("  No se pudo leer remote origin. Ejecuta: git push origin maestro")
        return False
    url = (r.stdout or "").strip()
    if not url:
        return False
    # Insertar token en HTTPS
    if url.startswith("https://github.com/"):
        push_url = f"https://{token}@github.com/" + url.split("github.com/", 1)[-1]
    elif url.startswith("https://"):
        push_url = url.replace("https://", f"https://{token}@", 1)
    else:
        print("  Remote no es HTTPS. Usa: git push origin maestro")
        return False
    r = subprocess.run(
        ["git", "push", push_url, f"{branch}:{branch}"],
        cwd=str(ROOT),
        timeout=60,
    )
    return r.returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Actualizar todo: push + Vercel + Railway")
    parser.add_argument("--solo-deploy", action="store_true", help="Solo ejecutar deploy (Vercel + Railway), sin git")
    parser.add_argument("mensaje_commit", nargs="*", help="Mensaje para el commit")
    args = parser.parse_args()
    commit_msg = " ".join(args.mensaje_commit) if args.mensaje_commit else "Actualizacion: despliegue"

    if args.solo_deploy:
        print("=== EJECUTAR ACTUALIZACION (solo Vercel + Railway) ===\n")
    else:
        print("=== ACTUALIZAR TODO (Hub -> Vercel -> Railway -> Comprobacion) ===\n")

    if not args.solo_deploy:
        # 1) Git add
        subprocess.run(["git", "add", "-A"], cwd=str(ROOT), timeout=10, check=False)
        r = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=str(ROOT), timeout=5)
        has_changes = r.returncode != 0

        if has_changes:
            subprocess.run(["git", "commit", "-m", commit_msg], cwd=str(ROOT), timeout=10, check=False)
            print("  Commit creado.\n")
        else:
            print("  Sin cambios que commitear.\n")

        # 2) Push a GitHub
        gh_token = _load_from_vault(("GH_TOKEN", "GITHUB_TOKEN"))
        if gh_token:
            print("--- Push a GitHub (maestro) ---\n")
            if git_push_with_token(gh_token, "maestro"):
                print("  OK Push a GitHub.\n")
            else:
                print("  Fallo push. Revisa GH_TOKEN en boveda.\n")
        else:
            print("--- Push a GitHub ---\n")
            r = subprocess.run(["git", "push", "origin", "maestro"], cwd=str(ROOT), timeout=90)
            if r.returncode != 0:
                print("  GH_TOKEN no en boveda. Push fallo. Deploy usara lo ya en GitHub.\n")
            else:
                print("  OK Push a GitHub.\n")

    # 3) Deploy Vercel + Railway (siempre se ejecuta)
    print("--- Deploy Vercel + Railway ---\n")
    r1 = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "vercel_config_deploy.py")],
        cwd=str(ROOT),
        timeout=120,
    )
    if r1.returncode != 0:
        print("  [AVISO] Vercel salio con codigo", r1.returncode)
    else:
        print("  Vercel: deploy disparado.\n")
    r2 = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "railway_deploy.py")],
        cwd=str(ROOT),
        timeout=120,
    )
    if r2.returncode != 0:
        print("  [AVISO] Railway salio con codigo", r2.returncode)
    else:
        print("  Railway: deploy disparado.\n")

    print("--- Esperando 90 s ---\n")
    time.sleep(90)

    r3 = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "comprobar_urls.py")],
        cwd=str(ROOT),
        timeout=90,
    )
    print("\n" + "=" * 50)
    if r3.returncode == 0:
        print("  Actualizacion completada: Vercel y Railway OK.")
    else:
        print("  Deploy lanzado. En 1-2 min la app tendra la version nueva.")
        print("  En movil: abre el menu -> Buscar actualizaciones -> Actualizar ahora.")
    print("=" * 50)
    return 0


if __name__ == "__main__":
    sys.exit(main())
