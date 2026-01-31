# Deploy RAULI Panaderia

## Proyecto Vercel: rauli-panaderia-app
URL esperada: `https://rauli-panaderia-app.vercel.app`

### Frontend (Vercel)
1. Importa el repo **RauliERP-Panaderia-RAULI** en Vercel.
2. **Project Name**: rauli-panaderia (o el que usaste al crear)
3. Root Directory: `frontend`
4. Build: `npm run build`
5. Output: `dist`
6. Env:
   - `VITE_API_BASE` = `https://rauli-panaderia.onrender.com/api` (con /api al final)

### Backend (Render)
1. Importa el repo en Render.
2. Usa `render.yaml` (name: rauli-panaderia).
3. Env:
   - `OPENAI_API_KEY` (si usas IA)
   - `CORS_ORIGIN` = `https://rauli-panaderia-app.vercel.app`

### Conectar
Tras deploy: Backend CORS_ORIGIN = URL exacta del frontend en Vercel.

## Verificación antes de avisar
Ejecuta `scripts/comprobar_deploy.ps1` — comprueba build y URLs.
