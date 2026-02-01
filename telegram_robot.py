# -*- coding: utf-8 -*-
"""Módulo compartido: Telegram y voz para robots (RauliERP-Panaderia)."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

BASE = Path(__file__).resolve().parent

def _env_candidates():
    """Rutas donde buscar token y chat_id. C:\\dev\\credenciales.txt primero (Bóveda típica)."""
    yield Path(r"C:\dev\credenciales.txt")
    yield Path.home() / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt"
    yield Path.home() / "Escritorio" / "credenciales.txt"
    yield Path.home() / "Desktop" / "credenciales.txt"
    yield BASE / "robot" / "omni_telegram.env"
    yield BASE / "omni_telegram.env"

_TOKEN: Optional[str] = None
_CHAT_ID: Optional[str] = None


def _parse_env_file(path: Path) -> tuple[str, str]:
    token, chat = "", ""
    if not path.exists():
        return token, chat
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                v = v.strip().strip("'\"")
                k = k.strip()
                if not v or v in ("TU_BOT_TOKEN", "TU_CHAT_ID"):
                    continue
                if k in ("OMNI_BOT_TELEGRAM_TOKEN", "TELEGRAM_TOKEN"):
                    token = v
                elif k in ("OMNI_BOT_TELEGRAM_CHAT_ID", "TELEGRAM_CHAT_ID", "OPERATOR_TELEGRAM"):
                    chat = v
    except Exception:
        pass
    return token, chat


def _load_config() -> tuple[str, str]:
    """Carga token y chat_id desde robot/omni_telegram.env, raíz o Bóveda."""
    global _TOKEN, _CHAT_ID
    if _TOKEN is not None:
        return _TOKEN or "", _CHAT_ID or ""
    token, chat = "", ""
    for path in _env_candidates():
        t, c = _parse_env_file(path)
        if t:
            token = t
        if c:
            chat = c
        if token and chat:
            break
    if not token:
        token = os.environ.get("OMNI_BOT_TELEGRAM_TOKEN", "") or os.environ.get("TELEGRAM_TOKEN", "")
    if not chat:
        chat = os.environ.get("OMNI_BOT_TELEGRAM_CHAT_ID", "") or os.environ.get("TELEGRAM_CHAT_ID", "")
    _TOKEN, _CHAT_ID = token, chat
    return token, chat


def telegram_available() -> bool:
    """True si Telegram está configurado."""
    token, chat = _load_config()
    return bool(token and chat and token != "TU_BOT_TOKEN" and chat != "TU_CHAT_ID")


def telegram_send(text: str) -> bool:
    """Envía mensaje de texto a Telegram."""
    token, chat = _load_config()
    if not telegram_available():
        return False
    try:
        import httpx
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        r = httpx.post(url, json={"chat_id": chat, "text": text[:4096]}, timeout=15.0)
        return r.status_code == 200
    except Exception as e:
        logging.getLogger(__name__).warning("[Telegram] %s", e)
        return False


def telegram_send_photo(path: Path, caption: str = "") -> bool:
    """Envía imagen a Telegram."""
    if not path.exists():
        return False
    token, chat = _load_config()
    if not telegram_available():
        return False
    try:
        import httpx
        url = f"https://api.telegram.org/bot{token}/sendPhoto"
        with open(path, "rb") as f:
            files = {"photo": (path.name, f, "image/png")}
            data = {"chat_id": chat, "caption": caption[:1024]}
            r = httpx.post(url, data=data, files=files, timeout=30.0)
        return r.status_code == 200
    except Exception as e:
        logging.getLogger(__name__).warning("[Telegram] %s", e)
        return False


_voice_engine = None


def voice_say(text: str) -> None:
    """Anuncia por voz (pyttsx3)."""
    global _voice_engine
    try:
        import pyttsx3
    except ImportError:
        return
    try:
        if _voice_engine is None:
            _voice_engine = pyttsx3.init()
        _voice_engine.say(text)
        _voice_engine.runAndWait()
    except Exception:
        pass
