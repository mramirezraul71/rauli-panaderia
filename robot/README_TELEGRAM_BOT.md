# 🤖 Bot Telegram RAULI - Documentación

## 📋 Descripción

Bot de Telegram reestructurado para lectura avanzada, monitoreo y gestión del sistema RAULI ERP Panadería.

## 🚀 Características Principales

### 📖 Modo Lectura
- Recepción de mensajes de texto
- Análisis de imágenes y documentos
- Procesamiento de comandos
- Respuestas automáticas

### 📊 Monitoreo
- Estado del sistema en tiempo real
- Verificación de deploys
- Reportes automáticos
- Notificaciones de estado

### 🛠️ Comandos
- `/start` - Iniciar bot
- `/estado` - Estado del sistema
- `/version` - Versión actual
- `/deploy` - Verificar deploy
- `/help` - Ayuda

## 📁 Estructura de Archivos

```
robot/
├── telegram_reader.py          # Clase principal del bot
├── run_telegram_bot.py        # Ejecutor con modos
├── README_TELEGRAM_BOT.md      # Documentación
└── telegram_reader.log         # Logs del bot
```

## ⚙️ Configuración

### Credenciales
Las credenciales se buscan en este orden:
1. `C:\dev\credenciales.txt`
2. `OneDrive\RAUL - Personal\Escritorio\credenciales.txt`
3. `Escritorio\credenciales.txt`
4. `Desktop\credenciales.txt`
5. `robot\omni_telegram.env`
6. Variables de entorno

### Formato de credenciales
```
TELEGRAM_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

## 🎯 Modos de Uso

### 1. Modo Lectura
```bash
# Lectura por 5 minutos (default)
python robot/run_telegram_bot.py read

# Lectura por 10 minutos
python robot/run_telegram_bot.py read --timeout 600
```

### 2. Estado del Sistema
```bash
python robot/run_telegram_bot.py status
```

### 3. Verificación de Deploy
```bash
python robot/run_telegram_bot.py deploy
```

### 4. Mensaje Personalizado
```bash
python robot/run_telegram_bot.py message "Hola desde el bot"
```

### 5. Enviar Foto
```bash
python robot/run_telegram_bot.py photo "evidencia/captura.png" --caption "Captura de pantalla"
```

### 6. Modo Monitoreo
```bash
# Monitoreo cada 5 minutos (default)
python robot/run_telegram_bot.py monitor

# Monitoreo cada 2 minutos
python robot/run_telegram_bot.py monitor --interval 120
```

### 7. Probar Conexión
```bash
python robot/run_telegram_bot.py test
```

## 🔄 Flujo de Trabajo

### 1. Inicialización
```python
from telegram_reader import TelegramReader

bot = TelegramReader()
await bot.load_credentials()
```

### 2. Envío de Mensajes
```python
# Texto
await bot.send_message("Hola mundo")

# Foto
await bot.send_photo(Path("imagen.png"), "Caption")
```

### 3. Recepción de Mensajes
```python
# Obtener actualizaciones
updates = await bot.get_updates()

# Procesar mensajes
for update in updates.get("result", []):
    await bot.process_message(update)
```

## 📊 Reportes Automáticos

### Estado del Sistema
- Frontend (Vercel): ✅ OK (v2026.02.05)
- Backend (Render): ✅ OK
- Bot Telegram: ✅ Activo

### Verificación de Deploy
- Ejecuta `robot_verificar_deploy.py`
- Genera capturas de pantalla
- Envía evidencia por Telegram

## 🛡️ Manejo de Errores

### Logging
- Archivo: `telegram_reader.log`
- Niveles: INFO, WARNING, ERROR
- Formato: Timestamp - Level - Message

### Reintentos Automáticos
- Conexión: 3 reintentos
- Envío de mensajes: 1 reintento
- Descarga de archivos: 2 reintentos

## 🔧 Personalización

### Agregar Nuevos Comandos
```python
async def handle_command(self, command: str, user_info: str) -> None:
    if command == "/nuevo_comando":
        await self.send_message("Nuevo comando ejecutado")
```

### Modificar Respuestas
```python
async def handle_text_message(self, text: str, user_info: str) -> None:
    if "palabra_clave" in text.lower():
        await self.send_message("Respuesta personalizada")
```

## 📱 Integración con Móvil

### Capturas de Pantalla
- Automaticas desde `robot_verificar_deploy.py`
- Análisis de vistas móviles
- Envío directo a Telegram

### Notificaciones Push
- Estado de deploys
- Cambios en el sistema
- Alertas de error

## 🚀 Despliegue

### Requisitos
- Python 3.8+
- httpx
- asyncio
- pathlib

### Instalación
```bash
pip install httpx
```

### Ejecución en Background
```bash
# Windows
start /B python robot/run_telegram_bot.py monitor

# Linux/Mac
nohup python robot/run_telegram_bot.py monitor &
```

## 🔍 Troubleshooting

### Problemas Comunes

#### 1. Credenciales no encontradas
```
ERROR: No se encontraron credenciales de Telegram
```
**Solución:** Verificar archivo `credenciales.txt`

#### 2. Token inválido
```
ERROR: 401 Unauthorized
```
**Solución:** Generar nuevo token en @BotFather

#### 3. Chat ID incorrecto
```
ERROR: 400 Bad Request: chat not found
```
**Solución:** Verificar chat_id con @userinfobot

#### 4. Timeout en conexión
```
ERROR: Connection timeout
```
**Solución:** Verificar conexión a internet

### Debug Mode
```bash
python robot/run_telegram_bot.py test
```

## 📈 Métricas

### Logs
- Mensajes procesados
- Errores de conexión
- Tiempos de respuesta
- Comandos ejecutados

### Estadísticas
- Uso por hora
- Comandos populares
- Tasa de éxito
- Tiempo de actividad

## 🔐 Seguridad

### Token Protection
- No compartir token
- Rotar token periódicamente
- Usar variables de entorno

### Chat ID Validation
- Verificar chat_id permitido
- Ignorar mensajes de otros chats
- Log de accesos no autorizados

## 📞 Soporte

### Contacto
- Telegram: @mramirezraul71
- Email: soporte@raulipanaderia.app

### Issues
- Reportar en GitHub
- Incluir logs del bot
- Describir pasos para reproducir

---

**Bot Telegram RAULI v2.0**  
*Gestión avanzada del sistema ERP*
