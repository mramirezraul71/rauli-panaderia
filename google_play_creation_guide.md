# 🚀 GUÍA AUTÓNOMA - CREAR APP EN GOOGLE PLAY CONSOLE

## PASO A PASO DETALLADO

### 1. INICIAR SESIÓN
**Acción**: Inicia sesión con tu cuenta de desarrollador de Google
**Detalles**: Usa tu cuenta Gmail con acceso a Google Play Console

### 2. CREAR APLICACIÓN
**Acción**: Haz clic en el botón 'Crear aplicación'
**Detalles**: Selecciona 'No, no quiero agregar una tienda de aplicaciones'

### 3. NOMBRE DE LA APP
**Acción**: Ingresa el nombre: 'RauliERP Panadería'
**Detalles**: Este será el nombre visible en Google Play

### 4. IDIOMA POR DEFECTO
**Acción**: Selecciona 'Español' como idioma principal
**Detalles**: Puedes agregar más idiomas después

### 5. APLICACIÓN O JUEGO
**Acción**: Selecciona 'Aplicación'
**Detalles**: No es un juego, es una aplicación de negocio

### 6. CATEGORÍA
**Acción**: Selecciona 'Negocios' o 'Productividad'
**Detalles**: Categoría principal de la aplicación

### 7. CONTENIDO PARA ADULTOS
**Acción**: Selecciona 'No'
**Detalles**: Es una aplicación de negocio para panaderías

### 8. MODO DE PRUEBA
**Acción**: Selecciona 'Prueba interna'
**Detalles**: Para testing con tus testers específicos

### 9. SUBIR APK
**Acción**: Haz clic en 'Subir APK de producción interna'
**Detalles**: Sube el archivo: C:\dev\RauliERP-Panaderia-RAULI\frontend\android\app\build\outputs\apk\debug\app-debug.apk

### 10. AGREGAR TESTERS
**Acción**: Agrega los correos de testers
**Detalles**: elizabethleyva1961@gmail.com, josereinaldomorales60@gmail.com

### 11. CONFIGURAR TIENDA
**Acción**: Completa la información de la tienda
**Detalles**: 
- Descripción: "Sistema ERP completo para panaderías"
- Contacto: Tu correo electrónico
- Política de privacidad: URL de tu política

### 12. CONTENIDO DE LA APP
**Acción**: Sube capturas de pantalla
**Detalles**: Mínimo 2 capturas, máximo 8
- Tamaño: 320-3840px
- Formato: PNG o JPG

### 13. ICONO DE LA APP
**Acción**: Sube el icono de 512x512px
**Detalles**: Debe ser PNG, sin transparencia

### 14. FIRMA DIGITAL
**Acción**: Genera y sube tu firma digital
**Detalles**: Usa el keystore existente o genera uno nuevo

### 15. CLASIFICACIÓN DE CONTENIDO
**Acción**: Responde el cuestionario de contenido
**Detalles**: Selecciona opciones apropiadas para app de negocio

### 16. POLITICAS Y SEGURIDAD
**Acción**: Completa las políticas de privacidad
**Detalles**: Acepta términos y condiciones

### 17. REVISIÓN FINAL
**Acción**: Revisa toda la información
**Detalles**: Asegúrate de que todos los campos estén completos

### 18. ENVIAR A REVISIÓN
**Acción**: Haz clic en 'Enviar para revisión'
**Detalles**: El proceso puede tomar 24-72 horas

## 📋 COMANDOS ÚTILES

### Ruta del APK:
```
C:\dev\RauliERP-Panaderia-RAULI\frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

### Verificar APK:
```bash
aapt dump badging app-debug.apk
```

### Instalar en dispositivo:
```bash
adb install app-debug.apk
```

## 🔍 VERIFICACIONES ANTES DE SUBIR

### Verificar APK:
```bash
aapt dump badging app-debug.apk
```

### Verificar firma:
```bash
jarsigner -verify -verbose -certs app-debug.apk
```

### Probar en emulador:
```bash
flutter run --debug
```

## ⚠️ REQUISITOS IMPORTANTES

### Antes de empezar:
- [ ] Cuenta de desarrollador Google Play ($25 USD)
- [ ] APK firmado y funcional
- [ ] Iconos y capturas de pantalla listos
- [ ] Política de privacidad creada
- [ ] Correos de testers agregados

### Durante el proceso:
- [ ] Todos los campos obligatorios completos
- [ ] Capturas de pantalla en alta resolución
- [ ] Descripción clara y concisa
- [ ] Categoría correcta seleccionada

## 📱 DATOS DE LA APP

### Información básica:
- **Nombre**: RauliERP Panadería
- **Paquete**: com.example.raulierp_panaderia
- **Versión**: 1.0.0
- **Categoría**: Negocios
- **Idioma**: Español

### Contacto:
- **Desarrollador**: Tu nombre
- **Email**: Tu correo
- **Sitio web**: (opcional)

## 🚀 PASOS SIGUIENTES

### Después del lanzamiento:
1. **Monitorear reviews y feedback**
2. **Actualizar según sugerencias**
3. **Agregar nuevas funcionalidades**
4. **Promocionar la app**

### Mantenimiento:
- Actualizar versión regularmente
- Corregir bugs rápidamente
- Mejorar rendimiento
- Agregar nuevas características

---
*Guía creada para facilitar el proceso de publicación en Google Play Console*

