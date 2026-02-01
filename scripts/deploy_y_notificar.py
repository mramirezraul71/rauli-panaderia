# -*- coding: utf-8 -*-
"""
Script único: elimina caché en app (vía version.json), construye, despliega en todos los sitios
y emite mensaje de nueva actualización (Telegram). La app en PC y móvil detecta la nueva versión
y muestra "Nueva actualización disponible" -> el usuario pulsa "Actualizar ahora" y se actualiza solo.
Uso: python scripts/deploy_y_notificar.py [--no-git] [--no-notify]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
VERSION_JS = FRONTEND / "src" / "config" / "version.js"
APP_URL = os.environ.get("URL_VERCEL", "https://rauli-panaderia-app.vercel.app")


def _vault_paths():
    yield os.environ.get("RAULI_VAULT", "")
    yield Path(r"C:\dev\credenciales.txt")
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


def read_version() -> str:
    if not VERSION_JS.exists():
        return "1.0.0"
    text = VERSION_JS.read_text(encoding="utf-8")
    m = re.search(r'APP_VERSION\s*=\s*["\']([^"\']+)["\']', text)
    return m.group(1) if m else "1.0.0"


def send_telegram(text: str) -> bool:
    token = _load_from_vault(("OMNI_BOT_TELEGRAM_TOKEN", "TELEGRAM_TOKEN"))
    chat = _load_from_vault(("OMNI_BOT_TELEGRAM_CHAT_ID", "TELEGRAM_CHAT_ID", "OPERATOR_TELEGRAM"))
    if not token or not chat:
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    body = f"chat_id={chat}&text={urllib.parse.quote(text[:4096])}"
    try:
        req = urllib.request.Request(url, data=body.encode(), method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        with urllib.request.urlopen(req, timeout=15) as r:
            d = json.loads(r.read().decode())
        return d.get("ok", False)
    except Exception:
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy y notificar nueva actualizacion")
    parser.add_argument("--no-git", action="store_true", help="No hacer git add/commit/push")
    parser.add_argument("--no-notify", action="store_true", help="No enviar mensaje Telegram")
    args = parser.parse_args()

    # 0) Bump versión patch si hay cambios (enlaza cada arreglo con versión nueva)
    if not args.no_git:
        r = subprocess.run(["git", "status", "--porcelain"], cwd=str(ROOT), capture_output=True, text=True, timeout=5)
        if r.returncode == 0 and r.stdout.strip():
            subprocess.run([sys.executable, str(ROOT / "scripts" / "bump_version.py")], cwd=str(ROOT), capture_output=True, check=False)

    version = read_version()
    print("=== DEPLOY Y NOTIFICAR (v{}) ===\n".format(version))

    # 1) Limpiar caché (dist, Vite)
    subprocess.run([sys.executable, str(ROOT / "scripts" / "limpiar_cache.py")], cwd=str(ROOT), timeout=10, check=False)

    # 2) Build frontend (genera version.json y dist)
    print("--- 2/5 Build frontend ---\n")
    r = subprocess.run(
        ["npm", "run", "build"],
        cwd=str(FRONTEND),
        shell=True,
        timeout=300,
    )
    if r.returncode != 0:
        print("ERROR: Build fallo.")
        return 1
    print("  Build OK.\n")

    if not args.no_git:
        # 3) Git add, commit, push
        print("--- 3/5 Git add/commit/push ---\n")
        subprocess.run(["git", "add", "-A"], cwd=str(ROOT), timeout=10, check=False)
        r = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=str(ROOT), timeout=5)
        if r.returncode != 0:
            subprocess.run(
                ["git", "commit", "-m", "Deploy v{}: actualizacion automatica".format(version)],
                cwd=str(ROOT),
                timeout=10,
                check=False,
            )
        gh = _load_from_vault(("GH_TOKEN", "GITHUB_TOKEN"))
        push_ok = False
        if gh:
            r = subprocess.run(["git", "remote", "get-url", "origin"], cwd=str(ROOT), capture_output=True, text=True, timeout=5)
            url = (r.stdout or "").strip()
            if "github.com" in url:
                push_url = "https://{}@github.com/".format(gh) + url.split("github.com/", 1)[-1].lstrip("/")
                rr = subprocess.run(["git", "push", push_url, "maestro:maestro"], cwd=str(ROOT), timeout=90, capture_output=True, text=True)
                push_ok = rr.returncode == 0
        if not push_ok:
            rr = subprocess.run(["git", "push", "origin", "maestro"], cwd=str(ROOT), timeout=90, capture_output=True, text=True)
            push_ok = rr.returncode == 0
        if push_ok:
            print("  Git OK (push a maestro).\n")
        else:
            print("  AVISO: git push fallo.\n  Añade GH_TOKEN en credenciales.txt (GitHub -> Settings -> Developer settings -> Tokens)\n")
    else:
        print("--- 2/4 Git omitido (--no-git) ---\n")

    # 4) Deploy Vercel + Railway
    print("--- 4/5 Deploy Vercel + Railway ---\n")
    rv = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "vercel_config_deploy.py")],
        cwd=str(ROOT),
        timeout=120,
        check=False,
    )
    if rv.returncode != 0:
        print("  Fallback: intentando deploy directo (sin Git)...")
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "vercel_deploy_directo.py")],
            cwd=str(ROOT),
            timeout=300,
            check=False,
        )
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "railway_deploy.py")],
        cwd=str(ROOT),
        timeout=120,
        check=False,
    )
    print("\n  Esperando 60 s...\n")
    time.sleep(60)

    # 5) Notificar (Telegram)
    if not args.no_notify:
        print("--- 5/5 Notificar nueva actualizacion ---\n")
        msg = (
            "RAULI v{} desplegada.\n\n"
            "Abre la app (PC o movil): {}\n\n"
            "Se detectara la nueva version y aparecera \"Nueva actualizacion disponible\". "
            "Pulsa \"Actualizar ahora\" y la app se actualizara sola (sin pasos manuales)."
        ).format(version, APP_URL)
        if send_telegram(msg):
            print("  Mensaje enviado a Telegram.\n")
        else:
            print("  Telegram no configurado o fallo. Boveda: OMNI_BOT_TELEGRAM_TOKEN, OMNI_BOT_TELEGRAM_CHAT_ID.\n")
    else:
        print("--- 5/5 Notificar omitido (--no-notify) ---\n")

    print("=" * 50)
    print("  Listo. En PC y movil: abrir la app -> si hay version nueva, se mostrara el aviso y \"Actualizar ahora\".")
    print("=" * 50)
    return 0


if __name__ == "__main__":
    sys.exit(main())
