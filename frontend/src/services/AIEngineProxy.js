// AI Engine con Proxy Internacional - Modificado para usar Cloudflare Worker
import { INTERNATIONAL_PROXY_CONFIG } from '../config/internationalProxy';

const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
const OPENAI_PROXY_ENDPOINT = "/api/ai/openai";
const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.1";
const AI_FETCH_TIMEOUT_MS = 12000;

const fetchWithTimeout = (url, options = {}, timeout = AI_FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal, cache: 'no-store' })
    .finally(() => clearTimeout(tid));
};

// Función para usar proxy
const proxyFetch = async (endpoint, options = {}) => {
  if (!INTERNATIONAL_PROXY_CONFIG.enabled) {
    return fetch(endpoint, options);
  }
  
  const proxyUrl = INTERNATIONAL_PROXY_CONFIG.workerUrl + endpoint;
  
  return fetchWithTimeout(proxyUrl, {
    ...options,
    headers: {
      ...options.headers,
      ...INTERNATIONAL_PROXY_CONFIG.headers
    }
  });
};

// Función Gemini con Proxy
const tryGemini = async (ctx, text, geminiKey, baseUrl) => {
  if (!geminiKey) return null;
  
  try {
    // Usar proxy en lugar de llamada directa
    const response = await proxyFetch('/api/gemini/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${geminiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: ctx + "\n\nUsuario: " + text }] }],
        generationConfig: { 
          temperature: 0.7, 
          maxOutputTokens: 500,
          topP: 0.95
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const msg = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (msg) {
        return { text: msg.trim(), provider: 'Gemini (Proxy)', model: 'gemini-1.5-flash' };
      }
    }
  } catch (e) {
    console.log("Error Gemini (Proxy):", e.message);
  }
  
  return null;
};

// Función DeepSeek con Proxy
const tryDeepseek = async (ctx, text, deepseekKey, deepseekBaseUrl) => {
  if (!deepseekKey) return null;
  
  try {
    const response = await proxyFetch('/api/deepseek/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: ctx },
          { role: "user", content: text }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const msg = data.choices?.[0]?.message?.content;
      if (msg) {
        return { text: msg.trim(), provider: 'DeepSeek (Proxy)', model: 'deepseek-chat' };
      }
    }
  } catch (e) {
    console.log("Error DeepSeek (Proxy):", e.message);
  }
  
  return null;
};

// Función OpenAI con Proxy
const tryOpenai = async (ctx, text, openaiKey) => {
  if (!openaiKey) return null;
  
  try {
    const response = await proxyFetch('/api/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: ctx },
          { role: "user", content: text }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const msg = data.choices?.[0]?.message?.content;
      if (msg) {
        return { text: msg.trim(), provider: 'OpenAI (Proxy)', model: 'gpt-4o-mini' };
      }
    }
  } catch (e) {
    console.log("Error OpenAI (Proxy):", e.message);
  }
  
  return null;
};

// Función Ollama con Proxy (si tienes servidor externo)
const tryOllama = async (ctx, text, ollamaBaseUrl, ollamaModel) => {
  try {
    const response = await proxyFetch('/api/ollama/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: ollamaModel || DEFAULT_OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: "system", content: ctx },
          { role: "user", content: text }
        ]
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const msg = data.message?.content;
      if (msg) {
        return { text: msg.trim(), provider: 'Ollama (Proxy)', model: ollamaModel || DEFAULT_OLLAMA_MODEL };
      }
    }
  } catch (e) {
    console.log("Error Ollama (Proxy):", e.message);
  }
  
  return null;
};

// Test del proxy
const testProxy = async () => {
  try {
    const response = await proxyFetch('/api/health');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Proxy funcionando:', data);
      return true;
    }
  } catch (e) {
    console.error('❌ Error en proxy:', e);
    return false;
  }
};

export {
  tryGemini,
  tryDeepseek,
  tryOpenai,
  tryOllama,
  testProxy
};
