# Solución: Vercel no se actualiza

## Diagnóstico

- **Repo**: El código está en rama `maestro` (commit reciente).
- **Vercel** podía estar desplegando desde `master` (rama antigua).
- **Causa**: Configuración de rama de producción en Vercel.

## Cambios realizados

### 1. Deploy forzado desde `maestro`
- `vercel_config_deploy.py` usa siempre `ref: "maestro"` (ya no `productionBranch` del proyecto).
- Se actualiza `productionBranch` del proyecto a `"maestro"` vía API.

### 2. Deploy directo (sin Git)
- **`scripts/vercel_deploy_directo.py`**: build local + upload de `dist` con Vercel CLI.
- No depende de webhooks ni ramas de GitHub.
- **`DEPLOY_DIRECTO_VERCEL.bat`**: ejecuta el script con doble clic.

### 3. Verificación
- **`scripts/verificar_repo_y_vercel.py`**: compara versión local vs versión desplegada en Vercel.
- **`VERIFICAR_REPO_VERCEL.bat`**: ejecuta la verificación.

### 4. Fallback en deploy normal
- Si `vercel_config_deploy.py` falla, se ejecuta automáticamente `vercel_deploy_directo.py`.

## Cómo usar

### Opción A: Deploy normal (desde Git)
```batch
ACTUALIZAR_AUTO.bat
```
O: `python scripts/deploy_y_notificar.py`

### Opción B: Deploy directo (sin depender de Git)
```batch
DEPLOY_DIRECTO_VERCEL.bat
```
O: `python scripts/vercel_deploy_directo.py`

### Verificar
```batch
VERIFICAR_REPO_VERCEL.bat
```

## Credenciales para deploy directo

Añadir en `credenciales.txt` (opcional, para evitar preguntas):

```
VERCEL_ORG_ID=team_xxxx
VERCEL_PROJECT_ID=prj_xxxx
```

Se obtienen en: Vercel Dashboard → Proyecto → Settings → General.

## GitHub Actions: deploy directo manual

1. Ir a **Actions** → **Deploy directo Vercel**.
2. **Run workflow**.
3. Configurar secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
