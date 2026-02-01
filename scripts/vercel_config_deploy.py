# -*- coding: utf-8 -*-
"""
Configura proyecto en Vercel (rootDirectory, env) y dispara deploy.
Carga VERCEL_TOKEN desde bóveda o env.
Uso: python scripts/vercel_config_deploy.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Bóveda según directiva; fallbacks para distintos usuarios
def _vault_paths():
    yield os.environ.get("RAULI_VAULT", "")
    # Raíz común de proyectos (C:\dev)
    yield Path(r"C:\dev\credenciales.txt")
    yield r"C:\Users\Raul\OneDrive\RAUL - Personal\Escritorio\credenciales.txt"
    home = Path.home()
    yield home / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt"
    yield home / "Escritorio" / "credenciales.txt"
    yield home / "Desktop" / "credenciales.txt"
    for one in (home / "OneDrive").iterdir() if (home / "OneDrive").exists() else []:
        yield one / "Escritorio" / "credenciales.txt"
        yield one / "Desktop" / "credenciales.txt"

# Acepta VERCEL_TOKEN y VERSEL_TOKEN (typo común)
TOKEN_KEYS = ("VERCEL_TOKEN", "VERSEL_TOKEN")

def load_token():
    for key in TOKEN_KEYS:
        token = os.environ.get(key, "").strip()
        if token:
            return token
    # Bóveda (varias rutas)
    for v in _vault_paths():
        p = Path(v) if isinstance(v, str) else v
        if p and p.exists():
            try:
                for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        k, _, val = line.partition("=")
                        if k.strip().upper() in TOKEN_KEYS:
                            t = val.strip().strip("'\"").strip()
                            if t:
                                return t
            except Exception:
                pass
    # Raíz del repo: .env y credenciales.txt (bóveda local)
    root = Path(__file__).resolve().parent.parent
    for env_path in [root / ".env", root / "credenciales.txt", root / "backend" / ".env"]:
        if env_path.exists():
            try:
                for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        k, _, val = line.partition("=")
                        if k.strip().upper() in TOKEN_KEYS:
                            t = val.strip().strip("'\"").strip()
                            if t:
                                return t
            except Exception:
                pass
    return ""

def main():
    token = load_token()
    if not token:
        print("ERROR: VERCEL_TOKEN no encontrado. Definir en env o en bóveda.")
        return 1

    import json
    import urllib.request
    import urllib.error

    base = "https://api.vercel.com"
    project_name = "rauli-panaderia-app"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # 1) Obtener proyecto (por nombre)
    req = urllib.request.Request(
        f"{base}/v9/projects/{project_name}",
        headers={**headers, "Content-Type": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            project = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"GET project error {e.code}: {body[:300]}")
        return 1

    # 2) PATCH proyecto: rootDirectory, framework
    payload = {
        "rootDirectory": "frontend",
        "framework": "vite",
        "buildCommand": "npm run build",
        "outputDirectory": "dist",
    }
    req = urllib.request.Request(
        f"{base}/v9/projects/{project_name}",
        data=json.dumps(payload).encode(),
        headers=headers,
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            updated = json.loads(r.read().decode())
        print("OK Project actualizado: rootDirectory=frontend, framework=vite")
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"PATCH project warning {e.code}: {body[:300]}")

    # 3) Listar env vars y crear VITE_API_BASE si no existe
    req = urllib.request.Request(
        f"{base}/v9/projects/{project_name}/env",
        headers=headers,
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            env_list = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        env_list = {"envs": []}

    envs = env_list.get("envs", []) if isinstance(env_list, dict) else []
    api_base_value = "https://rauli-panaderia.onrender.com/api"
    # Preferir Railway si está en bóveda
    for v in _vault_paths():
        p = Path(v) if isinstance(v, str) else v
        if p and getattr(p, "exists", lambda: False) and p.exists():
            try:
                for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                    if "=" in line and not line.strip().startswith("#"):
                        k, _, val = line.partition("=")
                        if k.strip().upper() == "RAILWAY_PUBLIC_URL":
                            url = val.strip().strip("'\"").rstrip("/")
                            if url and "railway" in url.lower():
                                api_base_value = f"{url}/api"
                                print(f"  Usando Railway: {api_base_value}")
                                break
            except Exception:
                pass

    existing = next((e for e in envs if e.get("key") == "VITE_API_BASE"), None)
    payload = {
        "key": "VITE_API_BASE",
        "value": api_base_value,
        "type": "plain",
        "target": ["production", "preview", "development"],
    }

    if existing:
        # Actualizar: eliminar y recrear (Vercel no tiene PATCH para env)
        try:
            env_id = existing.get("id")
            if env_id:
                del_req = urllib.request.Request(
                    f"{base}/v9/projects/{project_name}/env/{env_id}",
                    headers=headers,
                    method="DELETE",
                )
                urllib.request.urlopen(del_req, timeout=15)
        except Exception:
            pass

    req = urllib.request.Request(
        f"{base}/v10/projects/{project_name}/env",
        data=json.dumps(payload).encode(),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"OK VITE_API_BASE = {api_base_value}")
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"POST env warning {e.code}: {body[:200]}")

    # 4) Disparar deploy: SIEMPRE desde rama maestro (no productionBranch que puede ser master antiguo)
    link = project.get("link") or {}
    repo_id = link.get("repoId")
    deploy_branch = "maestro"  # Fijar: nuestro código está en maestro
    deploy_hook_url = None
    for dh in (link.get("deployHooks") or []):
        ref = (dh.get("ref") or "").strip()
        if ref == "maestro":
            deploy_hook_url = dh.get("url")
            break
    if not deploy_hook_url and (link.get("deployHooks") or []):
        deploy_hook_url = (link.get("deployHooks") or [{}])[0].get("url")
    if deploy_hook_url:
        try:
            urllib.request.urlopen(
                urllib.request.Request(deploy_hook_url, method="POST"),
                timeout=30,
            )
            print("OK Deploy disparado vía Deploy Hook")
            print("  Espera 1–2 min y ejecuta: python scripts/comprobar_urls.py")
            return 0
        except Exception as e:
            print(f"Deploy Hook falló: {e}")
    if repo_id:
        # Probar maestro; si falla, main/master (rama por defecto de muchos repos)
        for branch in [deploy_branch, "main", "master"]:
            payload = {
                "name": project_name,
                "project": project_name,
                "target": "production",
                "gitSource": {"type": "github", "ref": branch, "repoId": repo_id},
            }
    else:
        payload = {
            "name": project_name,
            "project": project_name,
            "target": "production",
        }
        branch = None

    for attempt in ([payload] if not isinstance(branch, list) else [{"branch": b, **{k: v for k, v in payload.items() if k != "gitSource"}} for b in [deploy_branch, "main", "master"]]):
        p = payload.copy() if branch is None else {
            "name": project_name,
            "project": project_name,
            "target": "production",
            "gitSource": {"type": "github", "ref": attempt.get("branch", deploy_branch), "repoId": repo_id},
        } if "branch" in attempt else payload
        if "branch" in attempt:
            p = {"name": project_name, "project": project_name, "target": "production",
                 "gitSource": {"type": "github", "ref": attempt["branch"], "repoId": repo_id}}
        else:
            p = payload
        req = urllib.request.Request(
            f"{base}/v13/deployments",
            data=json.dumps(p).encode(),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                dep = json.loads(r.read().decode())
            url = dep.get("url") or dep.get("alias", [])
            if isinstance(url, list):
                url = url[0] if url else "—"
            print(f"OK Deploy disparado: {url}")
            print("  Espera 2 min y comprueba: https://rauli-panaderia-app.vercel.app")
            return 0
        except urllib.error.HTTPError as e:
            body = e.read().decode() if e.fp else ""
            err = body[:300]
            if "incorrect_git_source" in body or "branch" in body.lower():
                continue
            print(f"POST deployment error {e.code}: {err}")
            return 1

    print("ERROR: No se pudo desplegar. Comprueba en Vercel Dashboard:")
    print("  https://vercel.com/dashboard → Proyecto rauli-panaderia-app → Settings")
    print("  - Git: que esté conectado a mramirezraul71/rauli-panaderia")
    print("  - Production Branch: maestro o main")
    return 1

if __name__ == "__main__":
    sys.exit(main())
