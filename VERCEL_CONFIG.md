# Configuración Vercel — RAULI Panadería

## Obligatorio en el dashboard

Si la URL del frontend devuelve 404 o "Content not found", revisa en Vercel → tu proyecto **rauli-panaderia-app**:

| Setting | Valor |
|--------|--------|
| **Root Directory** | `frontend` |
| **Production Branch** | `maestro` |
| **Framework** | Vite (o dejar auto) |
| **Environment Variable** | `VITE_API_BASE` = `https://rauli-panaderia.onrender.com/api` |

1. **Settings** → **General** → **Root Directory** → Edit → `frontend` → Save  
2. **Settings** → **Git** → **Production Branch** → `maestro`  
3. **Settings** → **Environment Variables** → Add: `VITE_API_BASE`, value `https://rauli-panaderia.onrender.com/api`, entornos Production / Preview / Development  
4. **Deployments** → último deploy → **⋯** → **Redeploy** (o hacer push a `maestro`)

## Vía API (con token)

Con **VERCEL_TOKEN** (Account → Settings → Tokens):

```bash
set VERCEL_TOKEN=tu_token
python scripts/vercel_config_deploy.py
```

El script aplica Root Directory, framework, `VITE_API_BASE` y dispara un deploy de `maestro`.

## Verificación

```bash
python scripts/comprobar_urls.py
```

Si tu proyecto tiene otra URL (p. ej. bajo equipo), edita `URL_VERCEL` en `scripts/comprobar_urls.py`.
