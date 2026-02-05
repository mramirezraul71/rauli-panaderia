# deploy_network.js — Proxy Cloudflare + configuración automática

## Uso

```bash
node deploy_network.js
```

## Requisitos

1. **Cuenta Cloudflare** y CLI configurada:
   ```bash
   npx wrangler login
   ```

2. **Node.js** en el PATH

## Qué hace el script

1. **Comprueba wrangler** (vía `npx`)
2. **Genera** `infrastructure/worker.js` (proxy inverso) y `infrastructure/wrangler.toml`
3. **Despliega** el worker en Cloudflare (`puente-rauli`)
4. **Obtiene** la URL del worker (por ejemplo `https://puente-rauli.xxx.workers.dev`)
5. **Actualiza** `frontend/.env` con `VITE_API_BASE` y `VITE_API_URL`
6. **Guarda** copia en `api_copia.txt` (formato para respaldo)

## Resultado

- El proxy está disponible en `https://puente-rauli.<tu-subdominio>.workers.dev`
- Las peticiones se reenvían a `https://rauli-panaderia-1.onrender.com`
- El frontend usa el proxy como API base

## Arquitectura

```
Frontend (Vite) → puente-rauli.workers.dev → rauli-panaderia-1.onrender.com
```

## Configuración centralizada

Todos los servicios usan `src/config/api.js`, que toma la URL de `VITE_API_BASE` en `.env`.
