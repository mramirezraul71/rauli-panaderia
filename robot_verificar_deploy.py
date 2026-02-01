# -*- coding: utf-8 -*-
"""
Robot Verificar Deploy - Comprueba Vercel y Render, captura y envia por Telegram.

Ejecuta: python robot_verificar_deploy.py
Requiere: playwright, httpx, omni_telegram.env configurado
"""
import asyncio
import os
import sys
import time
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent
EVIDENCIA = BASE / "evidencia"
MISION_LOG = BASE / "mision_log.txt"

URL_VERCEL = "https://rauli-panaderia-app.vercel.app"
URL_RENDER = "https://rauli-panaderia.onrender.com/api/health"


def _env_candidates():
    """Bóveda: C:\\dev\\credenciales.txt primero, luego robot/omni_telegram.env."""
    yield Path(r"C:\dev\credenciales.txt")
    yield Path.home() / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt"
    yield Path.home() / "Escritorio" / "credenciales.txt"
    yield Path.home() / "Desktop" / "credenciales.txt"
    yield BASE / "robot" / "omni_telegram.env"
    yield BASE / "omni_telegram.env"


def _load_telegram():
    token = chat = ""
    for p in _env_candidates():
        if not p.exists():
            continue
        try:
            for line in p.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, v = line.partition("=")
                    v = v.strip().strip("'\"")
                    k = k.strip().upper()
                    if v and "TU_" not in v and ("OMNI_BOT_TELEGRAM_TOKEN" in k or k == "TELEGRAM_TOKEN"):
                        token = v
                    if v and "TU_" not in v and ("OMNI_BOT_TELEGRAM_CHAT_ID" in k or k == "TELEGRAM_CHAT_ID" or k == "OPERATOR_TELEGRAM"):
                        chat = v
        except Exception:
            pass
        if token and chat:
            break
    if not token:
        token = os.environ.get("OMNI_BOT_TELEGRAM_TOKEN", "") or os.environ.get("TELEGRAM_TOKEN", "")
    if not chat:
        chat = os.environ.get("OMNI_BOT_TELEGRAM_CHAT_ID", "") or os.environ.get("TELEGRAM_CHAT_ID", "")
    return token, chat


def _telegram_send(text):
    token, chat = _load_telegram()
    if not token or not chat or "TU_" in token or "TU_" in chat:
        return False
    try:
        import httpx
        r = httpx.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat, "text": text[:4000]},
            timeout=15
        )
        return r.status_code == 200
    except Exception:
        return False


def _telegram_send_photo(path, caption=""):
    token, chat = _load_telegram()
    if not token or not chat or not path.exists():
        return False
    try:
        import httpx
        with open(path, "rb") as f:
            r = httpx.post(
                f"https://api.telegram.org/bot{token}/sendPhoto",
                data={"chat_id": chat, "caption": caption[:1024]},
                files={"photo": (path.name, f, "image/png")},
                timeout=30
            )
        return r.status_code == 200
    except Exception:
        return False


def _voice_say(text):
    try:
        import pyttsx3
        e = pyttsx3.init()
        e.say(text)
        e.runAndWait()
    except Exception:
        pass


def _write_log(lines):
    MISION_LOG.write_text("\n".join(lines), encoding="utf-8")


async def _check_url_httpx(url):
    """Verifica URL con httpx. Retorna (status_code, body_snippet)."""
    try:
        import httpx
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as c:
            r = await c.get(url)
            body = (r.text or "")[:500]
            return r.status_code, body
    except Exception as e:
        return 0, str(e)[:200]


async def _captura_url(url, path, timeout=15000, headless=True):
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("Playwright no instalado. Usando chequeo HTTP basico.")
        status, _ = await _check_url_httpx(url)
        return status == 200
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=headless)
            page = await browser.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
            await asyncio.sleep(2)
            await page.screenshot(path=str(path), full_page=True)
            await browser.close()
        return path.exists()
    except Exception as e:
        err = str(e)
        if "Executable doesn't exist" in err or "playwright" in err.lower():
            print("Playwright: ejecuta 'playwright install chromium'")
            status, _ = await _check_url_httpx(url)
            return status == 200
        print("Error:", err[:80])
        return False


