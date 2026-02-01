# Robot ATLAS RAULI — rauli-panaderia

Bot de Telegram para **rauli-panaderia**: despliegues por voz, capturas y comprobación.

## Comandos

| Comando | Acción |
|--------|--------|
| `/ping`, `/start` | Responde `ATLAS RAULI :: BOT OK` |
| `/captura` | Captura `https://rauli-panaderia.onrender.com` y envía la imagen por Telegram |
| **Voz** | «Despliega la panadería», «Actualiza todo» → despliegues Vercel/Render |

## Configuración

1. **Telegram (obligatorio para activar el bot)**
   - **Opción A:** En `robot/` copia `omni_telegram.env.example` → `omni_telegram.env` y rellena `OMNI_BOT_TELEGRAM_TOKEN` y `OMNI_BOT_TELEGRAM_CHAT_ID`.
   - **Opción B (Bóveda):** Pon las mismas claves en tu archivo de credenciales (p. ej. `C:\Users\Raul\OneDrive\RAUL - Personal\Escritorio\credenciales.txt` o `C:\dev\credenciales.txt`) con los nombres `OMNI_BOT_TELEGRAM_TOKEN` y `OMNI_BOT_TELEGRAM_CHAT_ID`.
   - No subas `omni_telegram.env` ni credenciales a git.

2. **Entorno**
   - Python 3.10+
   - `.\setup_entorno.ps1` o `python robot_preparar_todo.py`
   - `ffmpeg.exe` en `robot/` (o PATH): `python robot_instalar_ffmpeg.py --download`
   - Ollama: `ollama pull deepseek-r1:14b`

## Activar seguimiento: audio en PC y bot Telegram

- **Audio en PC:** En la app abre **Centro de notificaciones** (icono campana), marca «Sonido al recibir notificaciones (PC)» y pulsa **Probar sonido de seguimiento**. Las notificaciones nuevas reproducirán un beep.
- **Bot Telegram:**
  1. Configura token y chat_id (ver arriba: `robot/omni_telegram.env` o Bóveda).
  2. Desde la carpeta `robot`: `python activar_telegram.py` — debe enviar un mensaje a Telegram y mostrar «Mensaje enviado a Telegram. Seguimiento activo.» Si no, revisa que las claves estén en `omni_telegram.env` o en credenciales.txt.
  3. Para dejar el bot escuchando: `run_bot_siempre.bat` (o `run_bot_siempre.ps1`). En Telegram prueba `/ping` o `/start` → debe responder «ATLAS RAULI :: BOT OK».

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
