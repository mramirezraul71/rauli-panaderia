# -*- coding: utf-8 -*-
"""
Ejecutor del Bot Telegram - Script mejorado para gestión del bot
Modos: lectura, envío, monitoreo, y comandos específicos
"""
import argparse
import asyncio
import logging
import sys
from pathlib import Path
from telegram_reader import TelegramReader

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('telegram_bot.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class TelegramBotManager:
    """Gestor avanzado del bot Telegram"""
    
    def __init__(self):
        self.bot = TelegramReader()
        self.base = Path(__file__).resolve().parent.parent
    
    async def start_reading_mode(self, timeout: int = 300) -> None:
        """Inicia modo lectura con timeout específico"""
        logger.info(f"Iniciando modo lectura por {timeout} segundos...")
        
        if not self.bot.load_credentials():
            logger.error("No se pudieron cargar las credenciales")
            return
        
        await self.bot.send_message("🤖 Modo lectura activado")
        
        # Configurar timeout
        start_time = asyncio.get_event_loop().time()
        
        while asyncio.get_event_loop().time() - start_time < timeout:
            try:
                updates = await self.bot.get_updates(timeout=10)
                
                if updates and updates.get("result"):
                    for update in updates["result"]:
                        await self.bot.process_message(update)
                        
                await asyncio.sleep(1)
                
            except KeyboardInterrupt:
                logger.info("Modo lectura interrumpido")
                break
            except Exception as e:
                logger.error(f"Error en modo lectura: {e}")
                await asyncio.sleep(2)
        
        await self.bot.send_message("🔚 Modo lectura finalizado")
        logger.info("Modo lectura finalizado")
    
    async def send_status_update(self) -> None:
        """Envía actualización de estado"""
        logger.info("Enviando actualización de estado...")
        
        if not self.bot.load_credentials():
            logger.error("No se pudieron cargar las credenciales")
            return
        
        await self.bot.send_status_report()
    
    async def send_deploy_verification(self) -> None:
        """Envía verificación de deploy"""
        logger.info("Ejecutando verificación de deploy...")
        
        if not self.bot.load_credentials():
            logger.error("No se pudieron cargar las credenciales")
            return
        
        await self.bot.check_deploy_status()
    
    async def send_custom_message(self, message: str) -> None:
        """Envía mensaje personalizado"""
        logger.info(f"Enviando mensaje personalizado: {message[:50]}...")
        
        if not self.bot.load_credentials():
            logger.error("No se pudieron cargar las credenciales")
            return
        
        await self.bot.send_message(message)
    
    async def send_photo_report(self, photo_path: str, caption: str = "") -> None:
        """Envía reporte con foto"""
        photo_file = Path(photo_path)
        
        if not photo_file.exists():
            logger.error(f"Foto no encontrada: {photo_path}")
            return
        
        logger.info(f"Enviando foto: {photo_file.name}")
        
        if not self.bot.load_credentials():
            logger.error("No se pudieron cargar las credenciales")
            return
        
        await self.bot.send_photo(photo_file, caption)
    
    async def start_monitoring_mode(self, interval: int = 300) -> None:
        """Inicia modo monitoreo continuo"""
        logger.info(f"Iniciando modo monitoreo cada {interval} segundos...")
        
        if not self.bot.load_credentials():
            logger.error("No se pudieron cargar las credenciales")
            return
        
        await self.bot.send_message(f"🔍 Modo monitoreo iniciado (intervalo: {interval}s)")
        
        try:
            while True:
                await self.bot.send_status_report()
                await asyncio.sleep(interval)
                
        except KeyboardInterrupt:
            logger.info("Modo monitoreo interrumpido")
            await self.bot.send_message("🔚 Modo monitoreo finalizado")
    
    async def test_connection(self) -> None:
        """Prueba la conexión con Telegram"""
        logger.info("Probando conexión con Telegram...")
        
        if not self.bot.load_credentials():
            logger.error("No se pudieron cargar las credenciales")
            return
        
        success = await self.bot.send_message("🧪 Prueba de conexión - Bot RAULI")
        
        if success:
            logger.info("Conexion exitosa")
        else:
            logger.error("Fallo la conexion")

def create_parser() -> argparse.ArgumentParser:
    """Crea el parser de argumentos"""
    parser = argparse.ArgumentParser(
        description="Bot Telegram RAULI - Gestor avanzado",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Modos de uso:
  python run_telegram_bot.py read                    # Modo lectura 5 min
  python run_telegram_bot.py read --timeout 600      # Modo lectura 10 min
  python run_telegram_bot.py status                  # Enviar estado
  python run_telegram_bot.py deploy                  # Verificar deploy
  python run_telegram_bot.py message "Hola mundo"    # Mensaje personalizado
  python run_telegram_bot.py photo "ruta/foto.png"   # Enviar foto
  python run_telegram_bot.py monitor                 # Modo monitoreo
  python run_telegram_bot.py test                    # Probar conexión
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Comandos disponibles')
    
    # Comando read
    read_parser = subparsers.add_parser('read', help='Iniciar modo lectura')
    read_parser.add_argument('--timeout', type=int, default=300, help='Timeout en segundos (default: 300)')
    
    # Comando status
    subparsers.add_parser('status', help='Enviar reporte de estado')
    
    # Comando deploy
    subparsers.add_parser('deploy', help='Verificar estado del deploy')
    
    # Comando message
    message_parser = subparsers.add_parser('message', help='Enviar mensaje personalizado')
    message_parser.add_argument('text', help='Texto del mensaje')
    
    # Comando photo
    photo_parser = subparsers.add_parser('photo', help='Enviar foto')
    photo_parser.add_argument('path', help='Ruta de la foto')
    photo_parser.add_argument('--caption', default='', help='Caption de la foto')
    
    # Comando monitor
    monitor_parser = subparsers.add_parser('monitor', help='Iniciar modo monitoreo')
    monitor_parser.add_argument('--interval', type=int, default=300, help='Intervalo en segundos (default: 300)')
    
    # Comando test
    subparsers.add_parser('test', help='Probar conexión')
    
    return parser

async def main():
    """Función principal"""
    parser = create_parser()
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    manager = TelegramBotManager()
    
    try:
        if args.command == 'read':
            await manager.start_reading_mode(args.timeout)
        elif args.command == 'status':
            await manager.send_status_update()
        elif args.command == 'deploy':
            await manager.send_deploy_verification()
        elif args.command == 'message':
            await manager.send_custom_message(args.text)
        elif args.command == 'photo':
            await manager.send_photo_report(args.path, args.caption)
        elif args.command == 'monitor':
            await manager.start_monitoring_mode(args.interval)
        elif args.command == 'test':
            await manager.test_connection()
        else:
            logger.error(f"Comando desconocido: {args.command}")
            parser.print_help()
            
    except KeyboardInterrupt:
        logger.info("Interrupción recibida")
    except Exception as e:
        logger.error(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
