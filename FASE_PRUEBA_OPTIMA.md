# Rauli Panadería — App optimizada para fase de prueba

## Estado actual

- **Versión:** 2026.02.02
- **API:** https://rauli-panaderia-1.onrender.com (producción)
- **R8:** Activado (código optimizado, menor tamaño)
- **Mapping:** Generado para desofuscación en Play Console

## Archivos listos para subir

| Archivo | Ubicación | Uso |
|---------|-----------|-----|
| RauliERP-Panaderia-2026.02.02-release.aab | Raíz proyecto | Subir en Play Console |
| mapping-2026.02.02.txt | Raíz proyecto | Subir en detalles de versión → Desofuscación |
| testers_play.csv | Raíz proyecto | Subir en Crear lista → Subir archivo CSV |

## Testers configurados

- lisetmoralesl83@gmail.com
- mramirezraul71@gmail.com

(Para añadir más: edita `config/android_testers.txt` y ejecuta `.\scripts\generar_testers_csv.ps1`)

## Flujo para futuras actualizaciones

```powershell
# 1. Añade correos en config/android_testers.txt
# 2. Ejecuta:
.\scripts\publicar_internal_testing.ps1
# 3. Sube AAB, mapping y testers en Play Console
```

## Optimizaciones aplicadas

- API apuntando a Render producción
- Build de producción (minificación, tree-shaking)
- R8 para Android (ofuscación + reducción de tamaño)
- HTTPS scheme para contexto seguro (IndexedDB, etc.)
- ProGuard rules para Capacitor/WebView
