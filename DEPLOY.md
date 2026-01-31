# Deploy RAULI Panadería — desde cero

**Repo:** `mramirezraul71/rauli-panaderia`  
**Rama de producción:** `maestro`

---

## Sistema de actualización automática + cadena (todos los proyectos)

Para que los usuarios reciban la nueva versión sin caché y el repo se actualice en GitHub con toda la cadena (Vercel, Railway, notificación), este repo incluye un **sistema estándar**. Ver **[ACTUALIZACION_AUTO.md](ACTUALIZACION_AUTO.md)**.

- **Cadena completa (recomendado):** `scripts\DEPLOY_Y_NOTIFICAR.bat` — build, push a GitHub, deploy Vercel + Railway, Telegram.
- **Solo push a GitHub:** `scripts\subir_hub_vercel_cadena.bat` — Vercel/Railway se actualizan por webhook.
- **Instalar en otro proyecto:** `scripts\INSTALAR_ACTUALIZACION.bat` o `python scripts/instalar_sistema_actualizacion.py --proyecto <ruta>`.

---

## Setup una sola vez (clon nuevo)

En un clon nuevo del repo, ejecuta **una sola vez** para crear `credenciales.txt` y `frontend/.env` desde los ejemplos (si no existen):

```bash
scripts\SETUP_UNA_VEZ.bat
```

O: `python scripts/setup_una_vez.py`

El script crea el marcador `scripts/.setup-una-vez-done`; en ejecuciones posteriores indica que ya fue aplicado. Para repetir: borra ese archivo o ejecuta con `--force`.

---

## 1. Vercel (frontend)

**Si ya tienes un proyecto con 404:** En Settings → Git, reconecta a **mramirezraul71/rauli-panaderia** y Rama = **maestro**.

