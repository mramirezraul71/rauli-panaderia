# Estructura RAULI — atributos que no se deben perder

Documento de referencia para mantener intacta la arquitectura del proyecto.

---

## 1. Frontend (Vercel)

| Atributo | Valor |
|----------|--------|
| **URL** | `https://rauli-panaderia-app.vercel.app` (o la asignada por Vercel) |
| **Root Directory** | `frontend` (obligatorio en el proyecto Vercel) |
| **Rama** | `maestro` |
| **Build** | `npm run build` (Vite) |
| **Config** | `frontend/vercel.json` (rewrites a index.html, headers Cache-Control) |
| **Variables** | `VITE_API_BASE` = `https://rauli-panaderia.onrender.com/api` |

- **Actualización automática:** `frontend/public/version.json` + `VersionChecker.jsx` + Centro de notificaciones con "Actualizar ahora".
- **Audio PC (seguimiento):** Centro de notificaciones → "Sonido al recibir notificaciones (PC)" + botón "Probar sonido de seguimiento". Beep WAV generado en `NotificationCenter.jsx`.

---

## 2. Backend (Render)

| Atributo | Valor |
|----------|--------|
| **URL** | `https://rauli-panaderia.onrender.com` |
| **Health** | `GET /api/health` → `{ "status": "ok", ... }` |
| **Root Directory** | `backend` |
| **Start** | `npm start` |
| **Rama** | `maestro` |
| **Config** | `render.yaml` |
| **Variables** | `CORS_ORIGIN` = URL del frontend Vercel, `PORT` = 3001 |

- **Ruta raíz:** `GET /` responde 200 con mensaje y enlace a `/api/health` (evita 404 en raíz).

---

## 3. Robot (Telegram + voz en PC)

| Atributo | Ubicación / Uso |
|----------|------------------|
| **Bot principal** | `robot/omni_gestor_proyectos.py` — comandos `/ping`, `/start`, `/captura`, voz para despliegues |
| **Activar seguimiento** | `robot/activar_telegram.py` — envía mensaje de prueba a Telegram |
| **Verificar deploy** | `robot_verificar_deploy.py` (raíz) — comprueba Vercel + Render, capturas, Telegram + voz PC |
| **Credenciales Telegram** | `robot/omni_telegram.env` (OMNI_BOT_TELEGRAM_TOKEN, OMNI_BOT_TELEGRAM_CHAT_ID) o **Bóveda** |
| **Voz en PC** | `_voice_say()` con `pyttsx3` en robot_verificar_deploy y omni_gestor_proyectos |

- **Bóveda:** `telegram_robot.py`, `activar_telegram.py`, `omni_gestor_proyectos.py` y `robot_verificar_deploy.py` cargan token/chat desde: `robot/omni_telegram.env`, raíz `omni_telegram.env`, `C:\Users\Raul\OneDrive\RAUL - Personal\Escritorio\credenciales.txt`, `C:\dev\credenciales.txt`, Escritorio/Desktop.
- **Ejecución bot:** `robot/run_bot_siempre.bat` o `run_bot_siempre.ps1`.

---

## 4. Audio en PC (resumen)

- **En la app (frontend):** Centro de notificaciones → sonido al recibir notificación nueva + "Probar sonido de seguimiento". Clave `support_notification_sound` en localStorage.
- **En el robot:** `pyttsx3` en `robot_verificar_deploy.py` (_voice_say) y en `omni_gestor_proyectos.py` (_voice_say) para anuncios por voz.

---

## 5. URLs de referencia

- Frontend: `URL_VERCEL` en `robot_verificar_deploy.py` (y scripts de deploy).
- Backend: `URL_RENDER` = `https://rauli-panaderia.onrender.com/api/health` para health check.
- Repo: `mramirezraul71/rauli-panaderia`, rama `maestro`.

---

## 6. Documentos relacionados

- Deploy completo: **DEPLOY.md**
- Actualización automática: **ACTUALIZACION_AUTO.md**
- Robot Telegram: **robot/README.md**
