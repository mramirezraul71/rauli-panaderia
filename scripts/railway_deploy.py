# -*- coding: utf-8 -*-
"""
Dispara deploy del backend en Railway.
Carga RAILWAY_TOKEN desde C:\\dev\\credenciales.txt o env.
Requisito: tener ya un proyecto en Railway con el repo conectado (root: backend).
Uso: python scripts/railway_deploy.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

RAILWAY_GRAPHQL = "https://backboard.railway.com/graphql/v2"
PROJECT_NAME = os.environ.get("RAILWAY_PROJECT_NAME", "rauli-panaderia")


def _vault_paths():
    yield os.environ.get("RAULI_VAULT", "")
    yield Path(r"C:\dev\credenciales.txt")
    yield Path(__file__).resolve().parent.parent / "credenciales.txt"
    yield Path(__file__).resolve().parent.parent / "backend" / ".env"


RAILWAY_KEYS = ("RAILWAY_TOKEN", "RAILWAY_API_TOKEN")

def load_token():
    for key in RAILWAY_KEYS:
        token = os.environ.get(key, "").strip()
        if token:
            return token
    for v in _vault_paths():
        p = Path(v) if isinstance(v, str) else v
        if not p or not getattr(p, "exists", lambda: False) or not p.exists():
            continue
        try:
            for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, val = line.partition("=")
                    if k.strip().upper() in RAILWAY_KEYS:
                        t = val.strip().strip("'\"").strip()
                        if t:
                            return t
        except Exception:
            pass
    return ""


def gql(token: str, query: str, variables: dict | None = None):
    req = urllib.request.Request(
        RAILWAY_GRAPHQL,
        data=json.dumps({"query": query, "variables": variables or {}}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def main():
    token = load_token()
    if not token:
        print("ERROR: RAILWAY_TOKEN no encontrado. Añade RAILWAY_TOKEN=... (o RAILWAY_API_TOKEN=...) en C:\\dev\\credenciales.txt")
        print("  Crea el token en: https://railway.com/account/tokens")
        return 1

    try:
        # Listar proyectos
        data = gql(token, "query { projects { edges { node { id name } } } }")
        projects = data.get("data", {}).get("projects", {}).get("edges", [])
        proj_node = None
        for e in projects:
            n = e.get("node", {})
            if (n.get("name") or "").strip().lower() == PROJECT_NAME.strip().lower():
                proj_node = n
                break
        if not proj_node:
            # Intentar por nombre que contenga "rauli" o "panaderia"
            for e in projects:
                n = e.get("node", {})
                name = (n.get("name") or "").lower()
                if "rauli" in name or "panaderia" in name:
                    proj_node = n
                    break
        if not proj_node:
            print(f"ERROR: No hay proyecto en Railway con nombre '{PROJECT_NAME}'.")
            print("  Crea el proyecto en Railway (ver RAILWAY_SETUP.md) o define RAILWAY_PROJECT_NAME.")
            return 1

        project_id = proj_node["id"]

        # Proyecto con servicios y entornos
        data = gql(
            token,
            """query project($id:String!) {
              project(id:$id) {
                id name
                services { edges { node { id name } } }
                environments { edges { node { id name } } }
              }
            }""",
            {"id": project_id},
        )
        proj = (data.get("data") or {}).get("project")
        if not proj:
            print("ERROR: No se pudo obtener proyecto.")
            return 1

        services = [e["node"] for e in (proj.get("services") or {}).get("edges", [])]
        envs = [e["node"] for e in (proj.get("environments") or {}).get("edges", [])]
        if not services:
            print("ERROR: El proyecto no tiene servicios. Conecta el repo en Railway.")
            return 1
        if not envs:
            print("ERROR: El proyecto no tiene entornos.")
            return 1

        service_id = services[0]["id"]
        environment_id = envs[0]["id"]

        # Disparar deploy
        data = gql(
            token,
            """mutation serviceInstanceDeployV2($serviceId:String!,$environmentId:String!) {
              serviceInstanceDeployV2(serviceId:$serviceId, environmentId:$environmentId)
            }""",
            {"serviceId": service_id, "environmentId": environment_id},
        )
        errs = data.get("errors")
        if errs:
            print("ERROR Railway:", errs[0].get("message", errs))
            return 1
        dep_id = (data.get("data") or {}).get("serviceInstanceDeployV2")
        print("OK Deploy disparado en Railway.")
        if dep_id:
            print(f"  Deployment ID: {dep_id}")
        print("  Espera 1–2 min y comprueba: python scripts/comprobar_urls.py")
        return 0
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"ERROR HTTP {e.code}: {body[:400]}")
        return 1
    except Exception as e:
        print(f"ERROR: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
