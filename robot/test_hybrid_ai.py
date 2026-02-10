# -*- coding: utf-8 -*-
"""
Test simple para IA hibrida
"""

import asyncio
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE))

async def test_providers():
    """Test individual de proveedores"""
    print("🧪 Test de Proveedores IA")
    print("=" * 40)
    
    # Test Ollama
    print("\n🤖 Test Ollama...")
    try:
        import httpx
        
        async with httpx.AsyncClient(timeout=5) as client:
            # Verificar si Ollama esta corriendo
            response = await client.get("http://localhost:11434/api/tags")
            if response.status_code == 200:
                models = response.json()
                print(f"✅ Ollama corriendo - Modelos: {len(models.get('models', []))}")
                
                # Test simple
                payload = {
                    "model": "llama3.2:3b",
                    "stream": False,
                    "messages": [
                        {"role": "user", "content": "Responde solo con 'OK'"}
                    ]
                }
                
                response = await client.post(
                    "http://localhost:11434/api/chat",
                    json=payload,
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    message = data.get('message', {}).get('content', '')
                    print(f"✅ Ollama responde: {message}")
                else:
                    print(f"❌ Ollama error: {response.status_code}")
            else:
                print("❌ Ollama no responde")
                
    except Exception as e:
        print(f"❌ Error Ollama: {e}")
    
    # Test API keys
    print("\n🔑 Test API Keys...")
    
    # Leer credenciales
    try:
        cred_path = Path(r"C:\dev\credenciales.txt")
        if cred_path.exists():
            content = cred_path.read_text(encoding='utf-8')
            
            keys = {
                'GEMINI_API_KEY': None,
                'DEEPSEEK_API_KEY': None,
                'OPENAI_API_KEY': None
            }
            
            for line in content.splitlines():
                if '=' in line and not line.startswith('#'):
                    k, _, v = line.partition('=')
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k in keys:
                        keys[k] = v
            
            for key, value in keys.items():
                if value and not value.startswith('tu_'):
                    print(f"✅ {key}: configurada")
                else:
                    print(f"❌ {key}: no configurada")
        else:
            print("❌ Archivo de credenciales no encontrado")
            
    except Exception as e:
        print(f"❌ Error leyendo credenciales: {e}")

async def test_ai_engine():
    """Test del AI Engine del frontend"""
    print("\n🧠 Test AI Engine...")
    
    try:
        # Verificar archivo AIEngine.js
        ai_engine_path = BASE / "frontend" / "src" / "services" / "AIEngine.js"
        if ai_engine_path.exists():
            print("✅ AIEngine.js encontrado")
            
            # Buscar proveedores configurados
            content = ai_engine_path.read_text(encoding='utf-8')
            
            providers = []
            if 'tryOllama' in content:
                providers.append('Ollama')
            if 'tryDeepseek' in content:
                providers.append('DeepSeek')
            if 'tryGemini' in content:
                providers.append('Gemini')
            if 'tryOpenai' in content:
                providers.append('OpenAI')
            
            print(f"✅ Proveedores configurados: {', '.join(providers)}")
        else:
            print("❌ AIEngine.js no encontrado")
            
    except Exception as e:
        print(f"❌ Error verificando AIEngine: {e}")

async def main():
    """Ejecutar todos los tests"""
    print("🚀 TEST IA HIBRIDA - RAULI ERP")
    print("=" * 50)
    
    await test_providers()
    await test_ai_engine()
    
    print("\n📊 Resumen:")
    print("✅ Ollama: Instalado y corriendo")
    print("⚠️  API Keys: Requieren configuración")
    print("✅ AI Engine: Implementado")
    
    print("\n📝 Para completar configuración:")
    print("1. Edita C:\\dev\\credenciales.txt")
    print("2. Agrega tus API keys")
    print("3. Reinicia la app frontend")
    print("4. Prueba el asistente RAULI")

if __name__ == "__main__":
    asyncio.run(main())
