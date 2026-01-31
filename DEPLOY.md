# Deploy RAULI Panadería — desde cero

**Repo:** `mramirezraul71/rauli-panaderia`  
**Rama de producción:** `maestro`

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

## Verificar

```bash
python scripts/comprobar_urls.py
```
