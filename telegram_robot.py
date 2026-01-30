# -*- coding: utf-8 -*-
"""Módulo compartido: Telegram y voz para robots (RauliERP-Panaderia)."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

BASE = Path(__file__).resolve().parent
ENV_FILE = BASE / "omni_telegram.env"

_TOKEN: Optional[str] = None
_CHAT_ID: Optional[str] = None


def _load_config() -> tuple[str, str]:
    """Carga token y chat_id desde omni_telegram.env o variables de entorno."""
    global _TOKEN, _CHAT_ID
    if _TOKEN is not None:
        return _TOKEN or "", _CHAT_ID or ""
    token, chat = "", ""
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                v = v.strip().strip("'\"")
                if k.strip() == "OMNI_BOT_TELEGRAM_TOKEN" and v:
                    token = v
                elif k.strip() == "OMNI_BOT_TELEGRAM_CHAT_ID" and v:
                    chat = v
    if not token:
        token = os.environ.get("OMNI_BOT_TELEGRAM_TOKEN", "")
    if not chat:
        chat = os.environ.get("OMNI_BOT_TELEGRAM_CHAT_ID", "")
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