1. Entra en [vercel.com](https://vercel.com) e inicia sesión con GitHub.
2. **Add New** → **Project**.
3. Importa **mramirezraul71/rauli-panaderia**.
4. Configura:
   - **Root Directory:** `frontend` ← obligatorio
   - **Framework Preset:** Vite (detectado)
   - **Production Branch:** `maestro` ← no usar main
5. Variables de entorno:
   - `VITE_API_BASE` = `https://rauli-panaderia.onrender.com/api`
6. **Deploy**.
7. Anota la URL (ej. `rauli-panaderia-xxx.vercel.app`).

---

## 2. Render (backend)

1. Entra en [render.com](https://render.com) e inicia sesión con GitHub.
2. **New +** → **Web Service**.
3. Conecta **mramirezraul71/rauli-panaderia**.
4. Usa **render.yaml** (detectado) o configura:
   - **Root Directory:** `backend`
   - **Build:** `npm install`
   - **Start:** `npm start`
   - **Branch:** `maestro`
5. Variables:
   - `CORS_ORIGIN` = URL de Vercel del paso 1
6. **Create Web Service**.

---

## 3. Conectar frontend y backend

- **Vercel** → Settings → Environment Variables → `VITE_API_BASE` = `https://rauli-panaderia.onrender.com/api`
- **Render** → Environment → `CORS_ORIGIN` = URL exacta de Vercel

---

## Configuración Vercel vía API (opcional)

Si tienes **VERCEL_TOKEN** (Account Settings → Tokens en Vercel), puedes aplicar Root Directory, env y disparar deploy sin entrar al dashboard:

```bash
# Opción 1: variable de entorno
set VERCEL_TOKEN=tu_token
python scripts/vercel_config_deploy.py

# Opción 2: en bóveda (credenciales.txt) línea: VERCEL_TOKEN=tu_token
python scripts/vercel_config_deploy.py
```

El script hace: Root Directory = `frontend`, Framework = Vite, crea `VITE_API_BASE` si falta, y dispara un deploy de la rama `maestro`.

---

## Verificar

```bash
python scripts/comprobar_urls.py
```

Actualiza `URL_VERCEL` (env o bóveda) si tu proyecto tiene otra URL (p. ej. bajo equipo).

---

## Actualización automática SIN intervención

**Push a `maestro` (o `main`)** dispara en GitHub Actions: deploy Vercel → deploy Railway → espera 2 min → comprobación de URLs. No hace falta ejecutar nada a mano.

### Configurar una sola vez en GitHub

1. Repo → **Settings** → **Secrets and variables** → **Actions**.
2. **Secrets** (obligatorios para que el workflow despliegue):
   - `VERCEL_TOKEN`: token de Vercel (Account Settings → Tokens).
   - `RAILWAY_TOKEN`: token de Railway (Account → Settings → Tokens).
3. **Variables** (opcionales; el script usa valores por defecto si faltan):
   - `URL_VERCEL`: URL del frontend (ej. `https://rauli-panaderia-app.vercel.app`).
   - `RAILWAY_PUBLIC_URL`: URL pública del backend en Railway (ej. `https://xxx.up.railway.app`).
   - `RAILWAY_PROJECT_ID`: ID del proyecto en Railway (solo si el nombre no es el por defecto).

Tras esto, cada **push a `maestro`** actualiza frontend y backend y comprueba las URLs sin tu intervención.

### Deploy y notificar (recomendado: una sola vez por actualización)

Un solo script que: **construye** el frontend (genera `version.json`), **sube** a GitHub, **despliega** en Vercel y Railway, y **envía un mensaje** por Telegram: "RAULI vX.Y.Z desplegada. Abre la app (PC o móvil)...". En **PC y móvil** la app detecta la nueva versión y muestra el aviso **"Nueva actualización disponible"**; el usuario pulsa **"Actualizar ahora"** y la app **borra caché y se actualiza sola** (sin pasos manuales).

```bash
scripts\DEPLOY_Y_NOTIFICAR.bat
```

O: `python scripts/deploy_y_notificar.py`

Opciones: `--no-git` (no hacer push), `--no-notify` (no enviar Telegram).  
Credenciales en bóveda: `VERCEL_TOKEN`, `RAILWAY_TOKEN`, `GH_TOKEN` o `GITHUB_TOKEN`, y para notificar: `OMNI_BOT_TELEGRAM_TOKEN`, `OMNI_BOT_TELEGRAM_CHAT_ID`.

---

### Actualizar TODO (Hub + Vercel + Railway + comprobación)

**Un solo comando** — push a GitHub (con token de bóveda si existe) + deploy Vercel + Railway + comprobar URLs:

```bash
scripts\ACTUALIZAR_TODO.bat
```

**Solo ejecutar actualización (sin git)** — si no quieres hacer commit/push y solo quieres disparar el deploy en Vercel y Railway:

```bash
scripts\EJECUTAR_ACTUALIZACION.bat
```

O: `python scripts/actualizar_todo.py --solo-deploy`

O con mensaje de commit:

```bash
scripts\ACTUALIZAR_TODO.bat "Mi mensaje de commit"
```

O en Python:

```bash
python scripts/actualizar_todo.py
python scripts/actualizar_todo.py "Mensaje opcional"
```

**Credenciales en la bóveda** (`credenciales.txt` o ruta en `RAULI_VAULT`):

- `GH_TOKEN` o `GITHUB_TOKEN` — para push sin pedir contraseña (crear en GitHub → Settings → Developer settings → Personal access tokens).
- `VERCEL_TOKEN` — deploy frontend (Vercel → Account Settings → Tokens).
- `RAILWAY_TOKEN` — deploy backend (Railway → Account → Settings → Tokens).

Si no hay `GH_TOKEN`, el script intenta `git push origin maestro` con las credenciales del sistema (Git Credential Manager, SSH, etc.). Si falla, añade el token a la bóveda para actualizar todo sin intervención.

---

**Otras opciones**

- **Solo push (y que GitHub Actions despliegue):** `scripts\subir_hub_vercel_cadena.bat` o `git push origin maestro`.
- **Solo deploy Vercel + Railway** (sin push): `scripts\ACTUALIZAR.bat` o `python scripts/deploy_completo.py`.
