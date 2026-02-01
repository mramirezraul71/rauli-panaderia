# -*- coding: utf-8 -*-
"""
Activa el seguimiento por Telegram: envía mensaje de prueba y confirma que el bot está listo.
Para dejar el bot escuchando comandos (/ping, /captura, voz): ejecuta run_bot_siempre.bat
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
if str(BASE.parent) not in sys.path:
    sys.path.insert(0, str(BASE.parent))

try:
    from telegram_robot import telegram_available, telegram_send
except ImportError:
    # Fallback si se ejecuta desde robot/
    import os
    ENV_FILE = BASE / "omni_telegram.env"
    _token, _chat = "", ""

    def _load():
        global _token, _chat
        if ENV_FILE.exists():
            for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, v = line.partition("=")
                    v = v.strip().strip("'\"")
                    if k.strip() == "OMNI_BOT_TELEGRAM_TOKEN" and v:
                        _token = v
                    elif k.strip() == "OMNI_BOT_TELEGRAM_CHAT_ID" and v:
                        _chat = v
        if not _token:
            _token = os.environ.get("OMNI_BOT_TELEGRAM_TOKEN", "")
        if not _chat:
            _chat = os.environ.get("OMNI_BOT_TELEGRAM_CHAT_ID", "")
        return _token, _chat

    def telegram_available():
        t, c = _load()
        return bool(t and c and t != "TU_BOT_TOKEN" and c != "TU_CHAT_ID")

    def telegram_send(text: str) -> bool:
        try:
            import httpx
        except ImportError:
            return False
        t, c = _load()
        if not telegram_available():
            return False
        url = f"https://api.telegram.org/bot{t}/sendMessage"
        r = httpx.post(url, json={"chat_id": c, "text": text[:4096]}, timeout=15.0)
        return r.status_code == 200


def main():
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    msg = f"Bot RAULI — Seguimiento activo.\n{ts}"
    if not telegram_available():
        print("Telegram no configurado. Rellena robot/omni_telegram.env (OMNI_BOT_TELEGRAM_TOKEN, OMNI_BOT_TELEGRAM_CHAT_ID).")
        return 1
    if telegram_send(msg):
        print("Mensaje enviado a Telegram. Seguimiento activo.")
        print("Para dejar el bot escuchando: run_bot_siempre.bat (o run_bot_siempre.ps1)")
        return 0
    print("Error al enviar a Telegram. Revisa token y chat_id.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
