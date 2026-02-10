# -*- coding: utf-8 -*-
"""
SETUP AUTOMÁTICO - CLOUDFLARE WORKER INTERNACIONAL
Script completo para configurar proxy de enmascaramiento
"""

import os
import subprocess
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent

def install_wrangler():
    """Instalar Wrangler CLI"""
    print("📦 Instalando Wrangler CLI...")
    try:
        subprocess.run(["npm", "install", "-g", "wrangler"], check=True)
        print("✅ Wrangler instalado")
        return True
    except subprocess.CalledProcessError:
        print("❌ Error instalando Wrangler")
        return False

def login_cloudflare():
    """Login a Cloudflare"""
    print("🔐 Login a Cloudflare...")
    try:
        subprocess.run(["wrangler", "login"], check=True)
        print("✅ Login exitoso")
        return True
    except subprocess.CalledProcessError:
        print("❌ Error en login")
        return False

def create_worker_files():
    """Crear archivos del worker"""
    print("📁 Creando archivos del Worker...")
    
    # package.json
    package_json = {
        "name": "rauli-international-proxy",
        "version": "1.0.0",
        "description": "Proxy Cloudflare Worker para operaciones internacionales",
        "main": "src/worker.js",
        "scripts": {
            "dev": "wrangler dev",
            "deploy": "wrangler deploy",
            "deploy:staging": "wrangler deploy --env staging",
            "tail": "wrangler tail"
        },
        "devDependencies": {
            "wrangler": "^3.0.0"
        },
        "keywords": ["cloudflare", "worker", "proxy", "international", "rauli-erp"],
        "author": "RAULI ERP Team",
        "license": "MIT"
    }
    
    package_path = BASE / "package.json"
    with open(package_path, 'w', encoding='utf-8') as f:
        json.dump(package_json, f, indent=2)
    
    print(f"✅ {package_path} creado")
    
    # Instalar dependencias
    try:
        subprocess.run(["npm", "install"], check=True)
        print("✅ Dependencias instaladas")
    except subprocess.CalledProcessError:
        print("❌ Error instalando dependencias")

