import { db, logAudit } from "./dataService";
import { loadAIConfig } from "./aiConfigPersistence";
import cashSession from "../core/CashSession";
import { formatCurrency, getBusinessConfig } from "../config/businessConfig";
import { getLanguageConfig } from "../config/languages";
import { INTERNATIONAL_PROXY_CONFIG } from "../config/internationalProxy";
import { tryGemini, tryDeepseek, tryOpenai, tryOllama } from "./AIEngineProxy";

// ══════════════════════════════════════════════════════════════════════════════
// SYSTEM CONTEXT - Estado actual de Caja e Inventario
// ══════════════════════════════════════════════════════════════════════════════

const validateAndCleanResponse = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  // Eliminar repeticiones obvias
  let cleaned = text
    .replace(/(.{20,}?)\1{2,}/g, '$1') // Eliminar repeticiones de 20+ caracteres
    .replace(/(\b\w+\b)(?:\s+\1){2,}/g, '$1') // Eliminar palabras repetidas
    .replace(/\n{3,}/g, '\n\n') // Limitar saltos de línea
    .trim();
  
  // Truncar si es muy largo
  if (cleaned.length > 300) {
    cleaned = cleaned.substring(0, 297) + '...';
  }
  
  // Si parece incoherente, dar respuesta por defecto
  const incoherentPatterns = [
    /^(?:sí|no|ok|bien|entendido|claro|perfecto){3,}$/i,
    /^(?:a-zA-Z\s?){10,}$/, // Solo letras repetidas
    /^(?:\d+\s?){10,}$/ // Solo números repetidos
  ];
  
  if (incoherentPatterns.some(pattern => pattern.test(cleaned))) {
    return "Entendido. ¿En qué puedo ayudarte con la panadería?";
  }
  
  return cleaned;
};

const getSystemContext = async () => {
  try {
    // Estado de la Caja
    const currentSession = await cashSession.getCurrentSession();
    let cashInfo = "Caja cerrada";
    if (currentSession) {
      cashInfo = `Caja abierta: Efectivo disponible: ${formatCurrency(currentSession.expected_cash)}, Ventas del turno: ${formatCurrency(currentSession.total_sales)}`;
    }

    // Estado del Inventario
    const products = await db.products?.where("active").equals(1).toArray() || [];
    const totalProducts = products.length;
    const lowStockProducts = products.filter(p => (p.stock || 0) < 5);
    const outOfStockProducts = products.filter(p => (p.stock || 0) <= 0);
    const totalStockValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);

    const inventoryInfo = `Inventario: ${totalProducts} productos activos, ${lowStockProducts.length} con stock bajo (<5), ${outOfStockProducts.length} sin stock. Valor total del inventario: ${formatCurrency(totalStockValue)}`;

    return `\n\nCONTEXTO DEL SISTEMA (Estado actual):\n${cashInfo}\n${inventoryInfo}\n`;
  } catch (error) {
    console.error("Error obteniendo System Context:", error);
    return "\n\nCONTEXTO DEL SISTEMA: No disponible temporalmente.\n";
  }
};

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

// ══════════════════════════════════════════════════════════════════════════════
// OMNICHANNEL FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

const processVoice = async (audioBlob, context = "") => {
  if (!navigator.onLine) {
    const language = getBusinessConfig().appLanguage || "es";
    return localOfflineResponse("", language);
  }
  
  try {
    // Implementación futura: Speech-to-Text
    return {
      text: "Procesamiento de voz en desarrollo. Próximamente disponible.",
      action: null,
      placeholder: true
    };
  } catch (error) {
    return { text: "Error en procesamiento de voz", action: null };
  }
};

const processVision = async (imageFile, context = "") => {
  if (!navigator.onLine) {
    const language = getBusinessConfig().appLanguage || "es";
    return localOfflineResponse("", language);
  }
  
  try {
    // Usar funciones existentes de visión
    return await AIEngine.analyzeReceipt(imageFile);
  } catch (error) {
    return { text: "Error en procesamiento de visión", action: null };
  }
};

const decodeKeyValue = (value) => {
  if (!value) return null;
  try {
    return atob(value);
  } catch {
    return value;
  }
};

