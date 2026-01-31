# Servicio completo — Vercel + Render

Para que la app funcione al 100% en producción necesitas **frontend (Vercel)** y **backend (Render)**.

---

## Estado actual

| Servicio | URL | Uso |
|----------|-----|-----|
| **Frontend** | https://rauli-panaderia-app.vercel.app | App web (login, POS, inventario, etc.) |
| **Backend** | https://rauli-panaderia.onrender.com/api | API (auth, productos, ventas, BD) |

El frontend en Vercel ya está configurado con `VITE_API_BASE` apuntando al backend en Render.

---

## 1. Vercel (frontend) — ya hecho

- Root Directory: `frontend`
- Rama producción: la que tengas (ej. `maestro` o `main`)
- Variable: `VITE_API_BASE` = `https://rauli-panaderia.onrender.com/api`

---

## 2. Render (backend) — qué revisar

1. Entra en [render.com](https://render.com) → Dashboard.
2. Busca el servicio **rauli-panaderia** (Web Service).
3. Comprueba:
   - **Root Directory:** `backend`
   - **Branch:** `maestro` (o la rama de producción)
   - **Environment:** `CORS_ORIGIN` = `https://rauli-panaderia-app.vercel.app`
4. Si el servicio no existe: **New +** → **Web Service** → Conecta el repo `mramirezraul71/rauli-panaderia` y usa la config de **render.yaml** (o pon Root Directory = `backend`, Build = `npm install`, Start = `npm start`, rama `maestro`).
5. En plan gratuito, el backend se “duerme” tras inactividad; la primera petición puede tardar ~50 s (cold start).

---

## 3. Comprobar servicio completo

```bash
python scripts/comprobar_urls.py
```

Si **Vercel** y **Render** salen OK, el servicio está completo. Si Render sale timeout, espera 1 min y vuelve a ejecutar (cold start).
