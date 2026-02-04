# RauliERP-Panaderia — Internal Testing en Google Play

## Primera vez (cualquier usuario)

1. **Crear keystore** (solo una vez):
   ```powershell
   .\scripts\crear_keystore_android.ps1
   ```
   - Crea `frontend/rauli-upload.keystore` y copia en Escritorio
   - Genera `credenciales_android_add.txt` → añade su contenido a `credenciales.txt`

2. **Requisitos:** Android Studio instalado (JAVA_HOME, Android SDK)

---

## Regenerar AAB

```powershell
.\scripts\generar_aab.ps1
```

O desde Python (usa credenciales de bóveda):
```powershell
python scripts/actualizar_app_android.py
```

O por voz al robot Telegram: «Actualizar app Android», «Generar AAB»

---

## Subir a Internal testing

1. Entra a [Google Play Console](https://play.google.com/console)
2. Crea la app o selecciona **RauliERP-Panaderia**
3. **Testing** → **Internal testing** → **Create new release**
4. Sube `RauliERP-Panaderia-{version}-release.aab` (raíz del proyecto)
5. Rellena notas de la versión → **Save** → **Review** → **Start rollout**

---

## Requisitos previos (primera vez en Play Console)

- Cuenta de desarrollador Google Play ($25 único)
- Ficha de la tienda (nombre, descripción, iconos, capturas)
- Política de privacidad (URL)
- Clasificación de contenido

---

## Keystore

- **Ubicaciones:** `frontend/rauli-upload.keystore`, `android/rauli-upload.keystore`, Escritorio
- **Credenciales:** en `credenciales.txt` (ANDROID_KEYSTORE_PASSWORD, etc.)
- **Búsqueda automática:** el script busca en Escritorio, OneDrive/Desktop, frontend/, android/

Guarda una copia segura. Sin el keystore no podrás actualizar la app en Play Store.