const buildGeminiUrl = (baseUrl, modelId, apiKey) => {
  const normalizedInput = (baseUrl || "").trim();
  if (!normalizedInput) {
    const endpoint = modelId === "gemini-pro"
      ? DEFAULT_GEMINI_ENDPOINT
      : `${DEFAULT_GEMINI_BASE_URL}/models/${modelId}:generateContent`;
    return `${endpoint}?key=${apiKey}`;
  }

  const normalized = normalizedInput.replace(/\/+$/, "");
  const isFullEndpoint = normalized.includes("/models/") && normalized.includes(":generateContent");
  if (isFullEndpoint) {
    return normalized.includes("?key=") ? normalized : `${normalized}?key=${apiKey}`;
  }
  const withVersion = /\/v1beta$|\/v1$/.test(normalized) ? normalized : `${normalized}/v1beta`;
  return `${withVersion}/models/${modelId}:generateContent?key=${apiKey}`;
};

const readImageAsDataUrl = (imageInput) => {
  if (!imageInput) return Promise.resolve(null);
  if (typeof imageInput === "string") return Promise.resolve(imageInput);
  if (imageInput.dataUrl) return Promise.resolve(imageInput.dataUrl);
  if (imageInput.base64) {
    const mimeType = imageInput.mimeType || "image/jpeg";
    return Promise.resolve(`data:${mimeType};base64,${imageInput.base64}`);
  }
  if (imageInput instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(imageInput);
    });
  }
  return Promise.resolve(null);
};

const getAiSettings = async () => {
  try {
    const cfg = await loadAIConfig();
    const oLocalEnabled = await db.settings?.get("ollama_enabled");
    const oLocalBase = await db.settings?.get("ollama_base_url");
    const oLocalModel = await db.settings?.get("ollama_model");

    return {
      geminiKey: cfg.geminiKey,
      geminiEnabled: cfg.geminiEnabled,
      openaiKey: cfg.openaiKey,
      openaiEnabled: cfg.openaiEnabled,
      deepseekKey: cfg.deepseekKey,
      deepseekEnabled: cfg.deepseekEnabled,
      ollamaEnabled: oLocalEnabled?.value === "true" || oLocalEnabled?.value === true,
      ollamaBaseUrl: oLocalBase?.value?.trim() || DEFAULT_OLLAMA_BASE_URL,
      ollamaModel: oLocalModel?.value?.trim() || DEFAULT_OLLAMA_MODEL,
      primaryProvider: cfg.primaryProvider || "gemini",
      baseUrl: cfg.baseUrl || DEFAULT_GEMINI_BASE_URL,
      deepseekBaseUrl: cfg.deepseekBaseUrl || DEFAULT_DEEPSEEK_BASE_URL
    };
  } catch (e) {
    console.error("Config error:", e);
    return {
      geminiKey: null,
      geminiEnabled: false,
      openaiKey: null,
      openaiEnabled: false,
      deepseekKey: null,
      deepseekEnabled: false,
      ollamaEnabled: false,
      ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,
      ollamaModel: DEFAULT_OLLAMA_MODEL,
      primaryProvider: "gemini",
      baseUrl: DEFAULT_GEMINI_BASE_URL,
      deepseekBaseUrl: DEFAULT_DEEPSEEK_BASE_URL
    };
  }
};

const localOfflineResponse = (text, language = "es") => {
  const offlineMessages = {
    es: "Modo offline activado. Puedo responder de forma básica mientras vuelve la conexión. Dime qué necesitas con datos locales.",
    en: "Offline mode enabled. I can respond in a basic way while the connection returns. Tell me what you need with local data.",
    pt: "Modo offline ativado. Posso responder de forma básica enquanto a conexão volta. Diga o que você precisa com dados locais.",
    fr: "Mode hors ligne activé. Je peux répondre de façon basique en attendant la connexion. Dites-moi ce dont vous avez besoin avec les données locales.",
    de: "Offline-Modus aktiviert. Ich kann vorübergehend einfache Antworten geben. Sag mir, was du mit lokalen Daten brauchst.",
    it: "Modalità offline attiva. Posso rispondere in modo semplice finché la connessione torna. Dimmi cosa ti serve con i dati locali.",
    ru: "Офлайн-режим включен. Я могу отвечать базово, пока соединение не восстановится. Скажи, что нужно с локальными данными.",
    ar: "تم تفعيل وضع عدم الاتصال. يمكنني الرد بشكل أساسي حتى يعود الاتصال. أخبرني بما تحتاجه من البيانات المحلية.",
    zh: "离线模式已启用。连接恢复前我只能做基础回复。告诉我你需要哪些本地数据。",
    ja: "オフラインモードです。接続が戻るまで簡易応答のみ可能です。ローカルデータで何が必要か教えてください。",
    ko: "오프라인 모드입니다. 연결이 복구될 때까지 기본 응답만 가능합니다. 로컬 데이터로 필요한 것을 알려주세요.",
    hi: "ऑफ़लाइन मोड सक्रिय है। कनेक्शन लौटने तक मैं बुनियादी जवाब दे सकता हूँ। स्थानीय डेटा से आपको क्या चाहिए बताएं।"
  };
  return {
    text: offlineMessages[language] || offlineMessages.es,
    action: null,
    offline: true,
    echo: text || ""
  };
};

