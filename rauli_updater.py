#!/usr/bin/env python3
"""
Sistema Rauli-Update v5.0 - Actualizador Autónomo
Implementa ciclo vital de actualizaciones con backup, rollback y notificaciones
"""

import os
import sys
import json
import time
import requests
import subprocess
import threading
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Cargar credenciales desde la Bóveda
load_dotenv('C:/dev/credenciales.txt')

class RauliUpdater:
    def __init__(self):
        self.current_version = "1.0.0"
        self.update_manifest_url = os.getenv('UPDATE_MANIFEST_URL', '')
        self.github_token = os.getenv('GITHUB_TOKEN')
        self.telegram_token = os.getenv('TELEGRAM_TOKEN')
        self.telegram_chat_id = os.getenv('TELEGRAM_ADMIN_CHAT_ID')
        self.backup_dir = Path('./backups')
        self.backup_dir.mkdir(exist_ok=True)
        
    def notificar_voz(self, mensaje):
        """Notificación por voz al Comandante"""
        try:
            import pyttsx3
            engine = pyttsx3.init()
            engine.say(f"Atención Comandante: {mensaje}")
            engine.runAndWait()
        except Exception as e:
            print(f"🔊 Notificación voz: {mensaje}")
            
    def notificar_telegram(self, mensaje):
        """Envía notificación a Telegram"""
        try:
            url = f"https://api.telegram.org/bot{self.telegram_token}/sendMessage"
            data = {
                'chat_id': self.telegram_chat_id,
                'text': f"🤖 Rauli-Bot Updater: {mensaje}"
            }
            requests.post(url, data=data, timeout=10)
        except Exception as e:
            print(f"📱 Error Telegram: {e}")
            
    def crear_backup(self):
        """Crea backup completo antes de actualizar"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = self.backup_dir / f"backup_{timestamp}"
        
        try:
            subprocess.run(['robocopy', '.', str(backup_path), '/E', '/NFL', '/NDL', '/NJH', '/NJS'], 
                         check=True, capture_output=True)
            print(f"💾 Backup creado: {backup_path}")
            return backup_path
        except subprocess.CalledProcessError:
            # Fallback para Linux/Mac
            import shutil
            shutil.copytree('.', backup_path, ignore=shutil.ignore_patterns('.git', '__pycache__', 'node_modules'))
            return backup_path
            
    def verificar_actualizaciones(self):
        """Busca nuevas versiones disponibles"""
        if not self.update_manifest_url:
            return None
            
        try:
            response = requests.get(self.update_manifest_url, timeout=10)
            if response.status_code == 200:
                manifest = response.json()
                latest_version = manifest.get('version', '1.0.0')
                changelog = manifest.get('changelog', '')
                download_url = manifest.get('download_url', '')
                
                if latest_version > self.current_version:
                    return {
                        'version': latest_version,
                        'changelog': changelog,
                        'download_url': download_url
                    }
        except Exception as e:
            print(f"Error verificando actualizaciones: {e}")
        return None
        
    def aplicar_actualizacion(self, update_info):
        """Aplica actualización con rollback automático si falla"""
        backup_path = self.crear_backup()
        
        try:
            self.notificar_voz("Iniciando actualización del sistema")
            self.notificar_telegram(f"🔄 Actualizando a versión {update_info['version']}")
            
            # Descargar y aplicar actualización
            if update_info.get('download_url'):
                response = requests.get(update_info['download_url'])
                if response.status_code == 200:
                    # Guardar actualización
                    update_file = Path('./update.zip')
                    update_file.write_bytes(response.content)
                    
                    # Extraer y aplicar (simplificado)
                    import zipfile
                    with zipfile.ZipFile(update_file, 'r') as zip_ref:
                        zip_ref.extractall('./temp_update')
                    
                    # Mover archivos (con confirmación)
                    subprocess.run(['xcopy', './temp_update/*', '.', '/E', '/Y'], shell=True)
                    
                    # Limpiar
                    update_file.unlink()
                    Path('./temp_update').rmdir()
                    
                    self.notificar_voz("Actualización completada exitosamente")
                    self.notificar_telegram(f"✅ Sistema actualizado a v{update_info['version']}")
                    return True
                    
        except Exception as e:
            print(f"❌ Error en actualización: {e}")
            self.notificar_voz("Error crítico en actualización, iniciando rollback")
            self.notificar_telegram(f"❌ Error actualización: {e}. Iniciando rollback...")
            
            # Rollback automático
            self.hacer_rollback(backup_path)
            return False
            
    def hacer_rollback(self, backup_path):
        """Revierte a versión anterior"""
        try:
            subprocess.run(['robocopy', str(backup_path), '.', '/E', '/NFL', '/NDL', '/NJH', '/NJS'], 
                         check=True)
            self.notificar_voz("Rollback completado, sistema restaurado")
            self.notificar_telegram("🔄 Rollback completado - Sistema restaurado")
        except Exception as e:
            print(f"Error en rollback: {e}")
            
    def vigilante_automatico(self):
        """Hilo secundario que busca actualizaciones periódicamente"""
        while True:
            time.sleep(300)  # Verificar cada 5 minutos
            update = self.verificar_actualizaciones()
            if update:
                self.notificar_telegram(f"🆕 Nueva versión disponible: {update['version']}")
                
    def iniciar_vigilante(self):
        """Inicia el vigilante en segundo plano"""
        vigilante = threading.Thread(target=self.vigilante_automatico, daemon=True)
        vigilante.start()
        
    def buscar_actualizacion_manual(self):
        """Función para el botón manual"""
        print("🔍 Buscando actualizaciones...")
        update = self.verificar_actualizaciones()
        
        if update:
            print(f"✅ Actualización disponible: {update['version']}")
            print(f"📝 Cambios: {update['changelog']}")
            
            # Mostrar modal (simplificado para consola)
            respuesta = input("¿Desea actualizar ahora? (s/n): ")
            if respuesta.lower() == 's':
                self.aplicar_actualizacion(update)
        else:
            print("✅ Sistema actualizado")
            
if __name__ == "__main__":
    updater = RauliUpdater()
    
    if len(sys.argv) > 1 and sys.argv[1] == "--manual":
        updater.buscar_actualizacion_manual()
    else:
        # Iniciar vigilante automático
        updater.iniciar_vigilante()
        print("🤖 Sistema Rauli-Update operativo - Vigilante activo")
        
        # Mantener vivo el proceso
        try:
            while True:
                time.sleep(60)
        except KeyboardInterrupt:
            print("🛑 Sistema Rauli-Update detenido")
