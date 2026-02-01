# Flujo Robot + Evidencia (RauliERP-Panaderia)

## Telegram

Copia `robot/omni_telegram.env.example` a `omni_telegram.env` en la raíz (o desde RauliERP si ya lo tienes).
Rellena:
- OMNI_BOT_TELEGRAM_TOKEN
- OMNI_BOT_TELEGRAM_CHAT_ID

Puedes copiar `omni_telegram.env` desde RauliERP si ya lo tienes configurado.

## Proceso

1. **Asignar tarea** → `mision_pendiente.txt`
2. **Robot ejecuta** → Desde RauliERP: `python robot_ultimate.py -m` (comparte evidencia)
3. **Verificación** → Usuario dice "verifica evidencia" → IA muestra capturas aquí

## Evidencia

- `evidencia/verificacion_final.png` o `captura_final_pagina.png`
- `evidencia/DEBUG_ERROR_CONSOLA.png`
- `mision_log.txt`
