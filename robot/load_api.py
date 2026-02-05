# -*- coding: utf-8 -*-
"""
Carga la URL de la API desde api_robot.txt o credenciales.
Uso: from robot.load_api import get_api_base
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _vault_paths():
    v = os.environ.get("RAULI_VAULT", "")
    if v and Path(v).exists():
        yield Path(v)
    yield Path(r"C:\dev\credenciales.txt")
    yield ROOT / "credenciales.txt"
    yield Path.home() / "credenciales.txt"
    for c in ("Escritorio", "Desktop"):
        yield Path.home() / c / "credenciales.txt"
    if (Path.home() / "OneDrive").exists():
        for one in (Path.home() / "OneDrive").iterdir():
            if one.is_dir():
                for c in ("Escritorio", "Desktop"):
                    yield one / c / "credenciales.txt"


def get_api_base() -> str:
    """API base (ej: https://puente-rauli.xxx.workers.dev/api). Prioridad: api_robot.txt > credenciales > env."""
    # 1. api_robot.txt (solo pegar URL)
    p = ROOT / "api_robot.txt"
    if p.exists():
        for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and (line.startswith("http://") or line.startswith("https://")):
                return line.rstrip("/") + ("/api" if not line.endswith("/api") else "").replace("/api/api", "/api")
    # 2. credenciales (VITE_API_BASE)
    for v in _vault_paths():
        if not v.exists():
            continue
        try:
            for line in v.read_text(encoding="utf-8", errors="ignore").splitlines():
                if "=" in line and not line.strip().startswith("#"):
                    k, _, val = line.partition("=")
                    if k.strip().upper() in ("VITE_API_BASE", "VITE_API_URL"):
                        t = val.strip().strip("'\"").strip()
                        if t and t.startswith("http"):
                            return t.rstrip("/")
        except Exception:
            pass
    # 3. env
    return (os.environ.get("VITE_API_BASE") or os.environ.get("VITE_API_URL") or "").strip().rstrip("/") or ""

