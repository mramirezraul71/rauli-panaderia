# -*- coding: utf-8 -*-
"""
Actualiza la app Android: regenera AAB para Internal testing / Play Store.
Carga credenciales desde bóveda (credenciales.txt) o variables de entorno.
Funciona para cualquier usuario: busca keystore en rutas estándar.
Uso: python scripts/actualizar_app_android.py
      (o desde robot: "actualizar app android" / "generar AAB")
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _vault_paths():
    """Rutas donde buscar credenciales (cualquier usuario)."""
    v = os.environ.get("RAULI_VAULT", "")
    if v and Path(v).exists():
        yield Path(v)
    yield Path(r"C:\dev\credenciales.txt")
    yield ROOT / "credenciales.txt"
    home = Path.home()
    yield home / "credenciales.txt"
    # OneDrive / Escritorio (cualquier carpeta OneDrive)
    for candidate in ("Escritorio", "Desktop"):
        yield home / candidate / "credenciales.txt"
    if (home / "OneDrive").exists():
        for one in (home / "OneDrive").iterdir():
            if one.is_dir():
                for sub in ("Escritorio", "Desktop"):
                    yield one / sub / "credenciales.txt"


def _load_from_vault(keys: tuple[str, ...]) -> str:
    for key in keys:
        val = os.environ.get(key, "").strip()
        if val:
            return val
    keys_upper = tuple(k.upper() for k in keys)
    seen = set()
    for v in _vault_paths():
        p = Path(v) if isinstance(v, str) else v
        if not p or not p.exists() or str(p) in seen:
            continue
        seen.add(str(p))
        try:
            for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, val = line.partition("=")
                    if k.strip().upper() in keys_upper:
                        t = val.strip().strip("'\"").strip()
                        if t:
                            return t
        except Exception:
            pass
    return ""


def _find_keystore(android_dir: Path, explicit_path: str) -> Path | None:
    """Busca rauli-upload.keystore en rutas estándar."""
    candidates = []
    if explicit_path:
        candidates.append(Path(explicit_path))
    candidates.extend([
        android_dir / "rauli-upload.keystore",
        ROOT / "frontend" / "rauli-upload.keystore",
        Path.home() / "Desktop" / "rauli-upload.keystore",
        Path.home() / "Escritorio" / "rauli-upload.keystore",
    ])
    if (Path.home() / "OneDrive").exists():
        for one in (Path.home() / "OneDrive").iterdir():
            if one.is_dir():
                candidates.append(one / "Desktop" / "rauli-upload.keystore")
                candidates.append(one / "Escritorio" / "rauli-upload.keystore")
    for p in candidates:
        if p and p.exists():
            return p
    return None


def main() -> int:
    store_pass = _load_from_vault(("ANDROID_KEYSTORE_PASSWORD",))
    key_pass = _load_from_vault(("ANDROID_KEY_PASSWORD",))
    key_alias = _load_from_vault(("ANDROID_KEY_ALIAS",))
    keystore_path_hint = _load_from_vault(("ANDROID_KEYSTORE_PATH",))

    android_dir = ROOT / "frontend" / "android"
    keystore_props = android_dir / "keystore.properties"
    keystore_file = android_dir / "rauli-upload.keystore"

    # Crear keystore.properties desde bóveda si falta
    if store_pass and not keystore_props.exists():
        content = f"storePassword={store_pass}\nkeyPassword={key_pass or store_pass}\nkeyAlias={key_alias or 'rauli'}\nstoreFile=rauli-upload.keystore\n"
        keystore_props.write_text(content, encoding="utf-8")
        print("[actualizar_app_android] keystore.properties creado desde bóveda.")

    # Copiar keystore si falta en android/
    if not keystore_file.exists():
        found = _find_keystore(android_dir, keystore_path_hint)
        if found:
            shutil.copy2(found, keystore_file)
            print(f"[actualizar_app_android] Keystore copiado desde {found}")
        else:
            print("[ERROR] No se encontró rauli-upload.keystore. Ejecuta scripts/crear_keystore_android.ps1")
            print("  O añade ANDROID_KEYSTORE_PATH en credenciales.txt apuntando al keystore.")
            return 1

    ps1 = ROOT / "scripts" / "generar_aab.ps1"
    if not ps1.exists():
        print(f"[ERROR] No existe {ps1}")
        return 1
    r = subprocess.run(
        ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(ps1)],
        cwd=str(ROOT),
        timeout=300,
    )
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