def deploy_worker():
    """Deploy del Worker"""
    print("🚀 Deploy del Worker...")
    try:
        result = subprocess.run(["wrangler", "deploy"], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Worker deployed exitosamente")
            
            # Extraer URL del worker
            output = result.stdout
            for line in output.split('\n'):
                if 'workers.dev' in line and 'https://' in line:
                    worker_url = line.strip()
                    print(f"🌐 URL del Worker: {worker_url}")
                    return worker_url
        else:
            print(f"❌ Error en deploy: {result.stderr}")
            return None
    except subprocess.CalledProcessError as e:
        print(f"❌ Error en deploy: {e}")
        return None

def update_frontend_config(worker_url):
    """Actualizar configuración del frontend"""
    print("⚙️ Actualizando configuración del frontend...")
    
    # Crear configuración de proxy
    proxy_config = f"""// Configuración Proxy Internacional - Cloudflare Worker
export const INTERNATIONAL_PROXY_CONFIG = {{
  enabled: true,
  workerUrl: '{worker_url}',
  endpoints: {{
    gemini: '/api/gemini',
    deepseek: '/api/deepseek', 
    openai: '/api/openai',
    ollama: '/api/ollama',
    backend: '/api'
  }},
  headers: {{
    'X-Requested-With': 'RAULI-ERP',
    'X-Region': 'International',
    'X-Proxy-Version': '1.0.0'
  }}
}};
"""
    
    config_path = BASE.parent / "frontend" / "src" / "config" / "internationalProxy.js"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(config_path, 'w', encoding='utf-8') as f:
        f.write(proxy_config)
    
    print(f"✅ Configuración guardada en: {config_path}")

def test_proxy(worker_url):
    """Test del proxy"""
    print("🧪 Testeando proxy...")
    
    try:
        import httpx
        
        # Test health check
        response = httpx.get(f"{worker_url}/api/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print("✅ Proxy respondiendo correctamente")
            print(f"📊 Status: {data.get('status')}")
            print(f"🔗 Endpoints: {data.get('endpoints')}")
            return True
        else:
            print(f"❌ Error en test: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error en test: {e}")
        return False

def create_deployment_guide(worker_url):
    """Crear guía de deployment"""
    guide = f"""# 🚀 GUÍA DEPLOYMENT - PROXY INTERNACIONAL

## 🌐 URL del Worker
{worker_url}

## 📋 Endpoints Disponibles

### APIs de IA
- **Gemini**: `{worker_url}/api/gemini`
- **DeepSeek**: `{worker_url}/api/deepseek`
- **OpenAI**: `{worker_url}/api/openai`
- **Ollama**: `{worker_url}/api/ollama`

### Backend
- **API Backend**: `{worker_url}/api`
- **Health Check**: `{worker_url}/api/health`

## 🔧 Configuración Frontend

### 1. Usar el proxy en AIEngine.js
```javascript
import {{ INTERNATIONAL_PROXY_CONFIG }} from '../config/internationalProxy';

// Ejemplo para Gemini
const response = await fetch(`${{INTERNATIONAL_PROXY_CONFIG.workerUrl}}/api/gemini/models/gemini-1.5-flash:generateContent`, {{
  headers: {{
    'Authorization': `Bearer ${{geminiKey}}`,
    'Content-Type': 'application/json'
  }},
  body: JSON.stringify({{
    contents: [{{ parts: [{{ text: prompt }}] }}]
  }})
}});
```

### 2. Actualizar endpoints en la app
- Reemplazar URLs directas de APIs
- Usar URLs del proxy
- Mantener headers de autenticación

## 🛡️ Características de Enmascaramiento

- **IP falsificada**: 8.8.8.8 (US)
- **Headers US**: User-Agent, Accept-Language
- **Geolocalización**: US
- **CORS**: Habilitado para todos los orígenes
- **Timeout**: 30 segundos
- **Cache**: No-cache para frescura

## 📊 Monitoreo

### Ver logs en tiempo real
```bash
wrangler tail
```

### Métricas de uso
- Dashboard Cloudflare
- Analytics Workers
- Rate limits automáticos

## 🔄 Actualizaciones

### Para actualizar el worker
```bash
cd cloudflare-worker
npm run deploy
```

### Para actualizar configuración
1. Modificar `src/worker.js`
2. Deploy con `wrangler deploy`
3. Actualizar frontend si es necesario

## ⚠️ Importante

- **100K requests/día** gratis
- **Sin costo** para uso normal
- **Edge global** para velocidad
- **HTTPS** por defecto
- **Seguro** y anónimo

---
*Proxy configurado para operaciones internacionales*
"""
    
    guide_path = BASE / "DEPLOYMENT_GUIDE.md"
    with open(guide_path, 'w', encoding='utf-8') as f:
        f.write(guide)
    
    print(f"✅ Guía creada: {guide_path}")

def main():
    """Ejecutar setup completo"""
    print("🚀 SETUP AUTOMÁTICO - CLOUDFLARE WORKER INTERNACIONAL")
    print("=" * 50)
    
    steps = [
        ("Instalar Wrangler CLI", install_wrangler),
        ("Crear archivos del Worker", create_worker_files),
        ("Login a Cloudflare", login_cloudflare),
        ("Deploy del Worker", deploy_worker),
        ("Test del Proxy", test_proxy),
        ("Actualizar Frontend", update_frontend_config),
        ("Crear Guía", create_deployment_guide)
    ]
    
    worker_url = None
    
    for step_name, step_func in steps:
        print(f"\n📋 {step_name}...")
        try:
            if step_name == "Deploy del Worker":
                worker_url = step_func()
            elif step_name == "Test del Proxy" and worker_url:
                step_func(worker_url)
            elif step_name == "Actualizar Frontend" and worker_url:
                step_func(worker_url)
            elif step_name == "Crear Guía" and worker_url:
                step_func(worker_url)
            else:
                step_func()
        except Exception as e:
            print(f"❌ Error en {step_name}: {e}")
    
    print("\n🎉 SETUP COMPLETADO")
    if worker_url:
        print(f"\n🌐 Tu Worker está disponible en: {worker_url}")
        print("\n📝 Próximos pasos:")
        print("1. Actualiza el frontend para usar el proxy")
        print("2. Prueba las APIs internacionalmente")
        print("3. Monitorea el uso con 'wrangler tail'")
    else:
        print("\n❌ El deployment falló. Revisa los errores e intenta manualmente")

if __name__ == "__main__":
    main()
