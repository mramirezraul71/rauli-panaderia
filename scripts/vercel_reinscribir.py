# -*- coding: utf-8 -*-
"""
Elimina el proyecto Vercel y lo reinscribe desde cero, configurando todo para flujo automático.
Repo actualiza bien, Vercel no -> eliminar app, crear nueva, configurar.
Uso: python scripts/vercel_reinscribir.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT_NAME = "rauli-panaderia-app"
GITHUB_REPO = "mramirezraul71/rauli-panaderia"
API_BASE = "https://api.vercel.com"


def _vault_paths():
    yield Path(r"C:\dev\credenciales.txt")
    yield ROOT / "credenciales.txt"
    home = Path.home()
    yield home / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt"
    yield home / "Escritorio" / "credenciales.txt"
    yield home / "Desktop" / "credenciales.txt"


def load_token():
    for key in ("VERCEL_TOKEN", "VERSEL_TOKEN"):
        v = os.environ.get(key, "").strip()
        if v:
            return v
    for p in _vault_paths():
        if not p.exists():
            continue
        try:
            for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, val = line.partition("=")
                    if k.strip().upper() in ("VERCEL_TOKEN", "VERSEL_TOKEN"):
                        t = val.strip().strip("'\"").strip()
                        if t:
                            return t
        except Exception:
            pass
    return ""


def _req(method, path, token, data=None, team_id=None):
    url = f"{API_BASE}{path}"
    if team_id:
        url += ("&" if "?" in url else "?") + f"teamId={team_id}"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode()), None
    except urllib.error.HTTPError as e:
        return None, (e.code, e.read().decode() if e.fp else "")


def main():
    token = load_token()
    if not token:
        print("ERROR: VERCEL_TOKEN no encontrado.")
        return 1

    # Obtener team/org del proyecto actual (antes de borrarlo)
    proj, err = _req("GET", f"/v9/projects/{PROJECT_NAME}", token)
    team_id = None
    if proj:
        team_id = proj.get("teamId") or proj.get("accountId")
    team_q = f"&teamId={team_id}" if team_id else ""

    # 1) Eliminar proyecto
    print("--- 1/5 Eliminando proyecto Vercel ---")
    req = urllib.request.Request(
        f"{API_BASE}/v9/projects/{PROJECT_NAME}{'?' + 'teamId=' + team_id if team_id else ''}",
        headers={"Authorization": f"Bearer {token}"},
        method="DELETE",
    )
    try:
        urllib.request.urlopen(req, timeout=30)
        print("  Proyecto eliminado.")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print("  Proyecto no existía.")
        else:
            print(f"  Error al eliminar: {e.code} {e.read().decode()[:200]}")
    time.sleep(2)

    # 2) Crear proyecto nuevo vinculado a GitHub
    print("\n--- 2/5 Creando proyecto y vinculando a GitHub ---")
    payload = {
        "name": PROJECT_NAME,
        "framework": "vite",
        "buildCommand": "npm run build",
        "installCommand": "npm install",
        "outputDirectory": "dist",
        "rootDirectory": "frontend",
        "gitRepository": {
            "type": "github",
            "repo": GITHUB_REPO,
        },
    }
    created, err = _req("POST", f"/v10/projects?teamId={team_id}" if team_id else "/v10/projects", token, payload)
    if err:
        # API v10 puede tener formato distinto; intentar sin gitRepository
        payload2 = {
            "name": PROJECT_NAME,
            "framework": "vite",
            "buildCommand": "npm run build",
            "outputDirectory": "dist",
            "rootDirectory": "frontend",
        }
        created, err = _req("POST", f"/v10/projects?teamId={team_id}" if team_id else "/v10/projects", token, payload2)
    if err:
        print(f"  Error creando proyecto: {err}")
        return 1
    print("  Proyecto creado.")

    # 3) Añadir variable VITE_API_BASE
    print("\n--- 3/5 Configurando variables de entorno ---")
    env_payload = {
        "key": "VITE_API_BASE",
        "value": "https://rauli-panaderia.onrender.com/api",
        "type": "plain",
        "target": ["production", "preview", "development"],
    }
    _req("POST", f"/v10/projects/{PROJECT_NAME}/env?teamId={team_id}" if team_id else f"/v10/projects/{PROJECT_NAME}/env", token, env_payload)
    print("  VITE_API_BASE configurado.")

    # 4) Vincular repo GitHub (si no se hizo en creación)
    proj2, _ = _req("GET", f"/v9/projects/{PROJECT_NAME}", token)
    if proj2 and not proj2.get("link", {}).get("repoId"):
        print("  Conecta el repo en Vercel Dashboard: Settings → Git → Connect Git Repository")
        print(f"  Repo: https://github.com/{GITHUB_REPO}")

    # 5) Disparar deploy
    print("\n--- 4/5 Disparando deploy inicial ---")
    link = (proj2 or created or proj or {}).get("link", {})
    repo_id = link.get("repoId")
    if repo_id:
        for branch in ["main", "maestro", "master"]:
            dep_payload = {
                "name": PROJECT_NAME,
                "project": PROJECT_NAME,
                "target": "production",
                "gitSource": {"type": "github", "ref": branch, "repoId": repo_id},
            }
            dep, err = _req("POST", f"/v13/deployments?teamId={team_id}" if team_id else "/v13/deployments", token, dep_payload)
            if not err:
                print(f"  Deploy disparado (rama {branch}).")
                break
            if "incorrect_git" in str(err).lower():
                continue
        else:
            print("  No se pudo disparar deploy por API. Hazlo manual en Vercel Dashboard.")
    else:
        print("  Proyecto sin repo vinculado. Conecta en Dashboard y haz deploy.")

    # 6) Verificación
    print("\n--- 5/5 Esperando 90 s para verificación ---")
    time.sleep(90)
    try:
        req = urllib.request.Request(
            "https://rauli-panaderia-app.vercel.app/?_=" + str(int(time.time())),
            headers={"Cache-Control": "no-cache"},
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode(errors="ignore")
        import re
        m = re.search(r'__APP_VERSION__\s*=\s*["\']([^"\']+)["\']', html)
        ver = m.group(1) if m else "?"
        print(f"  Versión en Vercel: v{ver}")
        if ver != "?":
            print("  OK: App desplegada.")
        else:
            print("  Espera 1–2 min más y comprueba: https://rauli-panaderia-app.vercel.app")
    except Exception as e:
        print(f"  Verificación: {e}")

    print("\n  App: https://rauli-panaderia-app.vercel.app")
    return 0


if __name__ == "__main__":
    sys.exit(main())
