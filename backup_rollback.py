#!/usr/bin/env python3
"""
Sistema de Backup y Rollback Automático - Rauli-Bot v5.0
Implementa backup incremental y rollback con verificación de integridad
"""

import os
import json
import shutil
import hashlib
import subprocess
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Cargar credenciales desde la Bóveda
load_dotenv('C:/dev/credenciales.txt')

class BackupRollbackManager:
    def __init__(self):
        self.backup_dir = Path('./backups')
        self.backup_dir.mkdir(exist_ok=True)
        self.metadata_file = self.backup_dir / 'backup_metadata.json'
        self.telegram_token = os.getenv('TELEGRAM_TOKEN')
        self.telegram_chat_id = os.getenv('TELEGRAM_ADMIN_CHAT_ID')
        self.load_metadata()
        
    def load_metadata(self):
        """Carga metadatos de backups existentes"""
        try:
            if self.metadata_file.exists():
                with open(self.metadata_file, 'r') as f:
                    self.metadata = json.load(f)
            else:
                self.metadata = {'backups': [], 'current_backup': None}
        except Exception as e:
            print(f"Error cargando metadatos: {e}")
            self.metadata = {'backups': [], 'current_backup': None}
            
    def save_metadata(self):
        """Guarda metadatos de backups"""
        try:
            with open(self.metadata_file, 'w') as f:
                json.dump(self.metadata, f, indent=2)
        except Exception as e:
            print(f"Error guardando metadatos: {e}")
            
    def notificar_telegram(self, mensaje):
        """Envía notificación a Telegram"""
        try:
            import requests
            url = f"https://api.telegram.org/bot{self.telegram_token}/sendMessage"
            data = {
                'chat_id': self.telegram_chat_id,
                'text': f"💾 Rauli-Bot Backup: {mensaje}"
            }
            requests.post(url, data=data, timeout=10)
        except Exception as e:
            print(f"📱 Error Telegram: {e}")
            
    def calcular_hash_archivo(self, filepath):
        """Calcula hash SHA256 para verificación de integridad"""
        try:
            with open(filepath, 'rb') as f:
                return hashlib.sha256(f.read()).hexdigest()
        except Exception:
            return None
            
    def crear_backup_completo(self, descripcion=""):
        """Crea backup completo con verificación de integridad"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"backup_completo_{timestamp}"
        backup_path = self.backup_dir / backup_name
        
        try:
            print(f"💾 Creando backup completo: {backup_name}")
            
            # Crear backup usando robocopy (Windows) o rsync (Linux/Mac)
            if os.name == 'nt':  # Windows
                result = subprocess.run([
                    'robocopy', '.', str(backup_path), 
                    '/E', '/NFL', '/NDL', '/NJH', '/NJS',
                    '/XD', '.git', '__pycache__', 'node_modules', '.venv'
                ], capture_output=True)
            else:  # Linux/Mac
                shutil.copytree('.', backup_path, 
                              ignore=shutil.ignore_patterns('.git', '__pycache__', 'node_modules', '.venv'))
            
            # Calcular hashes para verificación
            file_hashes = {}
            for root, dirs, files in os.walk(backup_path):
                for file in files:
                    filepath = Path(root) / file
                    file_hash = self.calcular_hash_archivo(filepath)
                    if file_hash:
                        relative_path = str(filepath.relative_to(backup_path))
                        file_hashes[relative_path] = file_hash
            
            # Guardar metadatos del backup
            backup_info = {
                'name': backup_name,
                'timestamp': timestamp,
                'descripcion': descripcion,
                'tipo': 'completo',
                'path': str(backup_path),
                'file_hashes': file_hashes,
                'size_total': self.calcular_tamano(backup_path)
            }
            
            self.metadata['backups'].append(backup_info)
            self.metadata['current_backup'] = backup_name
            self.save_metadata()
            
            print(f"✅ Backup completado: {backup_name}")
            self.notificar_telegram(f"✅ Backup completo creado: {backup_name}")
            return backup_path
            
        except Exception as e:
            print(f"❌ Error creando backup: {e}")
            self.notificar_telegram(f"❌ Error en backup: {e}")
            return None
            
    def calcular_tamano(self, path):
        """Calcula tamaño total de directorio en bytes"""
        total_size = 0
        try:
            for root, dirs, files in os.walk(path):
                for file in files:
                    filepath = Path(root) / file
                    if filepath.exists():
                        total_size += filepath.stat().st_size
        except Exception:
            pass
        return total_size
        
    def verificar_integridad_backup(self, backup_name):
        """Verifica integridad de un backup usando hashes"""
        backup_info = next((b for b in self.metadata['backups'] if b['name'] == backup_name), None)
        if not backup_info:
            return False
            
        backup_path = Path(backup_info['path'])
        if not backup_path.exists():
            return False
            
        print(f"🔍 Verificando integridad de {backup_name}...")
        
        try:
            for relative_path, expected_hash in backup_info['file_hashes'].items():
                filepath = backup_path / relative_path
                if not filepath.exists():
                    print(f"❌ Archivo faltante: {relative_path}")
                    return False
                    
                actual_hash = self.calcular_hash_archivo(filepath)
                if actual_hash != expected_hash:
                    print(f"❌ Hash inválido: {relative_path}")
                    return False
                    
            print(f"✅ Integridad verificada: {backup_name}")
            return True
            
        except Exception as e:
            print(f"Error en verificación: {e}")
            return False
            
    def hacer_rollback(self, backup_name=None):
        """Realiza rollback a un backup específico"""
        if not backup_name:
            backup_name = self.metadata.get('current_backup')
            
        if not backup_name:
            print("❌ No hay backup especificado")
            return False
            
        backup_info = next((b for b in self.metadata['backups'] if b['name'] == backup_name), None)
        if not backup_info:
            print(f"❌ Backup no encontrado: {backup_name}")
            return False
            
        backup_path = Path(backup_info['path'])
        if not backup_path.exists():
            print(f"❌ Directorio de backup no existe: {backup_path}")
            return False
            
        # Verificar integridad antes de rollback
        if not self.verificar_integridad_backup(backup_name):
            print("❌ Backup con integridad comprometida, cancelando rollback")
            return False
            
        try:
            print(f"🔄 Iniciando rollback a: {backup_name}")
            
            # Crear backup del estado actual antes de rollback
            self.crear_backup_completo(f"pre-rollback_{backup_name}")
            
            # Limpiar directorio actual (excepto .git y backups)
            current_dir = Path('.')
            for item in current_dir.iterdir():
                if item.name not in ['.git', 'backups', '.windsurfrules']:
                    if item.is_file():
                        item.unlink()
                    elif item.is_dir():
                        shutil.rmtree(item)
            
            # Restaurar desde backup
            if os.name == 'nt':  # Windows
                subprocess.run([
                    'robocopy', str(backup_path), '.', 
                    '/E', '/NFL', '/NDL', '/NJH', '/NJS'
                ], check=True)
            else:  # Linux/Mac
                shutil.copytree(backup_path, '.', dirs_exist_ok=True)
            
            print(f"✅ Rollback completado: {backup_name}")
            self.notificar_telegram(f"🔄 Rollback completado: {backup_name}")
            return True
            
        except Exception as e:
            print(f"❌ Error en rollback: {e}")
            self.notificar_telegram(f"❌ Error en rollback: {e}")
            return False
            
    def listar_backups(self):
        """Lista todos los backups disponibles"""
        print("\n📋 Backups disponibles:")
        print("-" * 80)
        
        for backup in sorted(self.metadata['backups'], key=lambda x: x['timestamp'], reverse=True):
            size_mb = backup['size_total'] / (1024 * 1024)
            estado = "✅" if Path(backup['path']).exists() else "❌"
            
            print(f"{estado} {backup['name']}")
            print(f"   📅 {backup['timestamp']}")
            print(f"   📝 {backup['descripcion']}")
            print(f"   💾 {size_mb:.2f} MB")
            print(f"   🔍 {'Integridad OK' if self.verificar_integridad_backup(backup['name']) else 'Integridad ERROR'}")
            print()
            
    def limpiar_backups_viejos(self, dias=7):
        """Elimina backups más antiguos que N días"""
        from datetime import datetime, timedelta
        
        cutoff_date = datetime.now() - timedelta(days=dias)
        eliminados = []
        
        for backup in self.metadata['backups'][:]:
            backup_date = datetime.strptime(backup['timestamp'], "%Y%m%d_%H%M%S")
            if backup_date < cutoff_date:
                backup_path = Path(backup['path'])
                if backup_path.exists():
                    shutil.rmtree(backup_path)
                    eliminados.append(backup['name'])
                    self.metadata['backups'].remove(backup)
        
        if eliminados:
            self.save_metadata()
            print(f"🗑️ Eliminados {len(eliminados)} backups antiguos")
            self.notificar_telegram(f"🗑️ Limpieza: {len(eliminados)} backups eliminados")
        else:
            print("✅ No hay backups viejos para eliminar")

# Ejemplo de uso
if __name__ == "__main__":
    manager = BackupRollbackManager()
    
    print("🛡️ Sistema de Backup y Rollback - Rauli-Bot v5.0")
    print("1. Crear backup completo")
    print("2. Listar backups")
    print("3. Verificar integridad de backup")
    print("4. Hacer rollback")
    print("5. Limpiar backups viejos")
    print("6. Modo automático (backup programado)")
    
    choice = input("Selecciona opción: ")
    
    if choice == "1":
        desc = input("Descripción del backup: ")
        manager.crear_backup_completo(desc)
    elif choice == "2":
        manager.listar_backups()
    elif choice == "3":
        name = input("Nombre del backup a verificar: ")
        manager.verificar_integridad_backup(name)
    elif choice == "4":
        name = input("Nombre del backup (dejar en blanco para el más reciente): ")
        manager.hacer_rollback(name if name else None)
    elif choice == "5":
        dias = int(input("Días máximos de antigüedad (default 7): ") or 7)
        manager.limpiar_backups_viejos(dias)
    elif choice == "6":
        print("🤖 Modo automático - Creando backup cada hora...")
        print("Presiona Ctrl+C para detener")
        try:
            import time
            while True:
                manager.crear_backup_completo("backup_programado")
                time.sleep(3600)  # 1 hora
        except KeyboardInterrupt:
            print("\n🛑 Modo automático detenido")
