# -*- coding: utf-8 -*-
"""
Envía por WhatsApp el enlace de la app en Vercel.
1) Si hay Twilio en la Bóveda: envía el mensaje al número WHATSAPP_TO.
2) Si no: abre wa.me con el texto listo para que lo envíes tú (a ti mismo o a quien quieras).
Credenciales: Bóveda con TWILIO_SID/TWILIO_ACCOUNT_SID, TWILIO_TOKEN/TWILIO_AUTH_TOKEN, WHATSAPP_FROM, WHATSAPP_TO.
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


def _format_whatsapp_num(val):
    """Asegura formato whatsapp:+XXXXXXXX."""
    val = (val or "").strip()
    if not val:
        return ""
    val = re.sub(r"\D", "", val)
    if not val:
        return ""
    if not val.startswith("1") and not val.startswith("34"):
        val = "34" + val
    return "whatsapp:+" + val


def load_twilio():
    sid = os.environ.get("TWILIO_ACCOUNT_SID", "") or os.environ.get("TWILIO_SID", "")
    token = os.environ.get("TWILIO_AUTH_TOKEN", "") or os.environ.get("TWILIO_TOKEN", "")
    to_raw = os.environ.get("WHATSAPP_TO", "") or os.environ.get("TWILIO_WHATSAPP_TO", "")
    from_wa = os.environ.get("TWILIO_WHATSAPP_FROM", "") or os.environ.get("WHATSAPP_FROM", "") or "whatsapp:+14155238886"

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
                    if k in ("TWILIO_ACCOUNT_SID", "TWILIO_SID") and val:
                        sid = sid or val
                    elif k in ("TWILIO_AUTH_TOKEN", "TWILIO_TOKEN") and val:
                        token = token or val
                    elif k in ("WHATSAPP_TO", "TWILIO_WHATSAPP_TO") and val:
                        to_raw = to_raw or val
                    elif k in ("TWILIO_WHATSAPP_FROM", "WHATSAPP_FROM") and val:
                        from_wa = val
            if sid and token and to_raw:
                to_wa = _format_whatsapp_num(to_raw)
                from_fmt = from_wa if from_wa.startswith("whatsapp:") else _format_whatsapp_num(from_wa)
                if to_wa:
                    return sid, token, to_wa, from_fmt or "whatsapp:+14155238886"
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
    try:
        webbrowser.open(url)
    except Exception:
        pass
    print()
    print("=" * 60)
    print("  COPIA ESTE ENLACE Y ÁBRELO EN EL NAVEGADOR")
    print("  (se abrirá WhatsApp con el mensaje del enlace Vercel)")
    print("=" * 60)
    print()
    print(url)
    print()
    print("=" * 60)
    return True


def main():
    ok, detail = send_via_twilio()
    if ok:
        print("WhatsApp enviado correctamente (Twilio). SID:", detail)
        return 0
    print("Twilio no disponible:", detail)
    open_wa_me()
    return 0


if __name__ == "__main__":
    sys.exit(main())
