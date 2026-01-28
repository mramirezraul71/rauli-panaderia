import { db } from "./dataService";
import cashSession from "../core/CashSession";
import { formatCurrency, getBusinessConfig } from "../config/businessConfig";
import { getLanguageConfig } from "../config/languages";

// ══════════════════════════════════════════════════════════════════════════════
// SYSTEM CONTEXT - Estado actual de Caja e Inventario
// ══════════════════════════════════════════════════════════════════════════════

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
  let geminiKey = null;
  let geminiEnabled = false;
  let openaiKey = null;
  let openaiEnabled = false;
  let deepseekKey = null;
  let deepseekEnabled = false;
  let ollamaEnabled = false;
  let ollamaBaseUrl = DEFAULT_OLLAMA_BASE_URL;
  let ollamaModel = DEFAULT_OLLAMA_MODEL;
  let primaryProvider = "gemini";
  let baseUrl = DEFAULT_GEMINI_BASE_URL;
  let deepseekBaseUrl = DEFAULT_DEEPSEEK_BASE_URL;

  try {
    const gKey = await db.settings?.get("ai_api_key");
    const gEnabled = await db.settings?.get("gemini_enabled");
    const oKey = await db.settings?.get("openai_api_key");
    const oEnabled = await db.settings?.get("openai_enabled");
    const dKey = await db.settings?.get("deepseek_api_key");
    const dEnabled = await db.settings?.get("deepseek_enabled");
    const dUrl = await db.settings?.get("deepseek_base_url");
    const oLocalEnabled = await db.settings?.get("ollama_enabled");
    const oLocalBase = await db.settings?.get("ollama_base_url");
    const oLocalModel = await db.settings?.get("ollama_model");
    const primary = await db.settings?.get("primary_provider");
    const bUrl = await db.settings?.get("ai_base_url");

    if (gKey?.value) geminiKey = decodeKeyValue(gKey.value);
    if (oKey?.value) openaiKey = decodeKeyValue(oKey.value);
    if (dKey?.value) deepseekKey = decodeKeyValue(dKey.value);
    geminiEnabled = gEnabled?.value === "true" || gEnabled?.value === true;
    openaiEnabled = oEnabled?.value === "true" || oEnabled?.value === true;
    deepseekEnabled = dEnabled?.value === "true" || dEnabled?.value === true;
    ollamaEnabled = oLocalEnabled?.value === "true" || oLocalEnabled?.value === true;
    if (primary?.value) primaryProvider = primary.value;
    if (bUrl?.value && bUrl.value.trim()) {
      baseUrl = bUrl.value.trim();
    }
    if (dUrl?.value && dUrl.value.trim()) {
      deepseekBaseUrl = dUrl.value.trim();
    }
    if (oLocalBase?.value && oLocalBase.value.trim()) {
      ollamaBaseUrl = oLocalBase.value.trim();
    }
    if (oLocalModel?.value && oLocalModel.value.trim()) {
      ollamaModel = oLocalModel.value.trim();
    }
  } catch (e) {
    console.error("Config error:", e);
  }

  return {
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
  };
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
    const ctx = `Eres GENESIS, un asistente avanzado de gestión empresarial. ${languagePrompt} Usa el locale ${langConfig?.locale || "es-ES"} para fechas y moneda.
Perfil del negocio: Rubro "${businessType}", unidad base "${defaultUnit}", moneda "${businessConfig.currency}", impuesto ${businessConfig.taxRate}.` + context + systemContext;

    // FUNCION OLLAMA (local/offline)
    const tryOllama = async () => {
      if (!ollamaEnabled || !ollamaBaseUrl) return null;
      try {
        console.log("Ollama intentando...");
        const response = await fetch(`${ollamaBaseUrl.replace(/\/+$/, "")}/api/chat`, {
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
            return { text: msg.trim(), provider: "Ollama", model: ollamaModel || DEFAULT_OLLAMA_MODEL };
          }
        }
      } catch (e) {
        console.log("Error Ollama:", e.message);
      }
      return null;
    };

    // FUNCION GEMINI
    const tryGemini = async () => {
      if (!geminiEnabled || !geminiKey) return null;
      
      // Modelos en orden de prioridad (usando el formato exacto de Google)
      const models = [
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-pro",
        "gemini-2.0-flash"
      ];
      
      for (const modelId of models) {
        try {
          let url = buildGeminiUrl(baseUrl, modelId, geminiKey);
          console.log("Gemini intentando:", modelId);
          
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ 
                parts: [{ text: ctx + "\n\nUsuario: " + text }] 
              }],
              generationConfig: { 
                temperature: 0.7, 
                maxOutputTokens: 500,
                topP: 0.95
              }
            })
          });
          
          console.log("Gemini", modelId, "->", response.status);

          if (response.status === 404 && baseUrl !== DEFAULT_GEMINI_BASE_URL) {
            url = buildGeminiUrl(DEFAULT_GEMINI_BASE_URL, modelId, geminiKey);
            const retry = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: ctx + "\n\nUsuario: " + text }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 500, topP: 0.95 }
              })
            });
            if (retry.ok) {
              const data = await retry.json();
              const msg = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (msg) return { text: msg.trim(), provider: "Gemini", model: modelId };
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
              return { text: msg.trim(), provider: "Gemini", model: modelId };
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
        max_tokens: 500,
        temperature: 0.7
      };

      const sendDirect = async () => {
        if (!openaiKey) return null;
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
        return await fetch(OPENAI_PROXY_ENDPOINT, {
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
            return { text: msg.trim(), provider: "OpenAI", model: payload.model };
          }
        }
      } catch (e) {
        console.log("Error OpenAI:", e.message);
      }
      return null;
    };

    // FUNCION DEEPSEEK (económico)
    const tryDeepseek = async () => {
      if (!deepseekEnabled || !deepseekKey) return null;
      const payload = {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: ctx },
          { role: "user", content: text }
        ],
        max_tokens: 500,
        temperature: 0.7
      };
      try {
        console.log("DeepSeek intentando...");
        const response = await fetch(`${deepseekBaseUrl}/chat/completions`, {
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
            return { text: msg.trim(), provider: "DeepSeek", model: payload.model };
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

    // EJECUTAR EN ORDEN POR COMPLEJIDAD
    let result = null;
    const complexity = classifyTaskComplexity(text);
    const online = navigator.onLine;
    const chainByComplexity = {
      simple: online
        ? [tryGemini, tryDeepseek, tryOpenai, tryOllama]
        : [tryOllama],
      media: online
        ? [tryGemini, tryDeepseek, tryOpenai]
        : [tryOllama],
      alta: online
        ? [tryOpenai, tryDeepseek, tryGemini, tryOllama]
        : [tryOllama]
    };
    const chain = chainByComplexity[complexity] || (online ? [tryGemini, tryDeepseek, tryOpenai, tryOllama] : [tryOllama]);
    let balanceWarning = "";
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

    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
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
              temperature: 0.2,
              maxOutputTokens: 600
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const msg = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (msg) return { text: msg.trim(), action: null };
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
