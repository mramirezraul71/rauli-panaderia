# -*- coding: utf-8 -*-
"""
ROBOT HÍBRIDO IA - Integración avanzada con múltiples proveedores
Soporta: Gemini, DeepSeek, Ollama (local), OpenAI
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import httpx

# Configuración logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE = Path(__file__).resolve().parent.parent

class HybridAIRobot:
    """Robot con IA híbrida y selección inteligente de proveedores"""
    
    def __init__(self):
        self.providers = {
            'gemini': GeminiProvider(),
            'deepseek': DeepSeekProvider(),
            'ollama': OllamaProvider(),
            'openai': OpenAIProvider()
        }
        self.cache = {}
        self.metrics = {
            'requests': 0,
            'success': 0,
            'provider_usage': {p: 0 for p in self.providers}
        }
        
    async def process_request(self, text: str, context: str = "", complexity: str = "auto") -> Dict:
        """
        Procesa solicitud usando seleccion inteligente de proveedores
        """
        self.metrics['requests'] += 1
        
        try:
            # 1. Analizar complejidad si es auto
            if complexity == "auto":
                complexity = self._classify_complexity(text)
            
            # 2. Verificar cache
            cache_key = f"{hash(text + context)}:{complexity}"
            if cache_key in self.cache:
                logger.info(f"Cache hit para: {text[:50]}...")
                return self.cache[cache_key]
            
            # 3. Seleccionar proveedor optimo
            provider_chain = self._get_provider_chain(complexity)
            
            # 4. Ejecutar con fallback
            result = None
            last_error = None
            
            for provider_name in provider_chain:
                provider = self.providers[provider_name]
                try:
                    logger.info(f"Intentando con {provider_name}...")
                    result = await provider.process(text, context)
                    
                    if result and result.get('text'):
                        self.metrics['success'] += 1
                        self.metrics['provider_usage'][provider_name] += 1
                        
                        # Cache exit result
                        self.cache[cache_key] = result
                        
                        logger.info(f"Exito con {provider_name}")
                        return {
                            **result,
                            'provider': provider_name,
                            'complexity': complexity,
                            'cached': False
                        }
                        
                except Exception as e:
                    last_error = e
                    logger.warning(f"Error con {provider_name}: {e}")
                    continue
            
            # 5. Si todos fallan, respuesta de fallback
            logger.error(f"Todos los proveedores fallaron: {last_error}")
            return {
                'text': f"Lo siento, todos los servicios de IA no estan disponibles. Error: {last_error}",
                'provider': 'none',
                'complexity': complexity,
                'error': str(last_error)
            }
            
        except Exception as e:
            logger.error(f"Error procesando request: {e}")
            return {
                'text': "Error interno procesando tu solicitud.",
                'error': str(e)
            }
    
    def _classify_complexity(self, text: str) -> str:
        """Clasifica la complejidad de la solicitud"""
        text_lower = text.lower()
        
        # Palabras clave para cada nivel
        complex_keywords = [
            'analiza', 'estrategia', 'plan', 'audita', 'optimiza', 
            'diagnóstico', 'riesgo', 'proyección', 'modelo financiero',
            'legal', 'política', 'compliance', 'kpi', 'forecast'
        ]
        
        medium_keywords = [
            'reporte', 'resumen', 'explica', 'detalle', 'consulta',
            'configura', 'pasos', 'procedimiento', 'documenta',
            'inventario', 'ventas', 'compras', 'contabilidad'
        ]
        
        # Evaluar longitud y palabras clave
        length_score = len(text) > 240 ? 2 : len(text) > 120 ? 1 : 0
        complex_score = sum(1 for kw in complex_keywords if kw in text_lower)
        medium_score = sum(1 for kw in medium_keywords if kw in text_lower)
        
        total_score = length_score + (complex_score * 2) + (medium_score * 1)
        
        if total_score >= 3:
            return 'alta'
        elif total_score >= 2:
            return 'media'
        else:
            return 'simple'
    
    def _get_provider_chain(self, complexity: str) -> List[str]:
        """Obtiene cadena de proveedores por complejidad"""
        chains = {
            'simple': ['ollama', 'deepseek', 'gemini', 'openai'],
            'media': ['deepseek', 'gemini', 'ollama', 'openai'],
            'alta': ['gemini', 'openai', 'deepseek', 'ollama']
        }
        return chains.get(complexity, chains['simple'])
    
    def get_metrics(self) -> Dict:
        """Obtiene métricas de uso"""
        return {
            **self.metrics,
            'success_rate': self.metrics['success'] / max(self.metrics['requests'], 1),
            'cache_size': len(self.cache)
        }
    
    def clear_cache(self):
        """Limpia el cache"""
        self.cache.clear()
        logger.info("Cache limpiado")

class BaseProvider:
    """Clase base para proveedores de IA"""
    
    def __init__(self, name: str):
        self.name = name
        self.enabled = True
        self.last_error = None
        
    async def process(self, text: str, context: str = "") -> Dict:
        """Procesa texto - implementar en subclases"""
        raise NotImplementedError
    
    def is_available(self) -> bool:
        """Verifica si el proveedor está disponible"""
        return self.enabled

class OllamaProvider(BaseProvider):
    """Proveedor Ollama (local/offline)"""
    
    def __init__(self):
        super().__init__('ollama')
        self.base_url = os.environ.get('OLLAMA_BASE_URL', 'http://localhost:11434')
        self.model = os.environ.get('OLLAMA_MODEL', 'llama3.2:8b')
        
    async def process(self, text: str, context: str = "") -> Dict:
        try:
            # Verificar si Ollama está corriendo
            async with httpx.AsyncClient(timeout=5) as client:
                # Verificar disponibilidad
                try:
                    await client.get(f"{self.base_url}/api/tags")
                except httpx.ConnectError:
                    self.enabled = False
                    raise Exception("Ollama no está corriendo")
                
                # Procesar solicitud
                payload = {
                    "model": self.model,
                    "stream": False,
                    "messages": [
                        {"role": "system", "content": f"Eres un asistente ERP experto. {context}"},
                        {"role": "user", "content": text}
                    ]
                }
                
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    message = data.get('message', {}).get('content', '')
                    
                    if message:
                        return {
                            'text': message.strip(),
                            'model': self.model,
                            'local': True
                        }
                    else:
                        raise Exception("Respuesta vacía de Ollama")
                else:
                    raise Exception(f"Error {response.status_code}: {response.text}")
                    
        except Exception as e:
            self.last_error = str(e)
            raise e

class DeepSeekProvider(BaseProvider):
    """Proveedor DeepSeek (económico)"""
    
    def __init__(self):
        super().__init__('deepseek')
        self.api_key = self._load_api_key()
        self.base_url = "https://api.deepseek.com/v1"
        self.model = "deepseek-chat"
        
    def _load_api_key(self) -> str:
        # Buscar API key en múltiples ubicaciones
        candidates = [
            os.environ.get('DEEPSEEK_API_KEY'),
            self._read_from_file(r"C:\dev\credenciales.txt", "DEEPSEEK_API_KEY"),
            self._read_from_file(BASE / "credenciales.txt", "DEEPSEEK_API_KEY")
        ]
        
        for key in candidates:
            if key and key.startswith("sk-"):
                return key
        return ""
    
    def _read_from_file(self, path: Path, key_name: str) -> str:
        try:
            if not path.exists():
                return ""
            content = path.read_text(encoding='utf-8')
            for line in content.splitlines():
                if '=' in line and not line.startswith('#'):
                    k, _, v = line.partition('=')
                    if k.strip() == key_name:
                        return v.strip().strip("'\"")
        except:
            pass
        return ""
    
    async def process(self, text: str, context: str = "") -> Dict:
        if not self.api_key:
            raise Exception("DEEPSEEK_API_KEY no configurada")
            
        try:
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": f"Eres GENESIS, asistente ERP experto. {context}"},
                    {"role": "user", "content": text}
                ],
                "max_tokens": 500,
                "temperature": 0.7
            }
            
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    message = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                    
                    if message:
                        return {
                            'text': message.strip(),
                            'model': self.model,
                            'cost_effective': True
                        }
                    else:
                        raise Exception("Respuesta vacía de DeepSeek")
                elif response.status_code in [402, 429]:
                    raise Exception("Saldo insuficiente en DeepSeek")
                else:
                    raise Exception(f"Error {response.status_code}: {response.text}")
                    
        except Exception as e:
            self.last_error = str(e)
            raise e

class GeminiProvider(BaseProvider):
    """Proveedor Gemini (Google)"""
    
    def __init__(self):
        super().__init__('gemini')
        self.api_key = self._load_api_key()
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.models = ["gemini-1.5-flash", "gemini-pro", "gemini-1.5-pro"]
        
    def _load_api_key(self) -> str:
        candidates = [
            os.environ.get('GEMINI_API_KEY'),
            self._read_from_file(r"C:\dev\credenciales.txt", "GEMINI_API_KEY"),
            self._read_from_file(BASE / "credenciales.txt", "GEMINI_API_KEY")
        ]
        
        for key in candidates:
            if key and key.startswith("AIza"):
                return key
        return ""
    
    def _read_from_file(self, path: Path, key_name: str) -> str:
        try:
            if not path.exists():
                return ""
            content = path.read_text(encoding='utf-8')
            for line in content.splitlines():
                if '=' in line and not line.startswith('#'):
                    k, _, v = line.partition('=')
                    if k.strip() == key_name:
                        return v.strip().strip("'\"")
        except:
            pass
        return ""
    
    async def process(self, text: str, context: str = "") -> Dict:
        if not self.api_key:
            raise Exception("GEMINI_API_KEY no configurada")
            
        for model in self.models:
            try:
                url = f"{self.base_url}/models/{model}:generateContent?key={self.api_key}"
                payload = {
                    "contents": [{
                        "parts": [{"text": f"Eres GENESIS, asistente ERP experto. {context}\n\nUsuario: {text}"}]
                    }],
                    "generationConfig": {
                        "temperature": 0.7,
                        "maxOutputTokens": 500,
                        "topP": 0.95
                    }
                }
                
                async with httpx.AsyncClient(timeout=30) as client:
                    response = await client.post(url, json=payload)
                    
                    if response.status_code == 200:
                        data = response.json()
                        message = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                        
                        if message:
                            return {
                                'text': message.strip(),
                                'model': model,
                                'google': True
                            }
                    elif response.status_code == 429:
                        continue  # Intentar siguiente modelo
                    else:
                        raise Exception(f"Error {response.status_code}: {response.text}")
                        
            except Exception as e:
                if model == self.models[-1]:  # Último modelo
                    raise e
                continue
                
        raise Exception("Todos los modelos Gemini fallaron")

class OpenAIProvider(BaseProvider):
    """Proveedor OpenAI (premium)"""
    
    def __init__(self):
        super().__init__('openai')
        self.api_key = os.environ.get('OPENAI_API_KEY', '')
        self.model = "gpt-4o-mini"
        
    async def process(self, text: str, context: str = "") -> Dict:
        if not self.api_key:
            raise Exception("OPENAI_API_KEY no configurada")
            
        try:
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": f"Eres GENESIS, asistente ERP experto. {context}"},
                    {"role": "user", "content": text}
                ],
                "max_tokens": 500,
                "temperature": 0.7
            }
            
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    message = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                    
                    if message:
                        return {
                            'text': message.strip(),
                            'model': self.model,
                            'premium': True
                        }
                    else:
                        raise Exception("Respuesta vacía de OpenAI")
                else:
                    raise Exception(f"Error {response.status_code}: {response.text}")
                    
        except Exception as e:
            self.last_error = str(e)
            raise e

# Funciones de utilidad
async def test_hybrid_robot():
    """Test del robot híbrido"""
    robot = HybridAIRobot()
    
    test_requests = [
        ("¿Cuántos productos hay en inventario?", "simple"),
        ("Genera un reporte de ventas del mes", "media"),
        ("Analiza la rentabilidad y optimiza costos", "alta")
    ]
    
    for text, expected_complexity in test_requests:
        print(f"\n🧪 Test: {text}")
        result = await robot.process_request(text, "Contexto ERP")
        
        print(f"✅ Proveedor: {result.get('provider')}")
        print(f"📊 Complejidad: {result.get('complexity')}")
        print(f"💬 Respuesta: {result.get('text', '')[:100]}...")
    
    # Mostrar métricas
    metrics = robot.get_metrics()
    print(f"\n📈 Métricas: {metrics}")

if __name__ == "__main__":
    asyncio.run(test_hybrid_robot())
