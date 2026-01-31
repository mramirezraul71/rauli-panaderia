# Solución: ni Vercel ni Render abren

## Posibles causas

### 1. Proyectos no creados o no conectados

Hay que crear los proyectos y conectarlos al repo de GitHub.

### 2. Rama equivocada

El repo usa **master**, pero Vercel/Render pueden estar configurados para **main**.

### 3. URLs distintas

Vercel puede usar URLs como `rauli-panaderia-tu-usuario.vercel.app`.

---

## Pasos para corregir

### VERCEL (frontend)

1. Entra en **[vercel.com](https://vercel.com)** y haz login con GitHub.
2. **Add New** → **Project**.
3. Importa **mramirezraul71/rauli-panaderia**.
4. Configura:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Production Branch**: `master`
5. **Deploy**.
6. En el dashboard, copia la URL de tu proyecto (ej. `rauli-panaderia-xxx.vercel.app`).

### RENDER (backend)

1. Entra en **[render.com](https://render.com)** y haz login con GitHub.
2. **New +** → **Web Service**.
3. Conecta **mramirezraul71/rauli-panaderia**.
4. Configura:
   - **Name**: `rauli-panaderia-backend`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Branch**: `master`
5. En **Environment**, añade:
   - `CORS_ORIGIN` = URL de Vercel (la que copiaste)
6. **Create Web Service**.
7. Espera el deploy y copia la URL del backend.

### Conectar frontend y backend

1. En **Vercel** → tu proyecto → **Settings** → **Environment Variables**:
   - `VITE_API_BASE` = `https://TU-URL-RENDER.onrender.com/api`
2. En **Render** → tu servicio → **Environment**:
   - `CORS_ORIGIN` = `https://TU-URL-VERCEL.vercel.app`
3. Haz **Redeploy** en ambos si ya existían.

---

## Verificar URLs reales

Las URLs exactas aparecen en:

- **Vercel**: proyecto → pestaña **Deployments** → dominio asignado.
- **Render**: servicio → pestaña **Settings** → **URL**.

Si no existen proyectos o servicios, hay que crearlos como se indica arriba.
