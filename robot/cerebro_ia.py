# -*- coding: utf-8 -*-
"""
Cerebro IA — Robot RAULI integrado con Google Gemini.
Lee GEMINI_API_KEY desde la Bóveda (archivo maestro de credenciales).

Requisito: pip install google-generativeai
Prueba:    python robot/cerebro_ia.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
# Permitir usar paquetes instalados en robot/packages (pip install --target robot/packages google-generativeai)
if (BASE / "packages").exists() and str(BASE / "packages") not in sys.path:
    sys.path.insert(0, str(BASE / "packages"))

# Bóveda: mismo orden que en scripts del repo (env → C:\\dev → repo → OneDrive → Escritorio)
def _vault_paths():
    yield os.environ.get("RAULI_VAULT", "")
    yield Path(r"C:\dev\credenciales.txt")
    yield BASE.parent / "credenciales.txt"
    yield BASE / "credenciales.txt"
    home = Path.home()
    yield home / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt"
    yield home / "Escritorio" / "credenciales.txt"
    yield home / "Desktop" / "credenciales.txt"
    if (home / "OneDrive").exists():
        for one in (home / "OneDrive").iterdir():
            if one.is_dir():
                yield one / "Escritorio" / "credenciales.txt"
                yield one / "Desktop" / "credenciales.txt"


KEY_NAMES = ("GEMINI_API_KEY", "GEMINI_KEY", "AI_API_KEY")


def load_api_key() -> str:
    """Carga GEMINI_API_KEY desde env o desde la Bóveda."""
    for name in KEY_NAMES:
        val = os.environ.get(name, "").strip()
        if val and val.startswith("AIza"):
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
                    k = k.strip().upper()
                    if k in KEY_NAMES:
                        val = val.strip().strip("'\"").strip()
                        if val and val.startswith("AIza"):
                            return val
        except Exception:
            pass
    return ""


def init_gemini(api_key: str | None = None):
    """Configura y devuelve el modelo Gemini listo para usar."""
    key = (api_key or "").strip() or load_api_key()
    if not key:
        raise RuntimeError(
            "GEMINI_API_KEY no encontrada. Ponla en la Bóveda (credenciales.txt) o en variable de entorno."
        )
    import google.generativeai as genai
    genai.configure(api_key=key)
    return genai.GenerativeModel("gemini-1.5-flash")


def saludar() -> str:
    """Envía 'Hola' a Gemini y devuelve su respuesta."""
    model = init_gemini()
    r = model.generate_content("Hola")
    if not r or not r.text:
        return "(respuesta vacía)"
    return r.text.strip()


def main() -> int:
    print("Cerebro IA (Gemini) — prueba de conexión\n")
    try:
        respuesta = saludar()
        print("Respuesta de Gemini:")
        print("-" * 40)
        print(respuesta)
        print("-" * 40)
        print("\n[OK] Cerebro vivo. Gemini responde correctamente.")
        return 0
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
