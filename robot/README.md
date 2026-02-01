# Robot ATLAS RAULI — rauli-panaderia

Bot de Telegram para **rauli-panaderia**: despliegues por voz, capturas y comprobación.

## Comandos

| Comando | Acción |
|--------|--------|
| `/ping`, `/start` | Responde `ATLAS RAULI :: BOT OK` |
| `/captura` | Captura `https://rauli-panaderia.onrender.com` y envía la imagen por Telegram |
| **Voz** | «Despliega la panadería», «Actualiza todo» → despliegues Vercel/Render |

## Configuración

1. **Telegram**
   - Copia `omni_telegram.env.example` → `omni_telegram.env`
   - Rellena `OMNI_BOT_TELEGRAM_TOKEN` y `OMNI_BOT_TELEGRAM_CHAT_ID`
   - No subas `omni_telegram.env` a git

2. **Entorno**
   - Python 3.10+
   - `.\setup_entorno.ps1` o `python robot_preparar_todo.py`
   - `ffmpeg.exe` en `robot/` (o PATH): `python robot_instalar_ffmpeg.py --download`
   - Ollama: `ollama pull deepseek-r1:14b`

## Activar seguimiento: audio en PC y bot Telegram

- **Audio en PC:** En la app (Centro de notificaciones) activa «Sonido al recibir notificaciones». Las notificaciones nuevas reproducirán un sonido corto.
- **Bot Telegram:** Desde la carpeta `robot`:
  1. `python activar_telegram.py` — envía mensaje de prueba y confirma que el seguimiento está activo.
  2. `run_bot_siempre.bat` (o `run_bot_siempre.ps1`) — deja el bot escuchando comandos (/ping, /captura, voz).

## Uso

```bash
cd robot

# Activar seguimiento (mensaje de prueba a Telegram)
python activar_telegram.py

# Preparar todo (pip, ffmpeg, comprobar bot)
python robot_preparar_todo.py

# Bot siempre activo (reconexión automática)
run_bot_siempre.bat

# Comprobar: captura + envío por Telegram
python comprobar_captura.py

# Solo enviar mensaje de verificación
python enviar_comprobacion_telegram.py
```

## URLs

- **Captura por defecto:** `https://rauli-panaderia.onrender.com`
- Override: variable de entorno `CAPTURA_URL`

## Estructura

```
robot/
  omni_gestor_proyectos.py   # Bot principal
  activar_telegram.py        # Activar seguimiento (mensaje prueba Telegram)
  robot_preparar_todo.py     # Instalar y comprobar
  robot_instalar_ffmpeg.py   # ffmpeg
  comprobar_captura.py       # Captura + Telegram
  enviar_comprobacion_telegram.py
  omni_telegram.env.example
  requirements-omni.txt
  run_bot_siempre.bat        # Bot siempre activo
  *.bat
  evidencia/                 # Capturas, historial
  chrome_data/               # Persistencia navegador
```
