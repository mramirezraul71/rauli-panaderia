# -*- coding: utf-8 -*-
"""
Envía por WhatsApp el enlace de la app en Vercel.
1) Si hay Twilio en la Bóveda: envía el mensaje al número WHATSAPP_TO.
2) Si no: abre wa.me con el texto listo para que lo envíes tú (a ti mismo o a quien quieras).
Credenciales: Bóveda (credenciales.txt) con TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, WHATSAPP_TO.
"""
import os
import re
import sys
import urllib.parse
import webbrowser
from pathlib import Path

APP_URL = os.environ.get("RAULI_APP_URL", "https://rauli-panaderia-app.vercel.app")
APP_NAME = "RAULI - Panaderia y Dulceria"
MSG = f"Enlace app {APP_NAME} (Vercel). Abre o instala aquí: {APP_URL}"

BASE = Path(__file__).resolve().parent


def _vault_paths():
    yield os.environ.get("RAULI_VAULT", "")
    yield Path(r"C:\dev\credenciales.txt")
    yield Path(r"C:\Users\Raul\OneDrive\RAUL - Personal\Escritorio\credenciales.txt")
    yield BASE.parent / "credenciales.txt"
    yield BASE / "credenciales.txt"
    home = Path.home()
    yield home / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt"
    yield home / "Escritorio" / "credenciales.txt"
    yield home / "Desktop" / "credenciales.txt"


def _normalize_phone(num):
    """A digits-only E.164-style number; ensure leading + for country code."""
    digits = re.sub(r"\D", "", str(num))
    if not digits:
        return ""
    if not digits.startswith("34") and not digits.startswith("1"):
        digits = "34" + digits
    return digits


def load_twilio():
    sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    to_raw = os.environ.get("WHATSAPP_TO", "") or os.environ.get("TWILIO_WHATSAPP_TO", "")
    from_wa = os.environ.get("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")

    for v in _vault_paths():
        p = Path(v) if isinstance(v, str) else v
        if not p or not getattr(p, "exists", lambda: False) or not p.exists():
            continue
        try:
            for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, val = line.partition("=")
                    k, val = k.strip().upper(), val.strip().strip("'\"").strip()
                    if k == "TWILIO_ACCOUNT_SID" and val:
                        sid = sid or val
                    elif k == "TWILIO_AUTH_TOKEN" and val:
                        token = token or val
                    elif k in ("WHATSAPP_TO", "TWILIO_WHATSAPP_TO") and val:
                        to_raw = to_raw or val
                    elif k == "TWILIO_WHATSAPP_FROM" and val:
                        from_wa = val
            if sid and token and to_raw:
                to_digits = _normalize_phone(to_raw)
                if to_digits:
                    return sid, token, f"whatsapp:+{to_digits}", from_wa
        except Exception:
            pass
    return sid, token, ("whatsapp:+%" + to_raw if to_raw else ""), from_wa


def send_via_twilio():
    try:
        from twilio.rest import Client
    except ImportError:
        return False, "Instala: pip install twilio"

    sid, token, to_wa, from_wa = load_twilio()
    if not sid or not token or not to_wa or to_wa.startswith("whatsapp:+%"):
        return False, "Faltan TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN o WHATSAPP_TO en la Bóveda."

    client = Client(sid, token)
    try:
        msg = client.messages.create(from_=from_wa, to=to_wa, body=MSG)
        return True, msg.sid
    except Exception as e:
        return False, str(e)


def open_wa_me():
    url = "https://wa.me/?text=" + urllib.parse.quote(MSG)
    webbrowser.open(url)
    print("Se abrió WhatsApp con el mensaje listo. Elige tu chat (o 'Enviar a mi mismo') y pulsa Enviar.")
    return True


def main():
    ok, detail = send_via_twilio()
    if ok:
        print("WhatsApp enviado correctamente (Twilio). SID:", detail)
        return 0
    print("Twilio no disponible:", detail)
    print()
    open_wa_me()
    return 0


if __name__ == "__main__":
    sys.exit(main())
