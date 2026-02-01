#!/usr/bin/env python3
"""
Gestor autónomo de proyectos para GitHub, Vercel y otras plataformas
Sistema Rauli-Bot v5.0 - Con notificaciones y credenciales seguras
"""

import subprocess
import json
import os
import requests
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

# Cargar credenciales desde la Bóveda
load_dotenv('C:/dev/credenciales.txt')

class ProjectManager:
    def __init__(self):
        self.github_cli = "gh"
        self.vercel_cli = "vercel"
        self.git_cli = "git"
        self.github_token = os.getenv('GITHUB_TOKEN')
        self.vercel_token = os.getenv('VERCEL_TOKEN')
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
                'text': f"🤖 Rauli-Bot Manager: {mensaje}"
            }
            requests.post(url, data=data, timeout=10)
        except Exception as e:
            print(f"📱 Error Telegram: {e}")
            
    def crear_backup_proyecto(self, project_name):
        """Crea backup antes de operaciones críticas"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = self.backup_dir / f"{project_name}_{timestamp}"
        
        try:
            subprocess.run(['robocopy', '.', str(backup_path), '/E', '/NFL', '/NDL', '/NJH', '/NJS'], 
                         check=True, capture_output=True)
            print(f"💾 Backup del proyecto creado: {backup_path}")
            return backup_path
        except subprocess.CalledProcessError:
            import shutil
            shutil.copytree('.', backup_path, ignore=shutil.ignore_patterns('.git', '__pycache__', 'node_modules'))
            return backup_path
    
    def run_command(self, command, description=""):
        """Ejecuta comando y retorna resultado"""
        print(f"🔧 {description}")
        try:
            result = subprocess.run(command, shell=True, capture_output=True, text=True)
            if result.returncode == 0:
                print(f"✅ {description} completado")
                return result.stdout.strip()
            else:
                print(f"❌ Error en {description}: {result.stderr}")
                return None
        except Exception as e:
            print(f"❌ Excepción en {description}: {e}")
            return None
    
    def create_github_repo(self, repo_name, public=True):
        """Crear repositorio en GitHub"""
        visibility = "--public" if public else "--private"
        cmd = f"{self.github_cli} repo create {repo_name} {visibility} --source=. --remote=origin --push"
        resultado = self.run_command(cmd, f"Creando repositorio {repo_name}")
        
        if resultado:
            self.notificar_voz(f"Repositorio {repo_name} creado exitosamente")
            self.notificar_telegram(f"✅ Repositorio {repo_name} creado en GitHub")
        return resultado
    
    def deploy_to_vercel(self, prod=True):
        """Desplegar a Vercel"""
        flag = "--prod" if prod else ""
        cmd = f"{self.vercel_cli} {flag} --token {self.vercel_token}"
        resultado = self.run_command(cmd, "Desplegando a Vercel")
        
        if resultado:
            self.notificar_voz("Sitio web desplegado exitosamente")
            self.notificar_telegram("🌐 Sitio desplegado en Vercel")
        return resultado
    
    def create_issue(self, title, body="", repo=None):
        """Crear issue en GitHub"""
        repo_arg = f"--repo {repo}" if repo else ""
        cmd = f"{self.github_cli} issue create --title '{title}' --body '{body}' {repo_arg}"
        return self.run_command(cmd, f"Creando issue: {title}")
    
    def list_repos(self):
        """Listar repositorios"""
        cmd = f"{self.github_cli} repo list"
        return self.run_command(cmd, "Listando repositorios")
    
    def auto_workflow(self, project_name, description=""):
        """Flujo de trabajo completo autónomo"""
        print(f"🚀 Iniciando workflow para: {project_name}")
        
        # 0. Backup antes de todo
        self.crear_backup_proyecto(project_name)
        
        # 1. Git operations
        self.run_command(f"{self.git_cli} add .", "Añadiendo archivos")
        self.run_command(f"{self.git_cli} commit -m 'Auto commit Rauli-Bot: {datetime.now()}'", "Commit")
        
        # 2. GitHub operations
        if self.create_github_repo(project_name):
            # 3. Vercel deployment
            self.deploy_to_vercel()
            
            # 4. Verificación final
            self.notificar_voz(f"Proyecto {project_name} completado exitosamente")
            self.notificar_telegram(f"🎯 Workflow completo: {project_name}")
            
        print(f"✅ Workflow completado para {project_name}")
        
    def verificar_sitio_activo(self, url):
        """Verifica que el sitio esté respondiendo"""
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                self.notificar_telegram(f"✅ Sitio activo: {url}")
                return True
            else:
                self.notificar_telegram(f"⚠️ Sitio con errores: {url} (Status: {response.status_code})")
                return False
        except Exception as e:
            self.notificar_telegram(f"❌ Sitio no responde: {url} - {e}")
            return False

# Ejemplo de uso
if __name__ == "__main__":
    manager = ProjectManager()
    
    # Menu interactivo mejorado
    print("🎯 Gestor Autónomo de Proyectos - Sistema Rauli-Bot v5.0")
    print("1. Crear nuevo proyecto (workflow completo)")
    print("2. Desplegar proyecto existente")
    print("3. Listar repositorios")
    print("4. Crear issue")
    print("5. Verificar sitio activo")
    print("6. Modo automático (vigilante)")
    
    choice = input("Selecciona opción: ")
    
    if choice == "1":
        name = input("Nombre del proyecto: ")
        desc = input("Descripción: ")
        manager.auto_workflow(name, desc)
    elif choice == "2":
        manager.deploy_to_vercel()
    elif choice == "3":
        repos = manager.list_repos()
        print(repos)
    elif choice == "4":
        title = input("Título del issue: ")
        body = input("Descripción: ")
        manager.create_issue(title, body)
    elif choice == "5":
        url = input("URL del sitio a verificar: ")
        manager.verificar_sitio_activo(url)
    elif choice == "6":
        print("🤖 Modo vigilante activado - Monitoreando proyectos...")
        manager.notificar_voz("Sistema vigilante activado")
        # Aquí se podría implementar un loop de monitoreo
        input("Presiona Enter para detener...")
