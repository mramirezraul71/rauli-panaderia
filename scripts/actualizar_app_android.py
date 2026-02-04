# -*- coding: utf-8 -*-
"""
Actualiza la app Android: regenera AAB para Internal testing / Play Store.
Carga credenciales desde bóveda (ANDROID_KEYSTORE_PASSWORD, etc.).
Uso: python scripts/actualizar_app_android.py
      (o desde robot: "actualizar app android" / "generar AAB")
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _vault_paths():
    yield os.environ.get("RAULI_VAULT", "")
    yield Path(r"C:\dev\credenciales.txt")
    yield ROOT / "credenciales.txt"
    home = Path.home()
    yield home / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt"
    yield home / "Escritorio" / "credenciales.txt"
    yield home / "Desktop" / "credenciales.txt"


def _load_from_vault(keys: tuple[str, ...]) -> str:
    for key in keys:
        val = os.environ.get(key, "").strip()
        if val:
            return val
    keys_upper = tuple(k.upper() for k in keys)
    for v in _vault_paths():
        p = Path(v) if isinstance(v, str) else v
        if not p or not getattr(p, "exists", lambda: False) or not p.exists():
            continue
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


def main() -> int:
    # Asegurar keystore.properties desde bóveda
    store_pass = _load_from_vault(("ANDROID_KEYSTORE_PASSWORD",))
    key_pass = _load_from_vault(("ANDROID_KEY_PASSWORD",))
    key_alias = _load_from_vault(("ANDROID_KEY_ALIAS", "ANDROID_KEY_ALIAS"))
    keystore_path = _load_from_vault(("ANDROID_KEYSTORE_PATH",))

    android_dir = ROOT / "frontend" / "android"
    keystore_props = android_dir / "keystore.properties"
    keystore_file = android_dir / "rauli-upload.keystore"

    if store_pass and not keystore_props.exists():
        content = f"storePassword={store_pass}\nkeyPassword={key_pass or store_pass}\nkeyAlias={key_alias or 'rauli'}\nstoreFile=rauli-upload.keystore\n"
        keystore_props.write_text(content, encoding="utf-8")
        print("[actualizar_app_android] keystore.properties creado desde bóveda.")

    if keystore_path and Path(keystore_path).exists() and not keystore_file.exists():
        import shutil
        shutil.copy2(keystore_path, keystore_file)
        print("[actualizar_app_android] Keystore copiado desde bóveda.")

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
