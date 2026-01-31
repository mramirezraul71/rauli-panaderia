# Solución: 404 NOT_FOUND en rauli-panaderia

## Diagnóstico

- **URL afectada:** rauli-panaderia-mum6akxgh...vercel.app (y variantes)
- **Error:** `404: NOT_FOUND` (Código Vercel)
- **Causas posibles:**
  1. Repo conectado incorrecto o estructura distinta (sin carpeta `frontend`)
  2. Build vacío (Directorio raíz equivocado)
  3. URL de preview caducada — probar URL de producción

---

## Pasos para resolver

### 0. Probar la URL de producción (rápido)

La URL larga (`rauli-panaderia-mum6akxgh-...`) puede ser de preview y dar 404. Prueba primero:

- **https://rauli-panaderia-app.vercel.app**

Si tampoco funciona, sigue los pasos siguientes.

### 1. Revisar el repo conectado

El proyecto Vercel está vinculado a **mramirezraul71/rauli-panaderia-app**. Verifica:

- ¿Ese repo tiene una carpeta **`frontend`** con el código de la app?
- Si tu código está en **RauliERP-Panaderia-RAULI** (otro repo), debes:
  - Conectar Vercel a ese repo, o
  - Hacer push del contenido de `frontend/` al repo `rauli-panaderia-app`

### 2. Inspeccionar el despliegue

En Vercel → **Despliegues** → menú (⋮) → **Inspeccionar la implementación**:

- Revisa la pestaña **Build Logs**: ¿el build terminó sin errores?
- Revisa **Output**: ¿hay archivos en `dist/` (index.html, assets/)?  
  Si está vacío → el build no generó salida (Directorio raíz o estructura incorrecta).

### 3. Configuración en Vercel

En **Configuración** → **General**:

- **Directorio raíz:** `frontend` (debe existir en el repo)
- **Comando de construcción:** `npm run build`
- **Directorio de salida:** `dist`

### 4. Iniciar sesión en Vercel (si hace falta)

1. Abre **https://vercel.com/login**
2. Haz clic en **Continue with GitHub**
3. Autoriza Vercel si lo pide

### 2. Crear o reconectar el proyecto

#### Si NO tienes el proyecto en Vercel

1. En el dashboard: **Add New** → **Project**
2. Importa tu repo de GitHub (ej. `RauliERP-Panaderia-RAULI` o `rauli-panaderia`)
3. Configura:
   - **Root Directory:** `frontend` ← importante
   - **Framework Preset:** Vite (detectado automático)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Production Branch:** `master` (o `main` según tu repo)
4. **Deploy**

#### Si ya existe el proyecto

1. Entra en tu proyecto
2. **Settings** → **General** → verifica:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Pestaña **Deployments** → **Redeploy** en el último deployment

### 3. Variables de entorno (producción)

En **Settings** → **Environment Variables** añade:

| Variable       | Valor |
|----------------|-------|
| `VITE_API_BASE` | `https://rauli-panaderia.onrender.com/api` |

Después de añadirlas, haz **Redeploy**.

### 4. Verificar la URL correcta

Tras el deploy, Vercel asigna una URL. Puede ser:

- `rauli-panaderia-app.vercel.app` (si el proyecto se llama así)
- `rauli-panaderia-[tu-usuario].vercel.app`
- Otra custom si la configuraste

La URL exacta está en **Deployments** → clic en el deployment → **Visit**.

---

## CORS en Render (backend)

En Render, el backend debe permitir el origen del frontend:

1. **Render** → tu servicio `rauli-panaderia`
2. **Environment** → añade o edita:
   - `CORS_ORIGIN` = `https://rauli-panaderia-app.vercel.app` (o tu URL real de Vercel)

---

## Checklist rápido

- [ ] Iniciar sesión en Vercel
- [ ] Proyecto con Root Directory = `frontend`
- [ ] Deploy exitoso (sin errores en build)
- [ ] Variable `VITE_API_BASE` configurada
- [ ] CORS en Render apuntando a la URL de Vercel
