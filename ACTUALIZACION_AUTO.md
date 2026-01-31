# Sistema de actualización automática (todos los proyectos)

Este documento describe el **sistema estándar de actualización** para que los usuarios (PC y móvil) reciban la nueva versión sin depender de la caché del navegador. **Una vez implementado en un proyecto, no hay que volver a tocar el tema.**

---

## Qué hace el sistema

1. **En build**: se genera `public/version.json` con la versión actual (desde `src/config/version.js`).
2. **En la app**: al cargar se consulta `/version.json` al servidor. Si la versión del servidor es mayor que la del cliente, se muestra un **banner** “Nueva actualización disponible” y, si existe SupportService, una notificación en la **bandeja de notificaciones**.
3. **Gatillo manual**: el botón **“Buscar actualización”** (menú y panel ACTUALIZACIONES) dispara un escaneo al instante: letrero “Buscando actualización…”; si hay nueva versión lo comunica y permite ejecutar; si no, lo comunica también.
4. **Automático**: si pasado un tiempo se han desplegado cambios y el usuario **no** ha pulsado el botón de forma manual, saldrá de manera **automática** el mensaje de existencia de actualización en la **bandeja de notificaciones** (comprobación periódica en segundo plano, cada 10 minutos).
5. **Al pulsar “Actualizar ahora”**: se borran cachés, se desregistra el Service Worker y se recarga la página, cargando la nueva versión.

Con esto se evita el problema de “no veo los cambios en móvil” por caché.

---

## Cómo implementarlo en un proyecto nuevo

### Opción A: Desde este repo (recomendado)

Si tienes este repo (RauliERP o uno que ya tenga la plantilla):

```bash
# En la raíz del proyecto donde quieres instalar
python scripts/instalar_sistema_actualizacion.py
```

Para otro proyecto en otra ruta:

```bash
python scripts/instalar_sistema_actualizacion.py --proyecto C:\ruta\al\proyecto
```

El script:

- Copia `write-version.js` a `frontend/scripts/`
- Copia `VersionChecker.jsx` a `frontend/src/components/`
- Crea `frontend/src/config/version.js` si no existe
- Ajusta `package.json` (script `build` con `write-version.js`)
- Ajusta `main.jsx` (Service Worker con `updateViaCache: 'none'`)
- Ajusta `vercel.json` (cabeceras no-cache para `/`, `index.html`, `version.json`)

**Paso manual (una vez):** en tu `App.jsx` (o layout principal):

```jsx
import VersionChecker from "./components/VersionChecker";

// Dentro del return, por ejemplo al inicio del layout:
<VersionChecker />
```

### Opción B: Copiar la plantilla a mano

Si no tienes el script, copia desde `templates/update-system/`:

| Origen (plantilla)     | Destino (tu proyecto)              |
|------------------------|------------------------------------|
| `write-version.js`    | `frontend/scripts/`                |
| `VersionChecker.jsx`   | `frontend/src/components/`         |
| `version.js.example`   | `frontend/src/config/version.js`   |

Luego:

1. **package.json** – script de build:
   ```json
   "build": "node scripts/write-version.js && vite build"
   ```

2. **main.jsx** – registro del Service Worker:
   ```js
   navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
   ```

3. **vercel.json** – cabeceras (o equivalente en tu host):
   ```json
   "headers": [
     { "source": "/", "headers": [{ "key": "Cache-Control", "value": "no-store, no-cache, must-revalidate" }] },
     { "source": "/index.html", "headers": [{ "key": "Cache-Control", "value": "no-store, no-cache, must-revalidate" }] },
     { "source": "/version.json", "headers": [{ "key": "Cache-Control", "value": "no-store, max-age=0" }] }
   ]
   ```

4. **App** – import y `<VersionChecker />` en el layout principal.

---

## Cadena completa: actualización del repo en GitHub y toda la cadena

**Un solo comando** actualiza versión en build, sube a GitHub y dispara toda la cadena (Vercel, Railway, notificación). No hace falta tocar más este tema.

### En este repo (RauliERP)

- **Cadena completa (recomendado):** build → GitHub (push) → deploy Vercel + Railway → Telegram  
  ```bash
  scripts\DEPLOY_Y_NOTIFICAR.bat
  ```
  o `python scripts/deploy_y_notificar.py`  
  Rama: `maestro`. Incluye despliegue explícito a Vercel y Railway.

- **Solo subir a GitHub** (si ya hiciste build y quieres que la cadena se dispare por webhooks):  
  ```bash
  scripts\subir_hub_vercel_cadena.bat
  ```
  Push a `maestro`; Vercel y Railway se actualizan solos si están conectados al repo.

### En cualquier otro proyecto (plantilla)

Tras instalar el sistema (`instalar_sistema_actualizacion.py`), tendrás en `scripts/`:

- **`deploy_cadena.py`** y **`DEPLOY_CADENA.bat`**: build frontend → git add/commit/push → opcional Telegram.  
  La rama se toma de la variable de entorno `DEPLOY_BRANCH` (por defecto `main`).  
  Vercel/Railway suelen desplegar solos al detectar el push.  
  Credenciales: bóveda (`credenciales.txt`) o env: `GH_TOKEN`, `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, `URL_VERCEL` o `APP_URL`.

Uso: `python scripts/deploy_cadena.py` o `scripts\DEPLOY_CADENA.bat`.

---

## Versión y despliegue

- **Subir versión**: edita `frontend/src/config/version.js` y aumenta `APP_VERSION` (ej. `1.0.3` → `1.0.4`) antes de cada despliegue con cambios que quieras que el usuario reciba.
- **Build**: `npm run build` en `frontend` (genera `version.json` y el bundle).
- **Deploy**: usa la cadena completa (arriba): en este repo `DEPLOY_Y_NOTIFICAR.bat`; en otros `DEPLOY_CADENA.bat` o `deploy_cadena.py`.

---

## Checklist “nuevo proyecto”

- [ ] Ejecutar `python scripts/instalar_sistema_actualizacion.py` (o copiar plantilla a mano).
- [ ] Añadir `import VersionChecker` y `<VersionChecker />` en el App/layout principal.
- [ ] Tener `src/config/version.js` con `APP_VERSION`.
- [ ] Build con `node scripts/write-version.js && vite build`.
- [ ] Cabeceras no-cache para `/`, `/index.html` y `/version.json` en el host (vercel.json o equivalente).
- [ ] Service Worker (si existe) registrado con `updateViaCache: 'none'`.
- [ ] Cadena: usar `scripts/deploy_cadena.py` o `DEPLOY_CADENA.bat` (build + push + opcional Telegram); rama por `DEPLOY_BRANCH`.

Con esto el sistema de actualización automática y la cadena (repo en GitHub + Vercel/Railway + notificación) quedan implementados y no hace falta volver a tocar este tema.
