# RauliERP-Panaderia — Internal Testing en Google Play

## AAB generado

**Archivo:** `RauliERP-Panaderia-2026.02.02-release.aab`  
**Ubicación:** Raíz del proyecto  
**Tamaño:** ~6.9 MB  

---

## Subir a Internal testing

1. Entra a [Google Play Console](https://play.google.com/console)
2. Crea la app o selecciona **RauliERP-Panaderia**
3. **Testing** → **Internal testing** → **Create new release**
4. Sube el archivo `RauliERP-Panaderia-2026.02.02-release.aab`
5. Rellena las notas de la versión
6. **Save** → **Review release** → **Start rollout to Internal testing**

---

## Requisitos previos (si es la primera vez)

- Cuenta de desarrollador Google Play ($25 único)
- Ficha de la tienda (nombre, descripción, iconos, capturas)
- Política de privacidad (URL)
- Clasificación de contenido

---

## Regenerar AAB

```powershell
.\scripts\generar_aab.ps1
```

O manualmente:
1. `cd frontend` → `npm run build`
2. `npx cap sync android`
3. `cd android` → `.\gradlew.bat bundleRelease` (con JAVA_HOME y local.properties)

---

## Keystore (IMPORTANTE)

- **Archivo:** `frontend/rauli-upload.keystore` (y copia en `android/`)
- **Contraseña:** rauli2026
- **Alias:** rauli

Guarda una copia segura. Sin el keystore no podrás actualizar la app en Play Store.
