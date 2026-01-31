# Servicio completo — Vercel + Backend (Render o Railway)

Para que la app funcione al 100% en producción necesitas **frontend (Vercel)** y **backend** (Render o **Railway**).

---

## Estado actual

| Servicio | URL | Uso |
|----------|-----|-----|
| **Frontend** | https://rauli-panaderia-app.vercel.app | App web (login, POS, inventario, etc.) |
| **Backend** | Render o Railway | API (auth, productos, ventas, BD) |

- **Render:** https://rauli-panaderia.onrender.com/api (cold start ~1 min en plan free).
- **Railway (recomendado):** deploy con `python scripts/railway_deploy.py` si tienes `RAILWAY_TOKEN` en credenciales. Ver **RAILWAY_SETUP.md**.

---

## 1. Vercel (frontend) — ya hecho

- Root Directory: `frontend`
- Rama producción: la que tengas (ej. `maestro` o `main`)
- Variable: `VITE_API_BASE` = `https://rauli-panaderia.onrender.com/api`

---

## 2. Backend: Render o Railway

### Opción A — Railway (recomendada, deploy por script)

1. Configuración única: **RAILWAY_SETUP.md**
2. Añade `RAILWAY_TOKEN` en C:\dev\credenciales.txt
3. Deploy: `python scripts/railway_deploy.py`
4. En Vercel, `VITE_API_BASE` = URL de tu servicio Railway (ej. `https://xxx.up.railway.app/api`)

### Opción B — Render

1. Entra en [render.com](https://render.com) → Dashboard.
2. Busca el servicio **rauli-panaderia** (Web Service).
3. Comprueba: **Root Directory** = `backend`, **Branch** = `maestro`, **CORS_ORIGIN** = `https://rauli-panaderia-app.vercel.app`
4. Si no existe: **New +** → **Web Service** → Conecta el repo y usa **render.yaml**.
5. Plan free: cold start ~50 s.

---

## 3. Comprobar servicio completo

```bash
python scripts/comprobar_urls.py
```

Si **Vercel** y **Render** salen OK, el servicio está completo. Si Render sale timeout, espera 1 min y vuelve a ejecutar (cold start).