const getLanguageInstructions = (language) => {
  const instructions = {
    es: "Responde en español. Sé claro, profesional y conciso.",
    en: "Respond in English. Be clear, professional, and concise.",
    pt: "Responda em português. Seja claro, profissional e conciso.",
    fr: "Répondez en français. Soyez clair, professionnel et concis.",
    de: "Antworte auf Deutsch. Sei klar, professionell und prägnant.",
    it: "Rispondi in italiano. Sii chiaro, professionale e conciso.",
    ru: "Отвечай на русском. Будь ясным, профессиональным и лаконичным.",
    ar: "أجب باللغة العربية. كن واضحًا ومهنيًا ومختصرًا.",
    zh: "请用中文回答，表达清晰、专业、简洁。",
    ja: "日本語で回答してください。明確で専門的かつ簡潔に。",
    ko: "한국어로 답변하세요. 명확하고 전문적이며 간결하게.",
    hi: "हिंदी में उत्तर दें। स्पष्ट, पेशेवर और संक्षिप्त रहें।"
  };
  return instructions[language] || instructions.es;
};

const classifyTaskComplexity = (text = "") => {
  const input = String(text || "").trim();
  if (!input) return "simple";
  const lengthScore = input.length > 240 ? 2 : input.length > 120 ? 1 : 0;
  const complexHints = /(analiza|estrategia|plan|audita|optimiza|pipeline|arquitectura|comparativo|diagnóstico|riesgo|proyecci[oó]n|modelo financiero|legal|pol[ií]tica|compliance|kpi|forecast|integraci[oó]n|migraci[oó]n|optimización)/i;
  const mediumHints = /(reporte|resumen|explica|detalle|consulta|configura|pasos|procedimiento|documenta|inventario|ventas|compras|contabilidad|producción|calidad)/i;
  let score = lengthScore;
  if (complexHints.test(input)) score += 2;
  if (mediumHints.test(input)) score += 1;
  if (score >= 3) return "alta";
  if (score === 2) return "media";
  return "simple";
};