async def _run(headless=True):
    EVIDENCIA.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print("[Robot] Iniciando verificacion de deploy...")
    _telegram_send(f"Robot Verificar Deploy - Inicio {ts}")
    _voice_say("Robot iniciando verificacion de despliegue.")

    results = []
    capturas = []

    # Vercel
    print("[1] Comprobando Vercel...")
    p_vercel = EVIDENCIA / "vercel_frontend.png"
    ok_vercel = await _captura_url(URL_VERCEL, p_vercel, headless=headless)
    status_vercel, body_vercel = await _check_url_httpx(URL_VERCEL)
    # Solo considerar 404 cuando el HTTP status es 404 (evitar falso positivo si el body contiene "404")
    vercel_fail = status_vercel == 404 or (status_vercel != 200 and status_vercel != 0)
    if p_vercel.exists():
        capturas.append((p_vercel, "Vercel frontend"))
        results.append(f"Vercel: {'404/Error' if vercel_fail else ('OK' if status_vercel == 200 else f'HTTP {status_vercel}')}")
    else:
        results.append(f"Vercel: {'404/Error' if vercel_fail else ('OK' if status_vercel == 200 else f'HTTP {status_vercel}')}")

    # Render
    print("[2] Comprobando Render...")
    p_render = EVIDENCIA / "render_backend.png"
    ok_render = await _captura_url(URL_RENDER, p_render, timeout=30000, headless=headless)
    status_render, body_render = await _check_url_httpx(URL_RENDER)
    if p_render.exists():
        capturas.append((p_render, "Render backend"))
        render_ok = "\"status\":\"ok\"" in body_render or "\"status\": \"ok\"" in body_render
        results.append(f"Render: {'OK' if render_ok else ('HTTP '+str(status_render) if status_render else 'Revisar')}")
    else:
        render_ok = "\"status\":\"ok\"" in body_render or "\"status\": \"ok\"" in body_render
        results.append(f"Render: {'OK' if render_ok else ('HTTP '+str(status_render) if status_render else 'Fallo/Timeout')}")

    # Log
    log_lines = [
        "=" * 50,
        f"Verificacion Deploy - {ts}",
        "=" * 50,
        *results,
        "",
        f"Capturas: {[c[1] for c in capturas]}",
        "=" * 50
    ]
    _write_log(log_lines)
    print("\n".join(log_lines))

    # Telegram
    res_txt = "\n".join(results)
    _telegram_send(f"Robot Verificar Deploy - Fin\n{res_txt}")
    for path, nombre in capturas:
        if path.exists():
            _telegram_send_photo(path, f"{nombre} - {res_txt}")

    _voice_say("Verificacion completada. Revisa Telegram.")
    print("[Robot] Listo. Revisa evidencia/ y Telegram.")


def main():
    args = [a.lower() for a in sys.argv[1:]]
    headless = "--show" not in args
    watch = "--watch" in args
    interval = 120
    if watch:
        print("[Robot] Modo vigilancia: verificando cada 2 minutos hasta OK.")
        while True:
            asyncio.run(_run(headless=headless))
            # Leer último log para decidir si OK
            last = MISION_LOG.read_text(encoding="utf-8") if MISION_LOG.exists() else ""
            ok = ("Vercel: OK" in last) and ("Render: OK" in last)
            if ok:
                _telegram_send("✅ Deploy OK. Página y backend responden. Fin de vigilancia.")
                _voice_say("Deploy verificado. Todo OK.")
                return 0
            _telegram_send("⚠️ Aún falla el deploy. Reintentando en 2 minutos.")
            time.sleep(interval)
    else:
        asyncio.run(_run(headless=headless))
    return 0


if __name__ == "__main__":
    sys.exit(main())
