# Cadena de actualizaciones — Rauli Panadería

## Versión actual: 2026.02.05

## Archivos sincronizados

| Archivo | Propósito |
|---------|-----------|
| `frontend/src/config/version.js` | APP_VERSION (build frontend) |
| `backend/version.json` | API sirve /api/version (detección actualizaciones) |
| `frontend/public/version.json` | Fallback estático |
| `frontend/index.html` | window.__APP_VERSION__ |
| `backend/main.py` | version FastAPI |
| `frontend/android/app/build.gradle` | versionCode, versionName (Play Store) |

## Actualizar toda la cadena

### Opción 1: Fecha de hoy
```bash
python scripts/bump_version.py --today
```

### Opción 2: Incrementar patch
```bash
python scripts/bump_version.py
```

### Opción 3: Un clic + push
```bash
ACTUALIZAR_CADENA.bat
```

### Opción 4: Script Python con opciones
```bash
python scripts/actualizar_cadena.py --push              # bump + git push
python scripts/actualizar_cadena.py --deploy-network    # bump + deploy proxy
python scripts/actualizar_cadena.py --push --deploy-network
```

## Flujo de despliegue

1. **Bump** → Actualiza todos los archivos
2. **git push** → Dispara:
   - **Render**: backend con nuevo version.json
   - **Vercel**: frontend con nuevo APP_VERSION
3. **Usuarios**: App detecta nueva versión vía /api/version → "Actualizar ahora"

## Origen de verdad

La API (`/api/version`) lee `backend/version.json`. El frontend compara su `APP_VERSION` contra la API. Si la API es mayor → muestra "Nueva actualización disponible".
