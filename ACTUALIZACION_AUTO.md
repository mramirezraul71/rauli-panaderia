# Sistema de actualización automática (todos los proyectos)

Este documento describe el **sistema estándar de actualización** para que los usuarios (PC y móvil) reciban la nueva versión sin depender de la caché del navegador. **Una vez implementado en un proyecto, no hay que volver a tocar el tema.**

---

## Qué hace el sistema

1. **En build**: se genera `public/version.json` con la versión actual (desde `src/config/version.js`).
2. **En la app**: al cargar, se consulta `/version.json` al servidor. Si la versión del servidor es mayor que la del cliente, se muestra un **banner** “Nueva actualización disponible” y, si existe, una notificación en el centro de notificaciones.
3. **Al pulsar “Actualizar ahora”**: se borran cachés, se desregistra el Service Worker y se recarga la página, cargando la nueva versión.

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

## Versión y despliegue

- **Subir versión**: edita `frontend/src/config/version.js` y aumenta `APP_VERSION` (ej. `1.0.3` → `1.0.4`) antes de cada despliegue con cambios que quieras que el usuario reciba.
- **Build**: `npm run build` en `frontend` (genera `version.json` y el bundle).
- **Deploy**: sube a Vercel/Railway/etc. como siempre. Si usas el script de este repo:
  ```bash
  scripts\DEPLOY_Y_NOTIFICAR.bat
  ```
  o `python scripts/deploy_y_notificar.py` (build, git push, notificación Telegram).

---

## Checklist “nuevo proyecto”

- [ ] Ejecutar `python scripts/instalar_sistema_actualizacion.py` (o copiar plantilla a mano).
- [ ] Añadir `import VersionChecker` y `<VersionChecker />` en el App/layout principal.
- [ ] Tener `src/config/version.js` con `APP_VERSION`.
- [ ] Build con `node scripts/write-version.js && vite build`.
- [ ] Cabeceras no-cache para `/`, `/index.html` y `/version.json` en el host (vercel.json o equivalente).
- [ ] Service Worker (si existe) registrado con `updateViaCache: 'none'`.

Con esto el sistema queda implementado para ese proyecto y no hace falta volver a tocar este tema.
