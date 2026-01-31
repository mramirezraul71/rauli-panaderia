Plantilla: Sistema de actualización automática + cadena (GitHub + Vercel/Railway + notificación).
Copiar a cualquier proyecto y aplicar ACTUALIZACION_AUTO.md, o ejecutar:
  python scripts/instalar_sistema_actualizacion.py

Archivos:
- write-version.js -> frontend/scripts/
- VersionChecker.jsx -> frontend/src/components/
- version.js.example -> frontend/src/config/version.js
- deploy_cadena.py -> scripts/ (build + git push + opcional Telegram)
- DEPLOY_CADENA.bat -> scripts/
