# -*- coding: utf-8 -*-
"""
Cerebro IA — Robot RAULI con fallback automático entre modelos.
Orden de prioridad: Gemini 2.0 Flash → Gemini 1.5 Flash → Gemini Pro
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

# Lista de modelos en orden de prioridad (del más nuevo al más antiguo)
FALLBACK_MODELS = [
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-pro",
]


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


def init_gemini(api_key: str | None = None, model_id: str | None = None):
    """
    Configura y devuelve el modelo Gemini con fallback automático.
    Si un modelo falla por cuota, intenta con el siguiente en la lista.
    """
    key = (api_key or "").strip() or load_api_key()
    if not key:
        raise RuntimeError(
            "GEMINI_API_KEY no encontrada. Ponla en la Bóveda (credenciales.txt) o en variable de entorno."
        )
    
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FutureWarning)
        import google.generativeai as genai
    
    genai.configure(api_key=key)
    
    # Si se especifica un modelo, usarlo directamente
    if model_id:
        return genai.GenerativeModel(model_id), model_id
    
    # Intentar con cada modelo en orden de prioridad
    last_error = None
    for model_name in FALLBACK_MODELS:
        try:
            model = genai.GenerativeModel(model_name)
            # Probar con un mensaje simple
            test_response = model.generate_content("test")
            if test_response and test_response.text:
                return model, model_name
        except Exception as e:
            err_str = str(e)
            last_error = e
            # Si es error de cuota, intentar siguiente modelo
            if "429" in err_str or "quota" in err_str.lower():
                print(f"[AVISO] Cuota agotada para {model_name}, intentando siguiente modelo...", file=sys.stderr)
                continue
            # Si es otro error, también intentar siguiente
            print(f"[AVISO] Error con {model_name}: {e}, intentando siguiente...", file=sys.stderr)
            continue
    
    # Si todos fallaron
    raise RuntimeError(f"Todos los modelos fallaron. Último error: {last_error}")


def saludar_con_fallback() -> tuple[str, str]:
    """
    Envía 'Hola' a Gemini con fallback automático.
    Retorna (respuesta, modelo_usado)
    """
    try:
        model, model_name = init_gemini()
        r = model.generate_content("Hola, responde brevemente")
        if not r or not r.text:
            return "(respuesta vacía)", model_name
        return r.text.strip(), model_name
    except Exception as e:
        raise RuntimeError(f"Error al saludar con Gemini: {e}")


def ask_gemini(prompt: str, model_id: str | None = None) -> str:
    """
    Pregunta a Gemini con fallback automático.
    Si model_id es None, usa el sistema de fallback.
    """
    try:
        model, used_model = init_gemini(model_id=model_id)
        response = model.generate_content(prompt)
        if not response or not response.text:
            return "(respuesta vacía)"
        return response.text.strip()
    except Exception as e:
        return f"Error: {e}"


def main() -> int:
    print("Cerebro IA (Gemini) — prueba de conexión con fallback automático\n")
    try:
        respuesta, modelo = saludar_con_fallback()
        print(f"Modelo usado: {modelo}")
        print("Respuesta de Gemini:")
        print("-" * 40)
        print(respuesta)
        print("-" * 40)
        print(f"\n[OK] Cerebro vivo. Gemini ({modelo}) responde correctamente.")
        return 0
    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower():
            print("[ERROR] Todos los modelos tienen cuota agotada. Espera un poco o revisa https://ai.google.dev/gemini-api/docs/rate-limits", file=sys.stderr)
        print(f"[ERROR] {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
