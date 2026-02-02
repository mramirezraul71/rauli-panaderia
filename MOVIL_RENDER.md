# RAULI ERP - Uso en Movil con Backend en Render

## URLs del sistema

| Componente | URL |
|------------|-----|
| **Frontend (Vercel)** | https://rauli-panaderia-app.vercel.app |
| **Backend (Render)** | https://rauli-panaderia-1.onrender.com |

---

## Pasos para usar en movil

### 1. Desplegar frontend (si aun no esta desplegado)

```powershell
cd c:\dev\RauliERP-Panaderia-RAULI
.\deploy_auto.ps1
```

O manualmente: push a la rama `maestro` para que Vercel despliegue.

### 2. Configurar Vercel (una sola vez)

En **Vercel** -> Proyecto **rauli-panaderia-app** -> Settings -> Environment Variables:

| Variable | Valor |
|----------|-------|
| `VITE_API_BASE` | `https://rauli-panaderia-1.onrender.com/api` |

Aplicar a: Production, Preview, Development.

### 3. Abrir en el movil

1. En el navegador del telefono (Chrome/Safari)
2. Entra a: **https://rauli-panaderia-app.vercel.app**
3. La app se conecta automaticamente al backend en Render

### 4. Instalar como PWA (opcional)

- **Android (Chrome):** Menu (3 puntos) -> "Anadir a pantalla de inicio"
- **iPhone (Safari):** Compartir -> "Anadir a pantalla de inicio"

La app aparecera como un icono y se abrira en pantalla completa.

### 5. Nota sobre cold start

En el plan gratuito de Render, el backend puede tardar ~1 minuto en "despertar" si lleva tiempo sin usarse. La primera carga puede ser lenta; las siguientes seran rapidas.

---

## Verificacion rapida

- Backend: https://rauli-panaderia-1.onrender.com/api/health
- Swagger: https://rauli-panaderia-1.onrender.com/docs
- Frontend: https://rauli-panaderia-app.vercel.app
