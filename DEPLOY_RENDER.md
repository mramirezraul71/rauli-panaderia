# Despliegue en Render (alternativa a Vercel)

## URLs

| Servicio | URL |
|----------|-----|
| **Frontend** | https://rauli-panaderia-app.onrender.com |
| **Backend** | https://rauli-panaderia.onrender.com |

## Flujo automático

1. **Push a GitHub** (rama `main` o `master`) → Render despliega ambos servicios.
2. Sin caché problemática: cada deploy genera una nueva URL de assets.
3. Backend ya en Render; frontend ahora también.

## Primer despliegue

1. Entra a https://dashboard.render.com
2. **New** → **Blueprint**
3. Conecta el repo `mramirezraul71/rauli-panaderia`
4. Render detectará el `render.yaml` y creará:
   - `rauli-panaderia` (backend)
   - `rauli-panaderia-app` (frontend estático)
5. En el frontend, añade la variable `VITE_API_BASE` = `https://rauli-panaderia.onrender.com/api` (ya está en render.yaml)

## Actualizar

```bash
git add -A
git commit -m "Actualización"
git push origin main
```

Render desplegará automáticamente en 2–3 minutos. **El backend responde a cada push**: si cambias `backend/`, solo el backend se reconstruye; si cambias `frontend/`, solo el frontend.

## Comprobar que el backend se actualizó

Abre `https://rauli-panaderia.onrender.com/api/health` y revisa el campo `version`. Debe coincidir con `backend/package.json`.

## Comparación con Vercel

| Aspecto | Vercel | Render |
|---------|--------|--------|
| Frontend | Problemas de caché/actualización | Deploy directo desde Git |
| Backend | No | Sí (mismo proyecto) |
| Control | Menos visibilidad | Dashboard unificado |
| Coste | Free tier limitado | Free tier para estáticos |

## Nota

Puedes seguir usando Vercel si lo prefieres. Render es una opción alternativa que evita los problemas de actualización que tuviste.
