# Permisos necesarios para publicar Rauli Panadería

## Resumen ejecutivo

| Nivel | Permisos | Estado |
|-------|----------|--------|
| **Manual (actual)** | Cuenta Google + Play Console | ✅ Listo |
| **Semi-automático** | Scripts + navegador | ✅ Implementado |
| **Totalmente automático** | API de Google Play | ⚙️ Requiere configuración |

---

## 1. Para publicación MANUAL (lo que tienes)

- Cuenta de desarrollador Google Play ($25)
- Teléfono verificado
- Acceso a play.google.com/console

**Proceso:** Ejecutar `PUBLICAR_ANDROID.bat` → subir archivos en Play Console.

---

## 2. Para publicación AUTOMÁTICA (API)

### Permisos que necesito que configures

1. **Google Cloud Console**
   - Proyecto vinculado a Play Console
   - Cuenta de servicio con clave JSON
   - API **Google Play Android Developer** habilitada

2. **Play Console**
   - Vincular proyecto Cloud (Configuración → Acceso a la API)
   - Dar permisos **Administrador** a la cuenta de servicio

3. **Credenciales**
   - Añadir en `credenciales.txt`:
   ```
   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=C:/ruta/al/archivo.json
   ```

### Pasos detallados

1. [Google Cloud Console](https://console.cloud.google.com) → Crear proyecto o seleccionar
2. **APIs y servicios** → **Biblioteca** → Buscar "Google Play Android Developer API" → Habilitar
3. **APIs y servicios** → **Credenciales** → **Crear credenciales** → **Cuenta de servicio**
4. Descargar clave JSON
5. Play Console → **Configuración** (⚙️) → **Acceso a la API** → Vincular proyecto
6. Añadir la cuenta de servicio como usuario con rol **Administrador**

---

## 3. Error Play Console (6BDCB5CA)

Es temporal. Acciones:
- Esperar 10–15 min
- Probar en modo incógnito
- Limpiar caché de Chrome
- [Contactar soporte](https://support.google.com/googleplay/android-developer/gethelp) si persiste

---

## 4. Comando para publicar (cuando API esté configurada)

```bash
python scripts/subir_play_api.py
```

Esto sube AAB, mapping y asigna a Internal testing sin abrir el navegador.
