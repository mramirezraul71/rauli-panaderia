# -*- coding: utf-8 -*-
"""
Envía el enlace de descarga de la app RAULI por Telegram.
Imprime también el enlace y enlaces listos para WhatsApp y correo.
"""
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent
ENV = BASE / "omni_telegram.env"
APP_URL = os.environ.get("RAULI_APP_URL", "https://rauli-panaderia-app.vercel.app")
APP_NAME = "RAULI - Panaderia y Dulceria"


def load_telegram():
    token = os.environ.get("OMNI_BOT_TELEGRAM_TOKEN", "")
    chat = os.environ.get("OMNI_BOT_TELEGRAM_CHAT_ID", "")
    if ENV.exists():
        for line in ENV.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                v = v.strip().strip("'\"").strip()
                if k.strip() == "OMNI_BOT_TELEGRAM_TOKEN" and v:
                    token = v
                elif k.strip() == "OMNI_BOT_TELEGRAM_CHAT_ID" and v:
                    chat = v
    return token, chat


def send_telegram(text):
    token, chat = load_telegram()
    if not token or not chat or token == "TU_BOT_TOKEN" or chat == "TU_CHAT_ID":
        return False, "Configura robot/omni_telegram.env (token y chat_id)."
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    body = urllib.parse.urlencode({"chat_id": chat, "text": text})
    req = urllib.request.Request(url, data=body.encode(), method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            d = json.loads(r.read().decode())
        return d.get("ok", False), "OK" if d.get("ok") else str(d)
    except Exception as e:
        return False, str(e)


def main():
    msg = f"Descarga la app {APP_NAME}\n\nAbrir / instalar (PWA):\n{APP_URL}"
    ok, detail = send_telegram(msg)
    if ok:
        print("Enlace enviado a tu Telegram.")
    else:
        print("Telegram:", detail)

    print()
    print("=" * 50)
    print("ENLACE PARA DESCARGAR / ABRIR LA APP")
    print("=" * 50)
    print(APP_URL)
    print()
    print("WhatsApp (abre WhatsApp con el mensaje listo para enviar):")
    wa_text = urllib.parse.quote(f"Descarga la app {APP_NAME}: {APP_URL}")
    print(f"https://wa.me/?text={wa_text}")
    print()
    print("Correo (copia y pega en el cuerpo del mensaje):")
    print(f"Asunto: Enlace app {APP_NAME}")
    print(f"Cuerpo: Descarga o abre la app aqui: {APP_URL}")
    print("=" * 50)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
