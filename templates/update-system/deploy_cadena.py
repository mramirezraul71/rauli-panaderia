# -*- coding: utf-8 -*-
"""
Cadena estándar: build frontend (genera version.json), git add/commit/push a GitHub,
y opcional notificación (Telegram). Vercel/Railway suelen desplegar solos al hacer push.
Reutilizable en cualquier proyecto. Credenciales desde bóveda (credenciales.txt) o env.

Uso: python scripts/deploy_cadena.py [--no-git] [--no-notify]
Variables: DEPLOY_BRANCH (default main), FRONTEND_DIR (default frontend), GH_TOKEN, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# Cuando el script está en scripts/, ROOT = raíz del proyecto
ROOT = Path(__file__).resolve().parent.parent
FRONTEND = Path(os.environ.get("FRONTEND_DIR", str(ROOT / "frontend"))).resolve()
VERSION_JS = FRONTEND / "src" / "config" / "version.js"
BRANCH = os.environ.get("DEPLOY_BRANCH", "main")
APP_URL = os.environ.get("URL_VERCEL", os.environ.get("APP_URL", ""))


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
    chat = _load_from_vault(("OMNI_BOT_TELEGRAM_CHAT_ID", "TELEGRAM_CHAT_ID"))
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
    parser = argparse.ArgumentParser(description="Cadena: build + git push + opcional Telegram")
    parser.add_argument("--no-git", action="store_true", help="No hacer git add/commit/push")
    parser.add_argument("--no-notify", action="store_true", help="No enviar Telegram")
    args = parser.parse_args()

    version = read_version()
    print("=== DEPLOY CADENA (v{}) ===\n".format(version))
    print("  Rama: {} | Frontend: {}\n".format(BRANCH, FRONTEND))

    if not FRONTEND.exists():
        print("ERROR: No existe directorio frontend: {}".format(FRONTEND))
        return 1

    # 1) Build frontend
    print("--- 1/3 Build frontend ---\n")
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
        # 2) Git add, commit, push
        print("--- 2/3 Git add/commit/push (GitHub) ---\n")
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
        if gh:
            r = subprocess.run(["git", "remote", "get-url", "origin"], cwd=str(ROOT), capture_output=True, text=True, timeout=5)
            url = (r.stdout or "").strip()
            if url.startswith("https://github.com/"):
                push_url = "https://{}@github.com/".format(gh) + url.split("github.com/", 1)[-1]
                subprocess.run(["git", "push", push_url, "{}:{}".format(BRANCH, BRANCH)], cwd=str(ROOT), timeout=90, check=False)
            else:
                subprocess.run(["git", "push", "origin", BRANCH], cwd=str(ROOT), timeout=90, check=False)
        else:
            subprocess.run(["git", "push", "origin", BRANCH], cwd=str(ROOT), timeout=90, check=False)
        print("  Git OK. Vercel/Railway suelen desplegar solos al detectar el push.\n")
    else:
        print("--- 2/3 Git omitido (--no-git) ---\n")

    # 3) Notificar (opcional)
    if not args.no_notify and APP_URL:
        print("--- 3/3 Notificar ---\n")
        msg = (
            "App v{} desplegada.\n\n"
            "URL: {}\n\n"
            "Si la app tiene VersionChecker, los usuarios veran \"Nueva actualizacion disponible\" y \"Actualizar ahora\"."
        ).format(version, APP_URL)
        if send_telegram(msg):
            print("  Telegram OK.\n")
        else:
            print("  Telegram no configurado (TELEGRAM_TOKEN, TELEGRAM_CHAT_ID en boveda).\n")
    else:
        print("--- 3/3 Notificar omitido ---\n")

    print("=" * 50)
    print("  Cadena lista: repo en GitHub actualizado; Vercel/Railway despliegan al hacer push.")
    print("=" * 50)
    return 0


if __name__ == "__main__":
    sys.exit(main())
