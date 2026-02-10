# -*- coding: utf-8 -*-
"""
Telegram Reader Bot - Script reestructurado para lectura avanzada de Telegram
Capacidades: Lectura de mensajes, imágenes, comandos, y respuestas automáticas
"""
import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple, Dict, Any

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('telegram_reader.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class TelegramReader:
    """Bot de Telegram para lectura y procesamiento avanzado de mensajes"""
    
    def __init__(self):
        self.base = Path(__file__).resolve().parent.parent
        self.token = None
        self.chat_id = None
        self.offset = 0
        self.running = False
        self.last_update = 0
        
    def load_credentials(self) -> bool:
        """Carga credenciales de Telegram desde múltiples fuentes"""
        candidates = [
            Path(r"C:\dev\credenciales.txt"),
            Path.home() / "OneDrive" / "RAUL - Personal" / "Escritorio" / "credenciales.txt",
            Path.home() / "Escritorio" / "credenciales.txt",
            Path.home() / "Desktop" / "credenciales.txt",
            self.base / "robot" / "omni_telegram.env",
            self.base / "omni_telegram.env"
        ]
        
        for cred_file in candidates:
            if not cred_file.exists():
                continue
                
            try:
                content = cred_file.read_text(encoding="utf-8")
                for line in content.splitlines():
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        key, _, value = line.partition("=")
                        key = key.strip().upper()
                        value = value.strip().strip("'\"")
                        
                        if key in ("TELEGRAM_TOKEN", "OMNI_BOT_TELEGRAM_TOKEN") and value:
                            self.token = value
                        if key in ("TELEGRAM_CHAT_ID", "TELEGRAM_ADMIN_CHAT_ID", "OMNI_BOT_TELEGRAM_CHAT_ID", "OPERATOR_TELEGRAM") and value:
                            self.chat_id = value
                            
                if self.token and self.chat_id:
                    logger.info(f"Credenciales cargadas desde {cred_file}")
                    return True
                    
            except Exception as e:
                logger.error(f"Error leyendo {cred_file}: {e}")
                
        # Intentar variables de entorno
        self.token = self.token or os.environ.get("TELEGRAM_TOKEN", "")
        self.chat_id = self.chat_id or os.environ.get("TELEGRAM_CHAT_ID", "") or os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "")
        
        if self.token and self.chat_id:
            logger.info("Credenciales cargadas desde variables de entorno")
            return True
            
        logger.error("No se encontraron credenciales de Telegram")
        return False
    
    async def send_message(self, text: str, parse_mode: str = None) -> bool:
        """Envía mensaje de texto con opciones avanzadas"""
        if not self.token or not self.chat_id:
            return False
            
        try:
            import httpx
            
            payload = {
                "chat_id": self.chat_id,
                "text": text[:4000]
            }
            
            if parse_mode:
                payload["parse_mode"] = parse_mode
                
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    f"https://api.telegram.org/bot{self.token}/sendMessage",
                    json=payload
                )
                
                if response.status_code == 200:
                    logger.info(f"Mensaje enviado: {text[:50]}...")
                    return True
                else:
                    logger.error(f"Error enviando mensaje: {response.status_code}")
                    return False
                    
        except Exception as e:
            logger.error(f"Excepción enviando mensaje: {e}")
            return False
    
    async def send_photo(self, photo_path: Path, caption: str = "") -> bool:
        """Envía foto con caption y manejo mejorado de errores"""
        if not self.token or not self.chat_id or not photo_path.exists():
            return False
            
        try:
            import httpx
            
            async with httpx.AsyncClient(timeout=30) as client:
                with open(photo_path, "rb") as photo_file:
                    files = {"photo": (photo_path.name, photo_file, "image/png")}
                    data = {
                        "chat_id": self.chat_id,
                        "caption": caption[:1024]
                    }
                    
                    response = await client.post(
                        f"https://api.telegram.org/bot{self.token}/sendPhoto",
                        data=data,
                        files=files
                    )
                    
                    if response.status_code == 200:
                        logger.info(f"Foto enviada: {photo_path.name}")
                        return True
                    else:
                        logger.error(f"Error enviando foto: {response.status_code}")
                        return False
                        
        except Exception as e:
            logger.error(f"Excepción enviando foto: {e}")
            return False
    
    async def get_updates(self, timeout: int = 30) -> Optional[Dict]:
        """Obtiene actualizaciones de Telegram con manejo de offset"""
        if not self.token:
            return None
            
        try:
            import httpx
            
            params = {
                "offset": self.offset,
                "timeout": timeout,
                "allowed_updates": ["message", "photo", "document", "callback_query"]
            }
            
            async with httpx.AsyncClient(timeout=timeout + 5) as client:
                response = await client.get(
                    f"https://api.telegram.org/bot{self.token}/getUpdates",
                    params=params
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok"):
                        return data
                else:
                    logger.error(f"Error obteniendo updates: {response.status_code}")
                    
        except Exception as e:
            logger.error(f"Excepción obteniendo updates: {e}")
            
        return None
    
    async def process_message(self, message: Dict) -> None:
        """Procesa mensaje individual con análisis avanzado"""
        try:
            msg_type = message.get("message", {}).get("text", "")
            photo = message.get("message", {}).get("photo")
            document = message.get("message", {}).get("document")
            user = message.get("message", {}).get("from", {})
            
            user_info = f"@{user.get('username', 'N/A')} ({user.get('first_name', 'N/A')})"
            
            # Procesar texto
            if msg_type:
                await self.handle_text_message(msg_type, user_info)
            
            # Procesar foto
            elif photo:
                await self.handle_photo_message(photo, user_info)
            
            # Procesar documento
            elif document:
                await self.handle_document_message(document, user_info)
            
            # Actualizar offset
            update_id = message.get("update_id", 0)
            if update_id >= self.offset:
                self.offset = update_id + 1
                
        except Exception as e:
            logger.error(f"Error procesando mensaje: {e}")
    
    async def handle_text_message(self, text: str, user_info: str) -> None:
        """Maneja mensajes de texto con comandos"""
        logger.info(f"Texto de {user_info}: {text}")
        
        # Comandos especiales
        if text.startswith("/"):
            await self.handle_command(text, user_info)
        else:
            # Respuesta automática simple
            if "hola" in text.lower():
                await self.send_message(f"👋 Hola {user_info}! Soy el bot RAULI.")
            elif "estado" in text.lower():
                await self.send_status_report()
            elif "versión" in text.lower():
                await self.send_version_info()
    
    async def handle_command(self, command: str, user_info: str) -> None:
        """Maneja comandos específicos"""
        if command == "/start":
            await self.send_message(
                f"🤖 *Bot RAULI Activado*\n\n"
                f"Usuario: {user_info}\n"
                f"Comandos disponibles:\n"
                f"/estado - Estado del sistema\n"
                f"/version - Versión actual\n"
                f"/deploy - Verificar deploy\n"
                f"/help - Ayuda",
                parse_mode="Markdown"
            )
        elif command == "/estado":
            await self.send_status_report()
        elif command == "/version":
            await self.send_version_info()
        elif command == "/deploy":
            await self.check_deploy_status()
        elif command == "/help":
            await self.send_help()
        else:
            await self.send_message(f"❌ Comando desconocido: {command}")
    
    async def handle_photo_message(self, photo: Dict, user_info: str) -> None:
        """Maneja mensajes de foto con análisis"""
        logger.info(f"Foto recibida de {user_info}")
        await self.send_message(f"📸 Foto recibida de {user_info}\nAnalizando...")
        
        # Aquí podrías agregar análisis de imagen
        # Por ahora, solo confirma recepción
        await self.send_message("✅ Foto procesada correctamente")
    
    async def handle_document_message(self, document: Dict, user_info: str) -> None:
        """Maneja mensajes de documento"""
        file_name = document.get("file_name", "desconocido")
        logger.info(f"Documento recibido de {user_info}: {file_name}")
        await self.send_message(f"📄 Documento recibido: {file_name}")
    
    async def send_status_report(self) -> None:
        """Envía reporte de estado del sistema"""
        try:
            import httpx
            
            # Verificar Vercel
            vercel_status = "❌ Desconocido"
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    response = await client.get("https://rauli-panaderia-app.vercel.app/version.json")
                    if response.status_code == 200:
                        vercel_status = f"✅ OK (v{response.json().get('version', 'N/A')})"
            except:
                pass
            
            # Verificar Render
            render_status = "❌ Desconocido"
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    response = await client.get("https://rauli-panaderia-1.onrender.com/api/health")
                    if response.status_code == 200:
                        render_status = "✅ OK"
            except:
                pass
            
            report = f"""
📊 *Reporte de Estado*
🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

🌐 **Frontend (Vercel):** {vercel_status}
🔧 **Backend (Render):** {render_status}
🤖 **Bot Telegram:** ✅ Activo

📱 *URLs:*
• Frontend: https://rauli-panaderia-app.vercel.app
• Backend: https://rauli-panaderia-1.onrender.com/api
"""
            await self.send_message(report, parse_mode="Markdown")
            
        except Exception as e:
            logger.error(f"Error generando reporte: {e}")
            await self.send_message("❌ Error generando reporte de estado")
    
    async def send_version_info(self) -> None:
        """Envía información de versión"""
        try:
            import httpx
            
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get("https://rauli-panaderia-app.vercel.app/version.json")
                if response.status_code == 200:
                    version_data = response.json()
                    version_info = f"""
📦 *Información de Versión*
• Versión: {version_data.get('version', 'N/A')}
• Build: {version_data.get('build', 'N/A')}
• Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
                    await self.send_message(version_info, parse_mode="Markdown")
                else:
                    await self.send_message("❌ No se pudo obtener información de versión")
                    
        except Exception as e:
            logger.error(f"Error obteniendo versión: {e}")
            await self.send_message("❌ Error obteniendo información de versión")
    
    async def check_deploy_status(self) -> None:
        """Verifica estado del deploy"""
        await self.send_message("🔍 Verificando estado del deploy...")
        
        # Ejecutar robot de verificación
        try:
            import subprocess
            
            result = subprocess.run(
                ["python", "robot_verificar_deploy.py"],
                capture_output=True,
                text=True,
                cwd=self.base,
                timeout=60
            )
            
            if result.returncode == 0:
                await self.send_message("✅ Verificación completada")
                # Enviar capturas si existen
                evidence_dir = self.base / "evidencia"
                if evidence_dir.exists():
                    for img_file in evidence_dir.glob("*.png"):
                        await self.send_photo(img_file, "Captura de deploy")
            else:
                await self.send_message(f"❌ Error en verificación: {result.stderr}")
                
        except Exception as e:
            logger.error(f"Error ejecutando verificación: {e}")
            await self.send_message("❌ Error ejecutando verificación de deploy")
    
    async def send_help(self) -> None:
        """Envía mensaje de ayuda"""
        help_text = """
🤖 *Ayuda del Bot RAULI*

*Comandos disponibles:*
/start - Iniciar bot
/estado - Estado del sistema
/version - Versión actual
/deploy - Verificar deploy
/help - Esta ayuda

*Funcionalidades:*
• Recepción de mensajes de texto
• Análisis de imágenes
• Reportes automáticos
• Notificaciones de estado

*Para soporte adicional, contacta al administrador.*
"""
        await self.send_message(help_text, parse_mode="Markdown")
    
    async def start_polling(self) -> None:
        """Inicia el bucle de polling de Telegram"""
        if not self.load_credentials():
            logger.error("No se pudieron cargar las credenciales")
            return
        
        logger.info("Iniciando bot de Telegram...")
        await self.send_message("🤖 Bot RAULI iniciado y listo para recibir mensajes")
        
        self.running = True
        
        while self.running:
            try:
                updates = await self.get_updates(timeout=30)
                
                if updates and updates.get("result"):
                    for update in updates["result"]:
                        await self.process_message(update)
                        
                # Pequeña pausa para no sobrecargar
                await asyncio.sleep(1)
                
            except KeyboardInterrupt:
                logger.info("Deteniendo bot por interrupción del usuario")
                break
            except Exception as e:
                logger.error(f"Error en bucle de polling: {e}")
                await asyncio.sleep(5)  # Esperar antes de reintentar
        
        self.running = False
        logger.info("Bot detenido")
    
    def stop(self) -> None:
        """Detiene el bot"""
        self.running = False

async def main():
    """Función principal"""
    bot = TelegramReader()
    
    try:
        await bot.start_polling()
    except KeyboardInterrupt:
        logger.info("Interrupción recibida")
    finally:
        bot.stop()

if __name__ == "__main__":
    asyncio.run(main())
