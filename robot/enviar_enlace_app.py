# -*- coding: utf-8 -*-
"""
Envía el enlace de descarga de la app RAULI por Telegram.
Imprime también el enlace y enlaces listos para WhatsApp y correo.
Credenciales: robot/omni_telegram.env o Bóveda (C:\\dev\\credenciales.txt).
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

# Mensaje unificado (Telegram, WhatsApp, correo)
MSG_TELEGRAM = (
    f"Descarga la app {APP_NAME}\n\n"
    f"Abre en el navegador o instala como app (Add to Home Screen / Instalar):\n{APP_URL}\n\n"
    "PWA: funciona offline tras la primera carga."
)
MSG_WHATSAPP = f"Descarga la app {APP_NAME}. Abre o instala aqui: {APP_URL}"
MSG_EMAIL_SUBJECT = f"Enlace app {APP_NAME}"
MSG_EMAIL_BODY = f"Descarga o abre la app {APP_NAME} en el navegador (tambien puedes instalarla como app):\n\n{APP_URL}\n\nPWA - funciona offline."


def _vault_paths():
    """C:\\dev\\credenciales.txt primero (Bóveda típica)."""
    yield Path(r"C:\dev\credenciales.txt")
    v = os.environ.get("RAULI_VAULT", "")
    if v:
        yield Path(v)
    yield BASE.parent / "credenciales.txt"
    yield BASE / "credenciales.txt"
    home = Path.home()
    yield home / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt"
    yield home / "Escritorio" / "credenciales.txt"
    yield home / "Desktop" / "credenciales.txt"


def load_telegram():
    token = os.environ.get("OMNI_BOT_TELEGRAM_TOKEN", "") or os.environ.get("TELEGRAM_TOKEN", "")
    chat = os.environ.get("OMNI_BOT_TELEGRAM_CHAT_ID", "") or os.environ.get("TELEGRAM_CHAT_ID", "")
    # Bóveda primero (C:\dev\credenciales.txt con TELEGRAM_TOKEN, OPERATOR_TELEGRAM, etc.)
    for v in _vault_paths():
        p = Path(v) if isinstance(v, str) else v
        if not p or not (p.exists() if hasattr(p, "exists") else False):
            continue
        try:
            for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, val = line.partition("=")
                    k, val = k.strip().upper(), val.strip().strip("'\"").strip()
                    if not val or "TU_" in val:
                        continue
                    if k in ("OMNI_BOT_TELEGRAM_TOKEN", "TELEGRAM_TOKEN"):
                        token = token or val
                    elif k in ("OMNI_BOT_TELEGRAM_CHAT_ID", "TELEGRAM_CHAT_ID", "OPERATOR_TELEGRAM"):
                        chat = chat or val
            if token and chat:
                return token, chat
        except Exception:
            pass
    if ENV.exists():
        for line in ENV.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                v = v.strip().strip("'\"").strip()
                if k.strip() == "OMNI_BOT_TELEGRAM_TOKEN" and v:
                    token = token or v
                elif k.strip() == "OMNI_BOT_TELEGRAM_CHAT_ID" and v:
                    chat = chat or v
    return token, chat


def send_telegram(text):
    token, chat = load_telegram()
    if not token or not chat or token == "TU_BOT_TOKEN" or chat == "TU_CHAT_ID":
        return False, "Configura robot/omni_telegram.env o Boveda (OMNI_BOT_TELEGRAM_TOKEN, OMNI_BOT_TELEGRAM_CHAT_ID)."
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    body = urllib.parse.urlencode({"chat_id": chat, "text": text[:4096]})
    req = urllib.request.Request(url, data=body.encode(), method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            d = json.loads(r.read().decode())
        return d.get("ok", False), "OK" if d.get("ok") else str(d)
    except Exception as e:
        return False, str(e)


def main():
    ok, detail = send_telegram(MSG_TELEGRAM)
    if ok:
        print("Enlace enviado a tu Telegram.")
    else:
        print("Telegram:", detail)

    print()
    print("=" * 55)
    print("  ENLACE PARA DESCARGAR / ABRIR LA APP")
    print("=" * 55)
    print()
    print("  Directo (abre en navegador o instala como PWA):")
    print("  " + APP_URL)
    print()
    print("  WhatsApp (abre y envia el mensaje a quien quieras):")
    wa_text = urllib.parse.quote(MSG_WHATSAPP)
    print("  https://wa.me/?text=" + wa_text)
    print()
    print("  Correo (copia asunto y cuerpo):")
    print("  ---")
    print(f"  Asunto: {MSG_EMAIL_SUBJECT}")
    print("  Cuerpo:")
    for line in MSG_EMAIL_BODY.split("\n"):
        print("    " + line)
    print("  ---")
    print("=" * 55)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
