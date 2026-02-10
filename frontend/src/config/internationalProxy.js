// Configuración Proxy Internacional - Cloudflare Worker
export const INTERNATIONAL_PROXY_CONFIG = {
  enabled: true,
  workerUrl: 'https://rauli-panaderia.mramirezraul71.workers.dev',
  endpoints: {
    gemini: '/api/gemini',
    deepseek: '/api/deepseek', 
    openai: '/api/openai',
    ollama: '/api/ollama',
    backend: '/api'
  },
  headers: {
    'X-Requested-With': 'RAULI-ERP',
    'X-Region': 'International',
    'X-Proxy-Version': '1.0.0'
  }
};
