# Solucionar 404 en Vercel

El 404 en Vercel suele deberse a que **Root Directory** no está en `frontend`. Hay dos formas de arreglarlo.

---

## Opción 1: Con token (automático)

1. **Obtener token**
   - Entra en [vercel.com/account/tokens](https://vercel.com/account/tokens)
   - Crea un token (o usa uno existente) y cópialo

2. **Pegar el token**
   - Abre `backend/.env`
   - Busca la línea: `VERCEL_TOKEN=`
   - Pega el token **justo después del =** (sin espacios):
   ```env
   VERCEL_TOKEN=tu_token_pegado_aqui
   ```
   - Guarda el archivo

3. **Ejecutar el script**
   ```bash
   python scripts/vercel_config_deploy.py
   ```
   Eso pondrá Root Directory = `frontend`, la variable `VITE_API_BASE` y disparará un deploy.

4. Espera 1–2 minutos y abre de nuevo la URL de tu proyecto en Vercel.

---

## Opción 2: Manual en el dashboard

1. Entra en [vercel.com](https://vercel.com) → tu proyecto **rauli-panaderia-app**
2. **Settings** → **General** → **Root Directory** → **Edit**
3. Escribe: `frontend` → **Save**
4. **Settings** → **Environment Variables** → añade:
   - Name: `VITE_API_BASE`
   - Value: `https://rauli-panaderia.onrender.com/api`
   - Entornos: Production, Preview, Development
5. **Deployments** → en el último deploy → **⋯** → **Redeploy**

Tras el redeploy, la app debería cargar sin 404.
