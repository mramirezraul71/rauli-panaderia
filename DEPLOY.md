# Deploy listo (RAULI Panaderia)

## Frontend (Vercel)
1. Importa el repo en Vercel.
2. Root Directory: `frontend`
3. Build: `npm run build`
4. Output: `dist`
5. Env:
   - `VITE_API_BASE` = `https://TU_BACKEND.onrender.com` (o tu host)

## Backend (Render)
1. Importa el repo en Render.
2. Usa `render.yaml` del root.
3. Configura env:
   - `OPENAI_API_KEY`
   - `CORS_ORIGIN` = `https://TU_FRONTEND.vercel.app`

## Nota
- El backend expone `/api/ai/openai` como proxy de OpenAI.
- Health check: `/api/health`
