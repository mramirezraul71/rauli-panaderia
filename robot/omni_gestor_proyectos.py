# -*- coding: utf-8 -*-
"""
omni_gestor_proyectos.py — Gestor por voz (Telegram). Incorporado en rauli-panaderia.

- /ping, /start → ATLAS RAULI :: BOT OK
- /captura → captura rauli-panaderia-app.vercel.app y envía imagen por Telegram
- Voz: «Despliega la panadería», «Actualiza todo» → despliegues Vercel/Render

Requisitos: .\\setup_entorno.ps1, ffmpeg, ollama deepseek-r1:14b, omni_telegram.env
Uso: python omni_gestor_proyectos.py  o  run_bot_siempre.bat
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parent
CHROME_DATA = BASE / "chrome_data"
DOWNLOADS_DIR = BASE / "downloads"
TRACES_DIR = BASE / "traces"
HISTORIAL_XLSX = BASE / "historial_despliegues.xlsx"
LOG_FILE = BASE / "omni_gestor.log"
AUDIO_DIR = BASE / "audio_temp"
EVIDENCIA_DIR = BASE / "evidencia"
CAPTURA_COMPROBACION = EVIDENCIA_DIR / "captura_comprobacion.png"
CAPTURA_URL = os.environ.get("CAPTURA_URL", "https://rauli-panaderia-app.vercel.app")

PROYECTOS: dict[str, dict[str, Any]] = {
    "panadería": {
        "repo": "rauli-panaderia",
        "plataforma": ["vercel", "render"],
        "vercel_project": "rauli-panaderia-app",
        "render_service": "rauli-panaderia-1",
    },
    "trading": {
        "repo": "grok-trading-bot",
        "plataforma": ["render"],
        "render_service": "grok-trading-bot",
    },
}
TODO_KEYWORDS = ("todo", "todos", "toda", "todas", "todos los proyectos", "todo el mundo")
MODEL_NAVEGADOR = "deepseek-r1:14b"
NUM_CTX = 64_000
TEMPERATURE = 0.0
WHISPER_MODEL = "base"
STEP_TIMEOUT_S = 120
LLM_TIMEOUT_S = 180


def _telegram_env_candidates():
    """C:\\dev\\credenciales.txt primero (Bóveda típica)."""
    yield Path(r"C:\dev\credenciales.txt")
    yield Path.home() / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt"
    yield Path.home() / "Escritorio" / "credenciales.txt"
    yield Path.home() / "Desktop" / "credenciales.txt"
    yield BASE / "omni_telegram.env"
    yield BASE.parent / "omni_telegram.env"


def _load_telegram_config() -> tuple[str, str]:
    token, chat = "TU_BOT_TOKEN", "TU_CHAT_ID"
    for path in _telegram_env_candidates():
        if not path.exists():
            continue
        try:
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, v = line.partition("=")
                    v = v.strip().strip("'\"")
                    k = k.strip()
                    if v and v not in ("TU_BOT_TOKEN", "TU_CHAT_ID") and k in ("OMNI_BOT_TELEGRAM_TOKEN", "TELEGRAM_TOKEN"):
                        token = v
                    if v and v not in ("TU_BOT_TOKEN", "TU_CHAT_ID") and k in ("OMNI_BOT_TELEGRAM_CHAT_ID", "TELEGRAM_CHAT_ID", "OPERATOR_TELEGRAM"):
                        chat = v
        except Exception:
            pass
        if token and chat:
            break
    if token == "TU_BOT_TOKEN":
        token = os.environ.get("OMNI_BOT_TELEGRAM_TOKEN", "") or os.environ.get("TELEGRAM_TOKEN", token)
    if chat == "TU_CHAT_ID":
        chat = os.environ.get("OMNI_BOT_TELEGRAM_CHAT_ID", "") or os.environ.get("TELEGRAM_CHAT_ID", chat)
    return token, chat


BOT_TOKEN, CHAT_ID = _load_telegram_config()


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")[:19]


_engine: Any = None


def _voice_say(text: str) -> None:
    try:
        import pyttsx3
    except ImportError:
        logging.getLogger(__name__).info("[Voz] pyttsx3 no instalado. Omitiendo: %s", text[:50])
        return
    global _engine
    try:
        if _engine is None:
            _engine = pyttsx3.init()
        _engine.say(text)
        _engine.runAndWait()
    except Exception as e:
        logging.getLogger(__name__).warning("[Voz] %s", e)


def _excel_append(proyecto: str, plataforma: str, estado: str, detalle: str) -> None:
    try:
        import openpyxl
    except ImportError:
        return
    try:
        if HISTORIAL_XLSX.exists():
            wb = openpyxl.load_workbook(HISTORIAL_XLSX)
            ws = wb.active
        else:
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.append(["Fecha", "Proyecto", "Plataforma", "Estado", "Detalle"])
        ws.append([_ts(), proyecto[:200], plataforma[:50], estado[:100], (detalle or "")[:1000]])
        wb.save(HISTORIAL_XLSX)
    except Exception as e:
        logging.getLogger(__name__).warning("[Excel] %s", e)


def _telegram_send(chat_id: str | int, text: str) -> bool:
    if BOT_TOKEN in ("TU_BOT_TOKEN", "") or not text:
        return False
    try:
        import httpx
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        r = httpx.post(url, json={"chat_id": chat_id, "text": text[:4096]}, timeout=30.0)
        return r.status_code == 200
    except Exception as e:
        logging.getLogger(__name__).warning("[Telegram] %s", e)
        return False


def _telegram_send_photo(chat_id: str | int, path: Path, caption: str = "") -> bool:
    if not path.exists() or BOT_TOKEN in ("TU_BOT_TOKEN", ""):
        return False
    try:
        import httpx
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
        with open(path, "rb") as f:
            files = {"photo": (path.name, f, "image/png")}
            data = {"chat_id": chat_id, "caption": (caption or "Captura")[:1024]}
            r = httpx.post(url, data=data, files=files, timeout=30.0)
        return r.status_code == 200
    except Exception as e:
        logging.getLogger(__name__).warning("[Telegram] %s", e)
        return False


async def _hacer_captura(url: str, path: Path) -> bool:
    EVIDENCIA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return False
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=20_000)
            await page.screenshot(path=str(path), full_page=True)
            await browser.close()
        return path.exists()
    except Exception as e:
        logging.getLogger(__name__).warning("[Captura] %s", e)
        return False


def _ensure_ffmpeg() -> None:
    import shutil
    if shutil.which("ffmpeg"):
        return
    exe = BASE / "ffmpeg.exe"
    if exe.exists():
        p = os.environ.get("PATH", "")
        os.environ["PATH"] = f"{BASE}{os.pathsep}{p}"


def _transcribir_audio(ruta_audio: Path) -> str:
    _ensure_ffmpeg()
    try:
        import whisper
    except ImportError:
        return ""
    try:
        model = whisper.load_model(WHISPER_MODEL)
        r = model.transcribe(str(ruta_audio), language="es", fp16=False)
        return (r.get("text") or "").strip()
    except Exception as e:
        logging.getLogger(__name__).warning("[Whisper] %s", e)
        return ""


def _oga_a_wav(oga_path: Path) -> Path | None:
    _ensure_ffmpeg()
    try:
        from pydub import AudioSegment
    except ImportError:
        return None
    try:
        wav_path = oga_path.with_suffix(".wav")
        seg = AudioSegment.from_ogg(str(oga_path))
        seg.export(str(wav_path), format="wav")
        return wav_path
    except Exception as e:
        logging.getLogger(__name__).warning("[pydub] %s", e)
        return None


ANDROID_KEYWORDS = ("android", "aab", "actualizar app", "generar aab", "app android", "play store")
NETWORK_KEYWORDS = ("deploy network", "desplegar proxy", "proxy cloudflare", "api robot", "configurar api")
TODO_UPDATE_KEYWORDS = ("actualizar todo", "actualizar cadena", "update all", "bump y push")


def _parsear_comando(texto: str) -> list[str]:
    t = (texto or "").lower().strip()
    if not t:
        return []
    for kw in TODO_UPDATE_KEYWORDS:
        if kw in t:
            return ["todo_update"]
    for kw in NETWORK_KEYWORDS:
        if kw in t:
            return ["network"]
    for kw in ANDROID_KEYWORDS:
        if kw in t:
            return ["android"]
    for kw in TODO_KEYWORDS:
        if kw in t:
            return list(PROYECTOS.keys())
    return [k for k in PROYECTOS if k.lower() in t]


def _patch_browser_use() -> None:
    try:
        from browser_use.browser.profile import BrowserProfile
        def _no_copy(_: Any) -> None:
            return
        BrowserProfile._copy_profile = _no_copy
    except Exception:
        pass


class _OllamaAdapter:
    def __init__(self, llm: Any) -> None:
        self._llm = llm
        self.model = getattr(llm, "model", "ollama")

    @property
    def provider(self) -> str:
        return "ollama"

    @property
    def name(self) -> str:
        return str(self.model)

    @property
    def model_name(self) -> str:
        return str(self.model)

    async def ainvoke(self, messages: list[Any], output_format: type[Any] | None = None, **kwargs: Any) -> Any:
        from browser_use.llm.views import ChatInvokeCompletion
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
        lc: list[Any] = []
        for m in messages:
            role = getattr(m, "role", "user")
            text = getattr(m, "text", None) or getattr(m, "content", "") or ""
            if role == "system":
                lc.append(SystemMessage(content=text))
            elif role == "assistant":
                lc.append(AIMessage(content=text))
            else:
                lc.append(HumanMessage(content=text))
        r = await self._llm.ainvoke(lc)
        c = getattr(r, "content", "") or ""
        if output_format is not None:
            return ChatInvokeCompletion(completion=output_format.model_validate_json(c), usage=None)
        return ChatInvokeCompletion(completion=c, usage=None)


async def _desplegar_proyecto(clave: str) -> dict[str, str]:
    info = PROYECTOS.get(clave)
    if not info:
        return {}
    repo = info["repo"]
    plataformas = info.get("plataforma") or []
    vercel_project = info.get("vercel_project") or f"{repo}-app"
    render_service = info.get("render_service") or repo
    resultado: dict[str, str] = {p: "skip" for p in plataformas}
    os.environ.setdefault("BROWSER_USE_DOWNLOADS_DIR", str(DOWNLOADS_DIR))
    os.environ.setdefault("ANONYMIZED_TELEMETRY", "false")
    os.environ.setdefault("BROWSER_USE_CLOUD_SYNC", "false")
    _patch_browser_use()
    from langchain_ollama import ChatOllama
    from browser_use import Agent, Browser
    llm = ChatOllama(model=MODEL_NAVEGADOR, num_ctx=NUM_CTX, temperature=TEMPERATURE)
    adapter = _OllamaAdapter(llm)
    browser = Browser(
        headless=False,
        user_data_dir=str(CHROME_DATA),
        downloads_path=str(DOWNLOADS_DIR),
        traces_dir=str(TRACES_DIR),
        args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        wait_between_actions=0.6,
        highlight_elements=False,
        dom_highlight_elements=False,
    )
    await browser.start()
    try:
        if "vercel" in plataformas:
            agent_v = Agent(
                task=f"En Vercel (vercel.com/dashboard), abre '{vercel_project}', Deploy/Redeploy si existe. Responde OK.",
                llm=adapter, browser=browser, use_vision=False,
                llm_timeout=LLM_TIMEOUT_S, step_timeout=STEP_TIMEOUT_S,
            )
            try:
                await asyncio.wait_for(agent_v.run(), timeout=STEP_TIMEOUT_S + 60)
                resultado["vercel"] = "ok"
                _excel_append(clave, "vercel", "ok", "Despliegue ejecutado")
            except Exception as e:
                resultado["vercel"] = "error"
                _excel_append(clave, "vercel", "error", str(e)[:500])
        if "render" in plataformas:
            agent_r = Agent(
                task=f"En Render (dashboard.render.com), abre '{render_service}', Deploy/Manual Deploy si existe. Responde OK.",
                llm=adapter, browser=browser, use_vision=False,
                llm_timeout=LLM_TIMEOUT_S, step_timeout=STEP_TIMEOUT_S,
            )
            try:
                await asyncio.wait_for(agent_r.run(), timeout=STEP_TIMEOUT_S + 60)
                resultado["render"] = "ok"
                _excel_append(clave, "render", "ok", "Despliegue ejecutado")
            except Exception as e:
                resultado["render"] = "error"
                _excel_append(clave, "render", "error", str(e)[:500])
    finally:
        try:
            close = getattr(browser, "close", None) or getattr(browser, "aclose", None)
            if close:
                r = close()
                if asyncio.iscoroutine(r):
                    await r
        except Exception:
            pass
    return resultado


async def _handle_voice(update: Any, context: Any) -> None:
    u = update
    chat_id = u.effective_chat.id if u.effective_chat else None
    if not chat_id:
        return
    await u.message.reply_text("Procesando audio…")
    voice = u.message.voice
    if not voice:
        await u.message.reply_text("No se detectó audio.")
        return
    file = await context.bot.get_file(voice.file_id)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    oga_path = AUDIO_DIR / f"voice_{chat_id}_{voice.file_unique_id}.oga"
    await file.download_to_drive(oga_path)
    wav_path = _oga_a_wav(oga_path)
    transcribe_path = wav_path if wav_path and wav_path.exists() else oga_path
    texto = _transcribir_audio(transcribe_path)
    try:
        oga_path.unlink(missing_ok=True)
        if wav_path and wav_path.exists():
            wav_path.unlink(missing_ok=True)
    except Exception:
        pass
    if not texto:
        await u.message.reply_text("No pude transcribir el audio. ¿Puedes repetir?")
        return
    await u.message.reply_text(f"📝 Entendí: «{texto[:200]}»")
    proyectos = _parsear_comando(texto)
    if not proyectos:
        await u.message.reply_text(
            "No detecté ningún proyecto. Prueba: «Despliega la panadería», «Actualiza todo»."
        )
        return
    if "todo_update" in proyectos:
        await u.message.reply_text("🔄 Actualizando todo: versión + web + Google Play…")
        _voice_say("Actualizando cadena completa con Google Play.")
        try:
            r = __import__("subprocess").run(
                [sys.executable, str(BASE.parent / "scripts" / "actualizar_cadena.py"), "--todo"],
                cwd=str(BASE.parent),
                capture_output=True,
                text=True,
                timeout=400,
            )
            ok = r.returncode == 0
            msg = (r.stdout or "").strip() or (r.stderr or "").strip() or str(r.returncode)
            await u.message.reply_text(f"{'✅' if ok else '⚠️'} Actualización: {'Éxito' if ok else 'Revisar'}\n{msg[:600]}")
            _voice_say("Cadena actualizada. Sube el AAB a Play Console." if ok else "Revisa los errores.")
        except Exception as e:
            await u.message.reply_text(f"❌ Error — {str(e)[:300]}")
            _voice_say("Error al actualizar todo.")
        return

    if "network" in proyectos:
        await u.message.reply_text("🌐 Desplegando proxy Cloudflare + configurando api_robot.txt…")
        _voice_say("Desplegando red y configurando API.")
        try:
            r = __import__("subprocess").run(
                ["node", str(BASE.parent / "deploy_network.js")],
                cwd=str(BASE.parent),
                capture_output=True,
                text=True,
                timeout=120,
            )
            ok = r.returncode == 0
            msg = (r.stdout or "").strip() or (r.stderr or "").strip() or str(r.returncode)
            await u.message.reply_text(f"{'✅' if ok else '⚠️'} Network: {'Éxito' if ok else 'Fallback aplicado'}\n{msg[:500]}")
            _voice_say("Proxy configurado. Robot puede usar la API." if ok else "Fallback directo aplicado.")
        except Exception as e:
            await u.message.reply_text(f"❌ Network: Error — {str(e)[:300]}")
            _voice_say("Error al desplegar la red.")
        return

    if "android" in proyectos:
        await u.message.reply_text("📱 Generando AAB Android…")
        _voice_say("Generando AAB para Internal testing.")
        try:
            script = BASE.parent / "scripts" / "actualizar_app_android.py"
            r = __import__("subprocess").run(
                [sys.executable, str(script)],
                cwd=str(BASE.parent),
                capture_output=True,
                text=True,
                timeout=300,
            )
            ok = r.returncode == 0
            msg = (r.stdout or "").strip() or (r.stderr or "").strip() or str(r.returncode)
            await u.message.reply_text(f"{'✅' if ok else '❌'} Android: {'Éxito' if ok else 'Error'}\n{msg[:500]}")
            _voice_say("AAB generado." if ok else "Error al generar AAB.")
        except Exception as e:
            await u.message.reply_text(f"❌ Android: Error — {str(e)[:300]}")
            _voice_say("Error al actualizar la app Android.")
        return

    await u.message.reply_text(f"🚀 Desplegando: {', '.join(proyectos)}. Te aviso al terminar.")
    resultados_proyecto: dict[str, str] = {}
    for clave in proyectos:
        _voice_say(f"Iniciando despliegue de {clave}.")
        try:
            res = await _desplegar_proyecto(clave)
            ok = all(s == "ok" for _, s in res.items() if s != "skip")
            resultados_proyecto[clave] = "Éxito" if ok else "Error"
        except Exception as e:
            resultados_proyecto[clave] = "Error"
            _excel_append(clave, "general", "error", str(e)[:500])
            logging.getLogger(__name__).exception("Despliegue %s", clave)
    _voice_say("Despliegues terminados.")
    lineas = [f"{'✅' if v == 'Éxito' else '❌'} {k}: {v}" for k, v in resultados_proyecto.items()]
    await u.message.reply_text(" | ".join(lineas) if lineas else "Sin resultados.")


def main() -> None:
    for d in (CHROME_DATA, DOWNLOADS_DIR, TRACES_DIR, AUDIO_DIR, EVIDENCIA_DIR):
        d.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.FileHandler(LOG_FILE, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )
    log = logging.getLogger(__name__)
    if BOT_TOKEN in ("TU_BOT_TOKEN", ""):
        log.error("Configura omni_telegram.env con OMNI_BOT_TELEGRAM_TOKEN.")
        sys.exit(1)
    try:
        from telegram import Update
        from telegram.ext import Application, MessageHandler, CommandHandler, filters
    except ImportError:
        log.error("Instala python-telegram-bot: pip install python-telegram-bot")
        sys.exit(1)
    import time

    async def _cmd_ping(update: Update, context: Any) -> None:
        await (update.message or update.effective_message).reply_text("ATLAS RAULI :: BOT OK")

    async def _cmd_captura(update: Update, context: Any) -> None:
        msg = update.message or update.effective_message
        if not msg:
            return
        chat_id = update.effective_chat.id if update.effective_chat else None
        if not chat_id:
            return
        await msg.reply_text("Capturando página…")
        ok = await _hacer_captura(CAPTURA_URL, CAPTURA_COMPROBACION)
        if ok:
            _telegram_send_photo(chat_id, CAPTURA_COMPROBACION, f"Captura de comprobación — {CAPTURA_URL}")
            await msg.reply_text("Captura enviada.")
        else:
            await msg.reply_text("Error al capturar la página.")

    def _build_app() -> Application:
        a = Application.builder().token(BOT_TOKEN).build()
        a.add_handler(CommandHandler("ping", _cmd_ping))
        a.add_handler(CommandHandler("start", _cmd_ping))
        a.add_handler(CommandHandler("captura", _cmd_captura))
        a.add_handler(MessageHandler(filters.VOICE, _handle_voice))
        return a

    log.info("ATLAS RAULI — /ping, /captura, voz para desplegar (rauli-panaderia).")
    while True:
        try:
            app = _build_app()
            app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)
        except Exception as e:
            log.warning("Polling terminó o error: %s. Reconectando en 10 s…", e)
            time.sleep(10)


if __name__ == "__main__":
    main()