export const AIEngine = {
  processInput: async ({ text = "", voiceBlob = null, imageFile = null, context = "" } = {}) => {
    if (voiceBlob) return await AIEngine.processVoice(voiceBlob, context);
    if (imageFile) return await AIEngine.processVision(imageFile, context);
    return await AIEngine.processText(text, context);
  },
  processText: async (text, context = "", imageBase64 = null) => {
    const {
      geminiKey,
      geminiEnabled,
      openaiKey,
      openaiEnabled,
      deepseekKey,
      deepseekEnabled,
      ollamaEnabled,
      ollamaBaseUrl,
      ollamaModel,
      primaryProvider,
      baseUrl,
      deepseekBaseUrl
    } = await getAiSettings();

    const allowOpenaiProxy = true;
    if (!geminiKey && !openaiKey && !allowOpenaiProxy) {
      return { text: "Configura una API Key en Configuracion.", action: null };
    }

    // Obtener System Context (estado de caja e inventario)
    const systemContext = await getSystemContext();

    const businessConfig = getBusinessConfig();
    const language = businessConfig.appLanguage || "es";
    const langConfig = getLanguageConfig(language);
    const languagePrompt = getLanguageInstructions(language);
    const businessType = businessConfig.businessType || "cualquier negocio";
    const defaultUnit = businessConfig.defaultUnit || "unidad";
    const ctx = `Eres RAULI, asistente de panadería. ${languagePrompt} Responde de forma breve y directa (máximo 2-3 frases). Negocio: ${businessType}, moneda: ${businessConfig.currency}.` + context + systemContext;

    // FUNCION OLLAMA (local/offline)
    const tryOllama = async () => {
      if (!ollamaEnabled || !ollamaBaseUrl) return null;
      try {
        console.log("Ollama intentando...");
        const response = await fetchWithTimeout(`${ollamaBaseUrl.replace(/\/+$/, "")}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: ollamaModel || DEFAULT_OLLAMA_MODEL,
            stream: false,
            messages: [
              { role: "system", content: ctx },
              { role: "user", content: text }
            ]
          })
        });
        console.log("Ollama ->", response.status);
        if (response.ok) {
          const data = await response.json();
          const msg = data.message?.content;
          if (msg) {
            console.log("OK Ollama");
            return { text: validateAndCleanResponse(msg.trim()), provider: "Ollama", model: ollamaModel || DEFAULT_OLLAMA_MODEL };
          }
        }
      } catch (e) {
        console.log("Error Ollama:", e.message);
      }
      return null;
    };

    // FUNCION GEMINI CON PROXY
    const tryGemini = async () => {
      if (!geminiEnabled || !geminiKey) return null;
      
      // Orden: más estables y rápidos primero
      const models = [
        "gemini-1.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-pro",
        "gemini-1.5-pro",
        "gemini-2.5-flash-lite"
      ];
      
      for (const modelId of models) {
        try {
          let url = buildGeminiUrl(baseUrl, modelId, geminiKey);
          console.log("Gemini intentando:", modelId);
          
          const response = await fetchWithTimeout(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ 
                parts: [{ text: ctx + "\n\nUsuario: " + text }] 
              }],
              generationConfig: { 
                temperature: 0.3, 
                maxOutputTokens: 200,
                topP: 0.8
              }
            })
          });
          
          console.log("Gemini", modelId, "->", response.status);

          if (response.status === 404 && baseUrl !== DEFAULT_GEMINI_BASE_URL) {
            url = buildGeminiUrl(DEFAULT_GEMINI_BASE_URL, modelId, geminiKey);
            const retry = await fetchWithTimeout(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: ctx + "\n\nUsuario: " + text }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 200, topP: 0.8 }
              })
            });
            if (retry.ok) {
              const data = await retry.json();
              const msg = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (msg) return { text: validateAndCleanResponse(msg.trim()), provider: "Gemini", model: modelId };
            }
          }
          
          if (response.status === 429) {
            console.log("Rate limit en", modelId);
            continue;
          }
          
          if (response.ok) {
            const data = await response.json();
            const msg = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (msg) {
              console.log("OK Gemini con:", modelId);
              return { text: validateAndCleanResponse(msg.trim()), provider: "Gemini", model: modelId };
            }
          }
        } catch (e) { 
          console.log("Error Gemini", modelId, ":", e.message); 
        }
      }
      return null;
    };

    // FUNCION OPENAI
    const tryOpenai = async () => {
      if (!openaiEnabled && !allowOpenaiProxy) return null;

      const payload = {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: ctx },
          { role: "user", content: text }
        ],
        max_tokens: 200,
        temperature: 0.3
      };

      const sendDirect = async () => {
        if (!openaiKey) return null;
        const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + openaiKey
          },
          body: JSON.stringify(payload)
        });
        return response;
      };

      const sendProxy = async () => {
        if (!allowOpenaiProxy) return null;
        return await fetchWithTimeout(OPENAI_PROXY_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: "/v1/chat/completions", payload })
        });
      };

      try {
        console.log("OpenAI intentando...");
        const response = await (openaiKey ? sendDirect() : sendProxy());
        if (!response) return null;
        console.log("OpenAI ->", response.status);
        if (response.ok) {
          const data = await response.json();
          const msg = data.choices?.[0]?.message?.content;
          if (msg) {
            console.log("OK OpenAI");
            return { text: validateAndCleanResponse(msg.trim()), provider: "OpenAI", model: payload.model };
          }
        }
      } catch (e) {
        console.log("Error OpenAI:", e.message);
      }
      return null;
    };

    // FUNCION DEEPSEEK CON PROXY
    const tryDeepseekOriginal = async () => {
      if (!deepseekEnabled || !deepseekKey) return null;
      const payload = {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: ctx },
          { role: "user", content: text }
        ],
        max_tokens: 200,
        temperature: 0.3
      };
      try {
        console.log("DeepSeek intentando...");
        const response = await fetchWithTimeout(`${deepseekBaseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + deepseekKey
          },
          body: JSON.stringify(payload)
        });
        console.log("DeepSeek ->", response.status);
        if (response.ok) {
          const data = await response.json();
          const msg = data.choices?.[0]?.message?.content;
          if (msg) {
            console.log("OK DeepSeek");
            return { text: validateAndCleanResponse(msg.trim()), provider: "DeepSeek", model: payload.model };
          }
        }
        if (response.status === 402 || response.status === 429) {
          const data = await response.json().catch(() => ({}));
          const message = data?.error?.message || "";
          if (/insufficient|balance|quota/i.test(message)) {
            return { text: "__DEEPSEEK_BALANCE__", action: null };
          }
        }
      } catch (e) {
        console.log("Error DeepSeek:", e.message);
      }
      return null;
    };

    // EJECUTAR EN ORDEN POR COMPLEJIDAD CON PROXY
    let result = null;
    const complexity = classifyTaskComplexity(text);
    const online = navigator.onLine;
    
    // Determinar si usar proxy
    const useProxy = INTERNATIONAL_PROXY_CONFIG.enabled;
    
    const chainByComplexity = {
      simple: online
        ? useProxy ? [tryGemini, tryDeepseek, tryOpenai, tryOllama] : [tryGeminiOriginal, tryDeepseekOriginal, tryOpenaiProxy, tryOllama]
        : [tryOllama],
      media: online
        ? useProxy ? [tryGemini, tryDeepseek, tryOpenai] : [tryGeminiOriginal, tryDeepseekOriginal, tryOpenaiProxy]
        : [tryOllama],
      alta: online
        ? useProxy ? [tryOpenai, tryDeepseek, tryGemini, tryOllama] : [tryOpenaiProxy, tryDeepseekOriginal, tryGeminiOriginal, tryOllama]
        : [tryOllama]
    };
    
    const chain = chainByComplexity[complexity] || (online ? (useProxy ? [tryGemini, tryDeepseek, tryOpenai, tryOllama] : [tryGeminiOriginal, tryDeepseekOriginal, tryOpenaiProxy, tryOllama]) : [tryOllama]);
    let balanceWarning = "";
    
    console.log(`🤖 Usando proxy: ${useProxy ? 'SÍ' : 'NO'} - Complejidad: ${complexity}`);
    
    for (const runner of chain) {
      const attempt = await runner();
      if (attempt && typeof attempt === "object" && attempt.text === "__DEEPSEEK_BALANCE__") {
        balanceWarning = "Saldo insuficiente en DeepSeek. Continué con otro motor.";
        continue;
      }
      if (attempt) {
        result = attempt;
        break;
      }
    }

    if (result) {
      const prefix = balanceWarning ? `${balanceWarning}\n\n` : "";
      const modelLabel = result.provider ? `Modelo activo: ${result.provider}${result.model ? ` (${result.model})` : ""}` : "";
      const header = modelLabel ? `${modelLabel}\n` : "";
      return { text: `${header}${prefix}${result.text || result}`, action: null };
    }

    if (!navigator.onLine) {
      const language = getBusinessConfig().appLanguage || "es";
      return localOfflineResponse(text, language);
    }

    return { text: "No se pudo conectar. Verifica tu configuracion de IA.", action: null };
  },

  processVoice: async (audioBlob, context = "") => {
    if (!navigator.onLine) {
      const language = getBusinessConfig().appLanguage || "es";
      return localOfflineResponse("", language);
    }
    return {
      text: "Procesamiento de voz en preparación. Por ahora puedo responder texto.",
      action: null
    };
  },

  processVision: async (imageFile, context = "") => {
    if (!navigator.onLine) {
      const language = getBusinessConfig().appLanguage || "es";
      return localOfflineResponse("", language);
    }
    const settings = await getAiSettings();
    if (!settings.geminiEnabled || !settings.geminiKey) {
      return { text: "Configura la API Key de Gemini para usar visión.", action: null };
    }

    const imageDataUrl = await readImageAsDataUrl(imageFile);
    if (!imageDataUrl) {
      return { text: "No se pudo leer la imagen enviada.", action: null };
    }

    const mimeType = imageDataUrl.match(/data:([^;]+)/)?.[1] || "image/jpeg";
    const base64Data = imageDataUrl.split(",")[1] || "";
    const prompt = `Analiza la imagen y responde en español con un resumen claro y útil para el negocio. ${context || ""}`.trim();

    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
    for (const modelId of models) {
      try {
        const url = buildGeminiUrl(settings.baseUrl, modelId, settings.geminiKey);
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64Data } }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 150
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const msg = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (msg) return { text: validateAndCleanResponse(msg.trim()), action: null };
        }
      } catch (error) {
        console.log("Error Vision", modelId, ":", error.message);
      }
    }

    return { text: "No pude analizar la imagen. Intenta nuevamente.", action: null };
  },

  testConnection: async () => {
    const result = await AIEngine.processText("Responde unicamente: OK");
    const ok = result.text.toLowerCase().includes("ok") || 
               (!result.text.includes("No se pudo") && !result.text.includes("Configura"));
    return { success: ok, message: result.text };
  }
};

export default AIEngine;
