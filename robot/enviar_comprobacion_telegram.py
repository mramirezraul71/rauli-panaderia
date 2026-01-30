# -*- coding: utf-8 -*-
"""Envía mensaje de comprobación al bot de Telegram."""
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent
ENV = BASE / "omni_telegram.env"


def main():
    token = os.environ.get("OMNI_BOT_TELEGRAM_TOKEN", "")
    chat = os.environ.get("OMNI_BOT_TELEGRAM_CHAT_ID", "")
    if ENV.exists():
        for line in ENV.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                v = v.strip().strip("'\"")
                if k.strip() == "OMNI_BOT_TELEGRAM_TOKEN" and v:
                    token = v
                elif k.strip() == "OMNI_BOT_TELEGRAM_CHAT_ID" and v:
                    chat = v
    if not token or not chat or token == "TU_BOT_TOKEN" or chat == "TU_CHAT_ID":
        print("Configura robot/omni_telegram.env (token y chat_id).")
        return 1
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    body = urllib.parse.urlencode({
        "chat_id": chat,
        "text": "Robot preparar (rauli-panaderia): verificación OK. Bot activo.",
    })
    req = urllib.request.Request(url, data=body.encode(), method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            d = json.loads(r.read().decode())
        if d.get("ok"):
            print("Mensaje de comprobación enviado a tu Telegram.")
            return 0
        print("Error:", d)
        return 1
    except Exception as e:
        print("Error enviando:", e)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
