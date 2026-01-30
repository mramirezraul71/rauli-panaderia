# -*- coding: utf-8 -*-
"""
robot_preparar_todo.py — Descarga, instala y comprueba bot (rauli-panaderia).

  1. pip install (whisper, pydub, python-telegram-bot, pyttsx3, ...)
  2. ffmpeg (robot_instalar_ffmpeg --download)
  3. getMe + sendMessage verificación

Uso: python robot_preparar_todo.py
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent
PIP_DEPS = [
    "openai-whisper", "pydub", "python-telegram-bot", "pyttsx3",
    "pandas", "openpyxl", "httpx", "Pillow", "browser-use", "langchain-ollama", "ollama",
]
LOG: list[str] = []


def _log(msg: str, ok: bool | None = None) -> None:
    pref = "[OK] " if ok is True else "[--] " if ok is None else "[!!] "
    print(pref + msg)
    LOG.append(pref + msg)


def _venv_base() -> Path | None:
    for d in (BASE / ".venv", ROOT / ".venv"):
        if (d / "Scripts" / "pip.exe").exists():
            return d
    return None


def _pip() -> str:
    v = _venv_base()
    if v:
        return str(v / "Scripts" / "pip.exe")
    return "pip"


def _python() -> str:
    v = _venv_base()
    if v:
        return str(v / "Scripts" / "python.exe")
    return sys.executable


def _run(cmd: list[str], timeout: int = 600, log_stderr: bool = True) -> bool:
    r = subprocess.run(cmd, cwd=BASE, capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0 and log_stderr and (r.stderr or r.stdout):
        out = (r.stderr or "").strip() or (r.stdout or "").strip()
        if out:
            _log("  " + out[:400].replace("\n", " "), ok=False)
    return r.returncode == 0


def _load_telegram() -> tuple[str, str]:
    token, chat = "TU_BOT_TOKEN", "TU_CHAT_ID"
    env = BASE / "omni_telegram.env"
    if not env.exists():
        return token, chat
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            v = v.strip().strip("'\"")
            if k.strip() == "OMNI_BOT_TELEGRAM_TOKEN" and v:
                token = v
            elif k.strip() == "OMNI_BOT_TELEGRAM_CHAT_ID" and v:
                chat = v
    if token == "TU_BOT_TOKEN":
        token = os.environ.get("OMNI_BOT_TELEGRAM_TOKEN", token)
    if chat == "TU_CHAT_ID":
        chat = os.environ.get("OMNI_BOT_TELEGRAM_CHAT_ID", chat)
    return token, chat


def paso_pip() -> bool:
    _log("Paso 1: pip install...")
    venv_dir = BASE / ".venv"
    if _venv_base() is None:
        _log("Creando robot/.venv...")
        ok = _run([sys.executable, "-m", "venv", str(venv_dir)], timeout=120)
        if not ok:
            _log("Falló crear venv.", ok=False)
            return False
    pip = _pip()
    py = _python()
    ok = _run([py, "-m", "pip", "install", "--upgrade", "pip"], timeout=120)
    if not ok:
        _log("pip upgrade falló", ok=False)
        return False
    ok = _run([pip, "install"] + PIP_DEPS, timeout=600)
    if not ok:
        _log("pip install falló", ok=False)
        return False
    _log("Dependencias instaladas.", ok=True)
    return True


def paso_ffmpeg() -> bool:
    _log("Paso 2: ffmpeg...")
    if (BASE / "ffmpeg.exe").exists():
        _log("ffmpeg.exe ya existe.", ok=True)
        return True
    ok = _run([_python(), str(BASE / "robot_instalar_ffmpeg.py"), "--download"], timeout=300)
    if not ok:
        _log("Fallo ffmpeg. Ejecuta: python robot_instalar_ffmpeg.py --download", ok=False)
        return False
    _log("ffmpeg instalado.", ok=True)
    return True


def paso_comprobar_bot() -> bool:
    _log("Paso 3: comprobar bot...")
    token, chat = _load_telegram()
    if token in ("TU_BOT_TOKEN", "") or chat in ("TU_CHAT_ID", ""):
        _log("Configura omni_telegram.env (BOT_TOKEN, CHAT_ID).", ok=False)
        return False
    import urllib.request
    import urllib.parse
    import json
    base_url = f"https://api.telegram.org/bot{token}"
    try:
        with urllib.request.urlopen(urllib.request.Request(f"{base_url}/getMe"), timeout=15) as r:
            d = json.loads(r.read().decode())
        if not d.get("ok"):
            _log("getMe falló: " + str(d), ok=False)
            return False
        _log("Bot @" + (d.get("result", {}).get("username", "?") or "?") + " OK.", ok=True)
    except Exception as e:
        _log("getMe error: " + str(e), ok=False)
        return False
    try:
        body = urllib.parse.urlencode({"chat_id": chat, "text": "Robot preparar (rauli-panaderia): verificación OK. Bot activo."})
        req = urllib.request.Request(f"{base_url}/sendMessage", data=body.encode(), method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        with urllib.request.urlopen(req, timeout=15) as r:
            d = json.loads(r.read().decode())
        if not d.get("ok"):
            _log("sendMessage falló", ok=False)
            return False
        _log("Mensaje enviado a Telegram.", ok=True)
    except Exception as e:
        _log("sendMessage error: " + str(e), ok=False)
        return False
    return True


def main() -> None:
    print("")
    print("=" * 60)
    print("  ROBOT PREPARAR TODO — rauli-panaderia")
    print("=" * 60)
    print("")
    r1 = paso_pip()
    r2 = paso_ffmpeg()
    r3 = paso_comprobar_bot()
    print("")
    print("=" * 60)
    print("  pip: " + ("OK" if r1 else "FALLO") + "  |  ffmpeg: " + ("OK" if r2 else "FALLO") + "  |  bot: " + ("OK" if r3 else "FALLO"))
    print("=" * 60)
    if r3:
        print("Arranca: run_bot_siempre.bat  o  python omni_gestor_proyectos.py")
    print("")
    sys.exit(0 if (r1 and r2 and r3) else 1)


if __name__ == "__main__":
    main()
