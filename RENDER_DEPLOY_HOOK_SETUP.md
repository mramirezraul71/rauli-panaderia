# Configurar Deploy Hook de Render

## Problema
**"Ninguna actualización ha corrido con Render"** — Render no redesplegaba al hacer push a GitHub.

## Solución
Añadir el **Deploy Hook** de Render para que `deploy_auto.ps1` lo dispare tras cada push.

---

## Pasos

### 1. Obtener la URL del Deploy Hook
1. Entra a https://dashboard.render.com
2. Abre el servicio **rauli-panaderia-1** (o el que tengas como backend)
3. **Settings** → **Deploy Hook**
4. Copia la URL (ej: `https://api.render.com/deploy/srv-xxxxxxxxxx?key=yyyyyyyy`)

### 2. Añadir a credenciales
En **C:\dev\credenciales.txt** (o tu bóveda):

```
RENDER_DEPLOY_HOOK=https://api.render.com/deploy/srv-xxx?key=yyy
```

### 3. Probar
Ejecuta:
```powershell
.\deploy_auto.ps1
```

Tras el `git push`, el script llamará al Deploy Hook y Render iniciará un nuevo deploy.

---

## Conexión GitHub (alternativa)
Si Render está conectado al repo de GitHub, los push ya deberían disparar deploys. Verifica:
- Render → Servicio → **Settings** → **Build & Deploy**
- **Branch** debe ser `maestro` o `main` (la que uses)
- Si pusheas a `maestro` pero Render vigila `main`, no redesplegará

El Deploy Hook es un **refuerzo** para forzar deploy cuando haces push.
