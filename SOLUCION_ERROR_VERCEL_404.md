# Solución Error 404 Vercel — rauli-panaderia-app

## Pasos en Vercel (obligatorios)

### 1. Conectar el repo correcto

El proyecto debe estar conectado a un repo que tenga esta estructura:

```
frontend/
  package.json
  vite.config.js
  src/
  index.html
  vercel.json
```

Si Vercel está conectado a **mramirezraul71/rauli-panaderia-app** y ese repo no tiene la carpeta `frontend/`:

- Opción A: Conectar Vercel a **RauliERP-Panaderia-RAULI** (o el repo que sí tenga el código).
- Opción B: Hacer push del contenido de este proyecto al repo rauli-panaderia-app.

### 2. Configuración del proyecto

**Vercel** → tu proyecto → **Configuración** → **General**:

| Campo | Valor |
|-------|-------|
| **Directorio raíz** | `frontend` **o** vacío (`.`) |

**Si usas Directorio raíz = `frontend`:**

- Se usa `frontend/vercel.json`
- Build: `npm run build`
- Output: `dist`

**Si usas Directorio raíz = vacío:**

- Se usa `vercel.json` en la raíz
- Build: `npm run build` (ejecuta el script del package.json raíz)
- Output: `frontend/dist`

### 3. Anulaciones (Overrides)

En **Configuración** → **Compilación y desarrollo**:

- Desactiva las anulaciones de **Comando de construcción** y **Directorio de salida** para que se usen los valores de `vercel.json`.
- O asegúrate de que coincidan: Build = `npm run build`, Output = `dist` (si Root = frontend) o `frontend/dist` (si Root = vacío).

### 4. Redesplegar

1. **Despliegues** → menú (⋮) del último despliegue
2. **Redesplegar**
3. Esperar a que termine el build
4. Abrir la URL de producción

---

## Checklist rápido

- [ ] Repo conectado tiene la carpeta `frontend/` con el código
- [ ] Directorio raíz = `frontend` o vacío
- [ ] Sin anulaciones que contradigan `vercel.json`, o que coincidan
- [ ] Variable `VITE_API_BASE` = `https://rauli-panaderia.onrender.com/api`
- [ ] Redeploy hecho tras los cambios

---

## Si sigue el 404

1. **Inspeccionar la implementación** → pestaña **Build Logs**: ver si el build terminó bien y si se generó `dist/`.
2. **Output Files**: revisar que exista `index.html` en la salida.
3. **Protección de despliegue**: comprobar que no haya restricciones que bloqueen el acceso público.
