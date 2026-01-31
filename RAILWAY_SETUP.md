# Backend en Railway (alternativa a Render)

Railway permite desplegar el backend con un token y disparar deploys desde script, sin pasos manuales tras la configuración inicial.

---

## 1. Configuración única en Railway

1. Entra en [railway.com](https://railway.com) e inicia sesión (GitHub).
2. **New Project** → **Deploy from GitHub repo**.
3. Elige el repo **mramirezraul71/rauli-panaderia** (o el tuyo).
4. Railway crea un servicio. En el servicio:
   - **Settings** → **Root Directory:** `backend`
   - **Settings** → **Build Command:** `npm install` (o vacío)
   - **Settings** → **Start Command:** `npm start`
   - **Variables** → añade:
     - `CORS_ORIGIN` = `https://rauli-panaderia-app.vercel.app`
     - Las que necesite tu backend (PORT, JWT_SECRET, etc.)
5. Nombre del proyecto: déjalo como **rauli-panaderia** (o el que quieras; si cambias, define `RAILWAY_PROJECT_NAME` en el script).
6. **Account** → **Tokens** → [Create Token](https://railway.com/account/tokens) → copia el token.

---

## 2. Token en credenciales

En **C:\dev\credenciales.txt** (o en la bóveda que use el script) añade:

```env
RAILWAY_TOKEN=tu_token_pegado_aqui
```

---

## 3. URL del backend

En Railway, en el servicio → **Settings** → **Networking** → **Generate Domain**.  
Anota la URL (ej. `rauli-panaderia-production.up.railway.app`).

En **Vercel** → proyecto rauli-panaderia-app → **Settings** → **Environment Variables**:

- `VITE_API_BASE` = `https://TU_URL_RAILWAY/api`  
  (ej. `https://rauli-panaderia-production.up.railway.app/api`)

---

## 4. Disparar deploy desde script

```bash
python scripts/railway_deploy.py
```

El script usa `RAILWAY_TOKEN` y el proyecto por nombre (`rauli-panaderia` por defecto) y dispara un deploy. No hace falta abrir Railway cada vez.

---

## 5. Comprobar servicio completo

Actualiza la URL del backend en `scripts/comprobar_urls.py` si usas Railway en lugar de Render:

```python
URL_RAILWAY = "https://TU_SERVICIO.up.railway.app/api/health"
# y usa URL_RAILWAY en la comprobación
```

Luego:

```bash
python scripts/comprobar_urls.py
```
