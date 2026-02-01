# Estructura automática Vercel

## Estado actual

- **Repo GitHub**: v1.0.7 en `maestro`, `master`, `main`
- **Vercel**: v1.0.7 desplegada
- **App**: https://rauli-panaderia-app.vercel.app

## Flujo sin contratiempos

### Tras cada arreglo

```batch
DEPLOY_ARREGLOS.bat
```

Hace: bump versión → build → push (maestro, master, main) → deploy Vercel + Railway → verificación.

### Para conectar Git y que Vercel despliegue automáticamente en cada push

1. Entra a https://vercel.com/dashboard
2. Proyecto **rauli-panaderia-app**
3. **Settings** → **Git**
4. **Connect Git Repository** → selecciona `mramirezraul71/rauli-panaderia`
5. **Production Branch**: `main` o `maestro`

Con eso, cada push a la rama de producción dispara el deploy en Vercel.

### Si Vercel deja de actualizarse

```batch
python scripts/vercel_reinscribir.py
```

Elimina el proyecto, lo crea de nuevo, configura todo. Luego ejecuta `DEPLOY_ARREGLOS.bat` para el primer deploy.

### Deploy directo (sin depender de Git)

```batch
DEPLOY_DIRECTO_VERCEL.bat
```

Build local + subida a Vercel. No usa GitHub.
