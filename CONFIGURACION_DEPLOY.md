# Configuración Deploy — RAULI Panadería

## URLs de producción

| Servicio | URL |
|----------|-----|
| **Frontend (Vercel)** | https://rauli-panaderia-app.vercel.app |
| **Backend (Render)** | https://rauli-panaderia.onrender.com |
| **API Health** | https://rauli-panaderia.onrender.com/api/health |

---

## Vercel (Frontend)

### Opción A: Directorio raíz = `frontend` (recomendado)

1. **Configuración** → **General** → **Directorio raíz:** `frontend`
2. Build y output se toman de `frontend/vercel.json`

### Opción B: Directorio raíz = `.` (raíz del repo)

1. **Configuración** → **General** → **Directorio raíz:** vacío
2. Se usa `vercel.json` en la raíz del repo

### Variables de entorno (Vercel)

En **Settings** → **Environment Variables**:

| Variable | Valor |
|----------|-------|
| `VITE_API_BASE` | `https://rauli-panaderia.onrender.com/api` |

### Repo conectado

El proyecto debe estar conectado al repo con la estructura:

```
repo/
  frontend/
    package.json
    vite.config.js
    src/
    index.html
    vercel.json
  backend/
  vercel.json
```

Si el repo es `mramirezraul71/rauli-panaderia-app`, debe tener la carpeta `frontend/` con el código.

---

## Render (Backend)

### Configuración

El `render.yaml` define:

- **Nombre del servicio:** `rauli-panaderia` → URL: `rauli-panaderia.onrender.com`

### Variables de entorno (Render)

En **Environment**:

| Variable | Valor |
|----------|-------|
| `CORS_ORIGIN` | `https://rauli-panaderia-app.vercel.app` |
| `NODE_ENV` | `production` |
| `OPENAI_API_KEY` | (opcional, para IA) |

Para varios orígenes (por ejemplo, producción y previews):

```
CORS_ORIGIN=https://rauli-panaderia-app.vercel.app,https://rauli-panaderia-xxx.vercel.app
```

---

## Checklist deploy

- [ ] Vercel: Root Directory = `frontend` o `.`
- [ ] Vercel: `VITE_API_BASE` configurada
- [ ] Render: `CORS_ORIGIN` = URL de Vercel
- [ ] Redeploy en ambos tras cambios de configuración
