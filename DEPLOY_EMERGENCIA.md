# RAULI-ERP: Reestructuración de Emergencia para Render

## Cambios aplicados

1. **Backend Python** (reemplaza Node en Render)
   - `backend/main.py`: Puerto dinámico `PORT` (Render asigna)
   - `backend/database.py`: PostgreSQL si `DATABASE_URL`, SQLite local (`panaderia.db`)
   - `backend/requirements.txt`: Limpio, sin pydantic-settings ni librerías Windows

2. **render.yaml**
   - Backend: `runtime: python`, `rootDir: backend`
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## PostgreSQL en Render

Si añades una base de datos PostgreSQL en Render y la vinculas al servicio, `DATABASE_URL` se inyecta automáticamente y `database.py` la usará.

## Local (sin DATABASE_URL)

Usa SQLite en `backend/data/panaderia.db`. La carpeta se crea automáticamente.

## Deploy

```bash
git add -A
git commit -m "EMERGENCIA: Backend Python para Render - database.py, requirements.txt, puerto dinámico"
git push origin main
```

## Nota

El frontend espera endpoints del API Node (auth, products, etc.). El backend Python actual tiene rutas mínimas (`/api/health`). Hay que implementar las rutas equivalentes en `backend/routes.py` o apuntar el frontend al backend Node si se mantiene.
