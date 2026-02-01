# Robot Verificar Deploy

Comprueba Vercel y Render, captura pantallas y envia por Telegram.

## Uso

```powershell
cd c:\dev\RauliERP-Panaderia-RAULI
python robot_verificar_deploy.py
```

O doble clic en `verificar_deploy.bat`

## Requisitos

1. **Playwright** (para capturas):
   ```powershell
   pip install playwright
   playwright install chromium
   ```

2. **omni_telegram.env** con token y chat_id (en raiz de Panaderia o en RauliERP)

## Que hace

- Abre rauli-panaderia-app.vercel.app y captura
- Abre rauli-panaderia.onrender.com/api/health y captura
- Detecta 404 u OK
- Escribe mision_log.txt
- Envia capturas y resumen por Telegram
- Anuncia por voz al inicio y fin

## URLs configuradas

- Vercel: https://rauli-panaderia-app.vercel.app
- Render: https://rauli-panaderia.onrender.com/api/health

Para cambiar, edita las constantes al inicio de robot_verificar_deploy.py
