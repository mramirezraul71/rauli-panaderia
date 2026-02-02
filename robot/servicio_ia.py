# -*- coding: utf-8 -*-
"""
Protocolo de Inteligencia Híbrida — A prueba de fallos.
Servicio unificado: Gemini → Groq → Ollama (offline).

Carga GEMINI_API_KEY y GROQ_API_KEY desde la Bóveda Maestra (dotenv).
Prueba: python robot/servicio_ia.py  → diagnóstico de los tres proveedores.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
if (BASE / "packages").exists() and str(BASE / "packages") not in sys.path:
    sys.path.insert(0, str(BASE / "packages"))

# Bóveda Maestra: dotenv desde C:\dev\credenciales.txt y fallbacks
VAULT_PATHS = [
    lambda: os.environ.get("RAULI_VAULT", ""),
    lambda: str(Path(r"C:\dev\credenciales.txt")),
    lambda: str(BASE.parent / "credenciales.txt"),
    lambda: str(BASE / "credenciales.txt"),
    lambda: str(Path.home() / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt"),
    lambda: str(Path.home() / "Escritorio" / "credenciales.txt"),
    lambda: str(Path.home() / "Desktop" / "credenciales.txt"),
]

# Modelos Gemini en orden de prioridad (fallback automático)
GEMINI_MODELS = [
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-pro",
]


def _cargar_boveda() -> None:
    for get_path in VAULT_PATHS:
        p = Path(get_path())
        if not p or not p.exists():
            continue
        try:
            from dotenv import load_dotenv
            load_dotenv(p, override=False)
            return
        except ImportError:
            pass
        # Fallback sin dotenv: leer KEY=value y cargar en os.environ
        try:
            for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, v = line.partition("=")
                    k, v = k.strip(), v.strip().strip("'\"").strip()
                    if k and k not in os.environ:
                        os.environ[k] = v
            return
        except Exception:
            continue


_cargar_boveda()

GEMINI_KEY_NAMES = ("GEMINI_API_KEY", "GEMINI_KEY", "AI_API_KEY")
GROQ_KEY_NAMES = ("GROQ_API_KEY", "GROQ_KEY")
OLLAMA_BASE = os.environ.get("OLLAMA_BASE", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")
GROQ_MODELS = ("llama3-8b-8192", "mixtral-8x7b-32768", "llama3-70b-8192")


def _get_gemini_key() -> str:
    for name in GEMINI_KEY_NAMES:
        val = os.environ.get(name, "").strip()
        if val and val.startswith("AIza"):
            return val
    return ""


def _get_groq_key() -> str:
    for name in GROQ_KEY_NAMES:
        val = os.environ.get(name, "").strip()
        if val:
            return val
    return ""


# --- INTENTO 1: Gemini ---
def _llamar_gemini(mensaje: str) -> str:
    key = _get_gemini_key()
    if not key:
        raise RuntimeError("GEMINI_API_KEY no encontrada en la Bóveda.")
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FutureWarning)
        import google.generativeai as genai
    genai.configure(api_key=key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    r = model.generate_content(mensaje)
    if not r or not r.text:
        raise RuntimeError("Gemini devolvió respuesta vacía.")
    return r.text.strip()


# --- FALLO 1: Groq ---
def _llamar_groq(mensaje: str) -> str:
    key = _get_groq_key()
    if not key:
        raise RuntimeError("GROQ_API_KEY no encontrada en la Bóveda.")
    from groq import Groq
    client = Groq(api_key=key)
    for model_id in GROQ_MODELS:
        try:
            completion = client.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": mensaje}],
                max_tokens=1024,
            )
            text = (completion.choices[0].message.content or "").strip()
            if text:
                return text
        except Exception:
            continue
    raise RuntimeError("Groq no respondió con ningún modelo.")


# --- FALLO 2: Ollama (offline) ---
def _llamar_ollama(mensaje: str) -> str:
    import requests
    url = f"{OLLAMA_BASE.rstrip('/')}/api/generate"
    payload = {"model": OLLAMA_MODEL, "prompt": mensaje, "stream": False}
    try:
        r = requests.post(url, json=payload, timeout=30)
        r.raise_for_status()
        data = r.json()
        text = (data.get("response") or "").strip()
        if text:
            return text
    except Exception as e:
        raise RuntimeError(f"Ollama no disponible: {e}") from e
    raise RuntimeError("Ollama devolvió respuesta vacía.")


def generar_respuesta(mensaje: str) -> tuple[str, str]:
    """
    Función maestra: intenta Gemini → Groq → Ollama.
    Devuelve (texto_respuesta, proveedor_usado).
    """
    # INTENTO 1: Gemini
    try:
        texto = _llamar_gemini(mensaje)
        return (texto, "gemini")
    except Exception:
        pass

    # FALLO 1: Groq
    try:
        texto = _llamar_groq(mensaje)
        return (texto, "groq")
    except Exception:
        pass

    # FALLO 2: Ollama (offline)
    try:
        texto = _llamar_ollama(mensaje)
        return (texto, "ollama")
    except Exception as e:
        raise RuntimeError(
            "Los tres proveedores fallaron (Gemini, Groq, Ollama). "
            "Comprueba claves en la Bóveda, conexión a internet y que Ollama esté en ejecución."
        ) from e


def diagnosticar() -> dict[str, str]:
    """
    Prueba conexión con Gemini, Groq y Ollama.
    Devuelve {"gemini": "OK"|"error", "groq": ..., "ollama": ...}.
    """
    resultado = {}
    mensaje_prueba = "Responde solo: OK"

    # Gemini
    try:
        _llamar_gemini(mensaje_prueba)
        resultado["gemini"] = "OK"
    except Exception as e:
        resultado["gemini"] = str(e)[:80]

    # Groq
    try:
        _llamar_groq(mensaje_prueba)
        resultado["groq"] = "OK"
    except Exception as e:
        resultado["groq"] = str(e)[:80]

    # Ollama
    try:
        _llamar_ollama(mensaje_prueba)
        resultado["ollama"] = "OK"
    except Exception as e:
        resultado["ollama"] = str(e)[:80]

    return resultado


def main() -> int:
    print("=== Protocolo de Inteligencia Híbrida — Diagnóstico ===\n")
    print("Bóveda: C:\\dev\\credenciales.txt (y fallbacks)\n")

    # Diagnóstico
    diag = diagnosticar()
    for proveedor, estado in diag.items():
        icon = "[OK]" if estado == "OK" else "[X]"
        print(f"  {icon} {proveedor.upper():8} -> {estado}")

    ok = sum(1 for v in diag.values() if v == "OK")
    print(f"\n  Resumen: {ok}/3 proveedores disponibles.\n")

    if ok == 0:
        print("  Ningún proveedor respondió. Revisa claves y Ollama.")
        return 1

    # Prueba real de generar_respuesta
    print("=== Prueba generar_respuesta('Hola') ===\n")
    try:
        texto, proveedor = generar_respuesta("Hola")
        print(f"  Proveedor usado: {proveedor.upper()}")
        print(f"  Respuesta: {texto[:200]}{'...' if len(texto) > 200 else ''}\n")
        print("  [OK] Servicio híbrido operativo.")
        return 0
    except Exception as e:
        print(f"  [ERROR] {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
