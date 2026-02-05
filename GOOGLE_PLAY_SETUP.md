# Google Play — Configuración y permisos

## Error "Se ha producido un error inesperado" (6BDCB5CA)

Es un error temporal de Google. Soluciones:
1. **Espera 5–15 minutos** y vuelve a intentar
2. **Modo incógnito** (Ctrl+Shift+N en Chrome)
3. **Limpiar caché** del navegador
4. **Cerrar sesión** y volver a entrar en Play Console
5. Si persiste: [Ayuda de Play Console](https://support.google.com/googleplay/android-developer/gethelp)

---

## Proceso rápido (un clic)

```batch
PUBLICAR_ANDROID.bat
```

Genera AAB, mapping, testers y abre Play Console + carpeta de archivos.

---

## Permisos necesarios para publicación manual

| Permiso | Dónde | Uso |
|---------|-------|-----|
| Cuenta desarrollador | play.google.com/console | Publicar apps |
| Administrador de la app | Play Console → Usuarios | Crear versiones, subir AAB |
| Teléfono verificado | Cuenta desarrollador | Obligatorio para publicar |

---

## Publicación automática (API)

Para subir AAB sin abrir el navegador:

### 1. Cuenta de servicio en Google Cloud

1. [Google Cloud Console](https://console.cloud.google.com) → tu proyecto (o crea uno)
2. **IAM y administración** → **Cuentas de servicio** → **Crear cuenta**
3. Nombre: `play-publisher`
4. Crear clave JSON → descargar
5. Guardar el JSON en un lugar seguro (ej. `C:\dev\play-service-account.json`)

### 2. Vincular con Play Console

1. Play Console → **Configuración** (engranaje) → **Acceso a la API**
2. Vincular el proyecto de Google Cloud
3. Conceder acceso a la **cuenta de servicio**: **Administrador** o al menos **Publicar en producción**

### 3. Credenciales

En `credenciales.txt`:

```
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=C:/dev/play-service-account.json
```

### 4. Dependencias

```bash
pip install google-auth google-api-python-client
```

### 5. Uso

```bash
python scripts/subir_play_api.py
```

---

## Capacidades recomendadas en Play Console

| Función | Ubicación | Beneficio |
|---------|-----------|-----------|
| **App Signing de Play** | Configuración → Integridad de la app | Google gestiona la clave, rotaciones seguras |
| **Internal testing** | Pruebas → Prueba interna | Pruebas sin revisión previa |
| **Staged rollout** | Producción → Lanzamiento gradual | Lanzar a % de usuarios |
| **Pre-launch report** | Pruebas → Informe previo al lanzamiento | Detección de problemas |
| **Android Vitals** | Monitorizar y mejorar | Fallos y ANR |

---

## Actualizaciones rápidas

1. **versionCode** en `build.gradle`: incrementar en cada subida (ej. 20260202 → 20260203)
2. **scripts/bump_version.py**: actualiza versión en todos los archivos
3. **Internal testing**: publicación casi inmediata sin revisión manual
