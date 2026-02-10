# -*- coding: utf-8 -*-
"""
SETUP IA HÍBRIDA - Configuración automática de Ollama y proveedores
"""

import os
import sys
import subprocess
from pathlib import Path
import json

BASE = Path(__file__).resolve().parent.parent

def setup_ollama():
    """Instala y configura Ollama si no está disponible"""
    print("🔧 Configurando Ollama...")
    
    try:
        # Verificar si Ollama está instalado
        result = subprocess.run(["ollama", "--version"], capture_output=True, text=True)
        print(f"✅ Ollama ya instalado: {result.stdout.strip()}")
        return True
    except FileNotFoundError:
        print("📦 Ollama no encontrado. Iniciando instalación...")
        
        # Descargar Ollama
        if os.name == 'nt':  # Windows
            ollama_url = "https://ollama.com/download/OllamaSetup.exe"
            print(f"📥 Descarga Ollama desde: {ollama_url}")
            print("🔄 Ejecuta el instalador y reinicia esta terminal")
            return False
        else:  # Linux/Mac
            commands = [
                "curl -fsSL https://ollama.com/install.sh | sh",
                "ollama serve &"
            ]
            for cmd in commands:
                subprocess.run(cmd, shell=True)
            print("✅ Ollama instalado en Linux/Mac")
            return True

def setup_ollama_models():
    """Descarga modelos Ollama recomendados"""
    print("🧠 Configurando modelos Ollama...")
    
    models = [
        ("llama3.2:3b", "Ultra rápido para tareas simples"),
        ("llama3.2:8b", "Balanceado para tareas medias"),
        ("qwen2.5:7b", "Excelente para análisis"),
        ("deepseek-coder:6.7b", "Especializado en configuración")
    ]
    
    for model, description in models:
        print(f"📥 Descargando {model} - {description}")
        try:
            result = subprocess.run(["ollama", "pull", model], capture_output=True, text=True)
            if result.returncode == 0:
                print(f"✅ {model} descargado exitosamente")
            else:
                print(f"❌ Error descargando {model}: {result.stderr}")
        except Exception as e:
            print(f"❌ Error con {model}: {e}")

def setup_credentials():
    """Configura archivo de credenciales"""
    print("🔐 Configurando credenciales...")
    
    credenciales_path = Path(r"C:\dev\credenciales.txt")
    
    if not credenciales_path.exists():
        print("📝 Creando archivo de credenciales...")
        credenciales_path.parent.mkdir(parents=True, exist_ok=True)
        
        template = """# Credenciales IA - RAULI ERP
# Obtén tus API keys de:
# - Gemini: https://aistudio.google.com/app/apikey
# - DeepSeek: https://platform.deepseek.com/api_keys
# - OpenAI: https://platform.openai.com/api-keys

GEMINI_API_KEY=tu_gemini_api_key_aqui
DEEPSEEK_API_KEY=tu_deepseek_api_key_aqui
OPENAI_API_KEY=tu_openai_api_key_aqui

# Configuración Ollama (opcional)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:8b

# Configuración Telegram (para robot)
OMNI_BOT_TELEGRAM_TOKEN=tu_bot_token_aqui
OMNI_BOT_TELEGRAM_CHAT_ID=tu_chat_id_aqui
"""
        credenciales_path.write_text(template, encoding='utf-8')
        print(f"✅ Archivo creado: {credenciales_path}")
        print("📝 Edita el archivo con tus API keys")
    else:
        print(f"✅ Archivo de credenciales ya existe: {credenciales_path}")

def install_python_dependencies():
    """Instala dependencias Python para IA híbrida"""
    print("🐍 Instalando dependencias Python...")
    
    requirements = [
        "httpx",
        "aiofiles",
        "python-dotenv",
        "asyncio"
    ]
    
    for req in requirements:
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", req], check=True)
            print(f"✅ {req} instalado")
        except subprocess.CalledProcessError:
            print(f"❌ Error instalando {req}")

def create_ai_config():
    """Crea configuración IA para el frontend"""
    print("⚙️ Creando configuración IA...")
    
    ai_config = {
        "providers": {
            "gemini": {
                "enabled": True,
                "models": ["gemini-1.5-flash", "gemini-pro", "gemini-1.5-pro"],
                "primary": True
            },
            "deepseek": {
                "enabled": True,
                "models": ["deepseek-chat", "deepseek-coder"],
                "cost_effective": True
            },
            "ollama": {
                "enabled": True,
                "models": ["llama3.2:3b", "llama3.2:8b", "qwen2.5:7b"],
                "local": True,
                "offline": True
            },
            "openai": {
                "enabled": False,
                "models": ["gpt-4o-mini"],
                "premium": True
            }
        },
        "routing": {
            "simple": ["ollama", "deepseek", "gemini"],
            "medium": ["deepseek", "gemini", "ollama"],
            "complex": ["gemini", "openai", "deepseek", "ollama"]
        },
        "cache": {
            "enabled": True,
            "ttl": 3600,
            "max_size": 1000
        }
    }
    
    config_path = BASE / "frontend" / "src" / "config" / "ai_config.json"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(ai_config, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Configuración IA guardada en: {config_path}")

def test_hybrid_setup():
    """Testea la configuración híbrida"""
    print("🧪 Testeando configuración IA híbrida...")
    
    try:
        # Importar y probar el robot híbrido
        sys.path.append(str(BASE / "robot"))
        from hybrid_ai_robot import HybridAIRobot
        
        import asyncio
        
        async def test():
            robot = HybridAIRobot()
            
            # Test simple
            result = await robot.process_request("Hola, ¿cómo estás?", "Test básico")
            print(f"✅ Test básico: {result.get('provider', 'none')}")
            
            # Test complejidad
            complexities = ["simple", "media", "alta"]
            for complexity in complexities:
                result = await robot.process_request(f"Test {complexity}", "", complexity)
                print(f"✅ Test {complexity}: {result.get('provider', 'none')}")
            
            # Métricas
            metrics = robot.get_metrics()
            print(f"📊 Métricas: {metrics}")
        
        asyncio.run(test())
        print("✅ Configuración IA híbrida funcionando")
        
    except Exception as e:
        print(f"❌ Error en test: {e}")
        print("📝 Asegúrate de tener las API keys configuradas")

def main():
    """Ejecuta todo el setup"""
    print("🚀 SETUP IA HÍBRIDA - RAULI ERP")
    print("=" * 50)
    
    steps = [
        ("Instalar dependencias Python", install_python_dependencies),
        ("Configurar Ollama", setup_ollama),
        ("Configurar modelos Ollama", setup_ollama_models),
        ("Configurar credenciales", setup_credentials),
        ("Crear configuración IA", create_ai_config),
        ("Testear configuración", test_hybrid_setup)
    ]
    
    for step_name, step_func in steps:
        print(f"\n📋 {step_name}...")
        try:
            step_func()
        except Exception as e:
            print(f"❌ Error en {step_name}: {e}")
    
    print("\n🎉 SETUP COMPLETADO")
    print("\n📝 Próximos pasos:")
    print("1. Edita C:\\dev\\credenciales.txt con tus API keys")
    print("2. Inicia Ollama si no está corriendo")
    print("3. Ejecuta: python robot/hybrid_ai_robot.py")
    print("4. Prueba la IA en el frontend de la app")

if __name__ == "__main__":
    main()
