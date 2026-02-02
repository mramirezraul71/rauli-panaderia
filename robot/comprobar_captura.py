# -*- coding: utf-8 -*-
"""Captura rauli-panaderia y envía imagen por Telegram."""
import asyncio
import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
EVIDENCIA_DIR = BASE / "evidencia"
CAPTURA = EVIDENCIA_DIR / "captura_comprobacion.png"
URL = os.environ.get("CAPTURA_URL", "https://rauli-panaderia-app.vercel.app")


def _load_telegram():
    token = chat = ""
    env = BASE / "omni_telegram.env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
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
    return token, chat


async def _captura():
    EVIDENCIA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("Instala playwright (viene con browser-use).")
        return False
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(URL, wait_until="domcontentloaded", timeout=20_000)
            await page.screenshot(path=str(CAPTURA), full_page=True)
            await browser.close()
        return CAPTURA.exists()
    except Exception as e:
        print("Error capturando:", e)
        return False


def _enviar_photo(chat_id, path, caption):
    token, _ = _load_telegram()
    if not token or not path.exists():
        return False
    try:
        import httpx
        u = f"https://api.telegram.org/bot{token}/sendPhoto"
        with open(path, "rb") as f:
            r = httpx.post(u, data={"chat_id": chat_id, "caption": caption[:1024]}, files={"photo": (path.name, f, "image/png")}, timeout=30.0)
        return r.status_code == 200
    except Exception as e:
        print("Error enviando:", e)
        return False


def main():
    print("Captura y envío por Telegram...")
    token, chat = _load_telegram()
    if not token or not chat or token == "TU_BOT_TOKEN" or chat == "TU_CHAT_ID":
        print("Configura robot/omni_telegram.env (token y chat_id).")
        return 1
    ok = asyncio.run(_captura())
    if not ok:
        print("Fallo al capturar.")
        return 1
    if _enviar_photo(chat, CAPTURA, f"Captura rauli-panaderia — {URL}"):
        print("Captura enviada a Telegram.")
        return 0
    print("Fallo al enviar.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
