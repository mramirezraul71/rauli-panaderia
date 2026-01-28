/**
 * ══════════════════════════════════════════════════════════════════════════════
 * GENESIS - AI ENGINE v2.0 (PRODUCTION)
 * ══════════════════════════════════════════════════════════════════════════════
 * Hybrid AI Engine with:
 * - Function Calling (JSON ejecutable)
 * - Vision/Multimodal (OCR de facturas, análisis de daños)
 * - Offline Fallback (NLP local)
 * 
 * Providers: Google Gemini, OpenAI GPT-4
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { db } from '../services/dataService';
import { getBusinessConfig } from '../config/businessConfig';

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

export const AI_PROVIDERS = {
  GEMINI: 'gemini',
  OPENAI: 'openai',
  OFFLINE: 'offline'
};

export const AI_MODELS = {
  gemini: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Rápido)', vision: true },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Potente)', vision: true },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)', vision: true }
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Económico)', vision: true },
    { id: 'gpt-4o', name: 'GPT-4o (Potente)', vision: true },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', vision: true }
  ]
};

export const AI_ACTIONS = {
  // Conversational
  SPEAK: 'SPEAK',
  
  // POS Actions
  ADD_TO_CART: 'ADD_TO_CART',
  REMOVE_FROM_CART: 'REMOVE_FROM_CART',
  CLEAR_CART: 'CLEAR_CART',
  PROCESS_SALE: 'PROCESS_SALE',
  
  // Product Management
  CREATE_PRODUCT: 'CREATE_PRODUCT',
  UPDATE_STOCK: 'UPDATE_STOCK',
  SEARCH_PRODUCT: 'SEARCH_PRODUCT',
  
  // Queries
  QUERY_SALES: 'QUERY_SALES',
  QUERY_INVENTORY: 'QUERY_INVENTORY',
  QUERY_CREDITS: 'QUERY_CREDITS',
  QUERY_EXPENSES: 'QUERY_EXPENSES',
  
  // Navigation
  NAVIGATE: 'NAVIGATE',
  
  // Customer Management
  CREATE_CUSTOMER: 'CREATE_CUSTOMER',
  RECORD_PAYMENT: 'RECORD_PAYMENT',
  
  // Reports
  SHOW_REPORT: 'SHOW_REPORT',
  
  // Expense (from OCR)
  ADD_EXPENSE: 'ADD_EXPENSE',
  
  // Shrinkage
  RECORD_SHRINKAGE: 'RECORD_SHRINKAGE'
};

// ══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPTS
// ══════════════════════════════════════════════════════════════════════════════

const FUNCTION_CALLING_PROMPT = `Eres GENESIS, un asistente avanzado de gestión empresarial del sistema ERP para negocios dominicanos de cualquier rubro.

REGLAS CRÍTICAS:
1. SIEMPRE responde en formato JSON válido
2. Tu respuesta debe ser una ACCIÓN ejecutable
3. Si no entiendes, usa action: "SPEAK" con un mensaje de ayuda

ACCIONES DISPONIBLES:
- ADD_TO_CART: Agregar productos. Formato: { action: "ADD_TO_CART", items: [{ name: "producto", quantity: 2 }] }
- REMOVE_FROM_CART: Quitar productos. Formato: { action: "REMOVE_FROM_CART", product_name: "producto" }
- CLEAR_CART: Vaciar carrito. Formato: { action: "CLEAR_CART" }
- PROCESS_SALE: Cobrar. Formato: { action: "PROCESS_SALE", payment_method: "efectivo|tarjeta|credito" }
- QUERY_SALES: Consultar ventas. Formato: { action: "QUERY_SALES", period: "hoy|semana|mes" }
- QUERY_INVENTORY: Consultar inventario. Formato: { action: "QUERY_INVENTORY", product_name?: string }
- QUERY_CREDITS: Consultar créditos. Formato: { action: "QUERY_CREDITS", customer_name?: string }
- NAVIGATE: Navegar. Formato: { action: "NAVIGATE", route: "/pos|/sales|/products|/customers|/credits|/expenses|/cash|/settings" }
- CREATE_PRODUCT: Crear producto. Formato: { action: "CREATE_PRODUCT", name: string, price: number, cost?: number }
- CREATE_CUSTOMER: Crear cliente. Formato: { action: "CREATE_CUSTOMER", name: string, phone?: string }
- RECORD_PAYMENT: Registrar abono. Formato: { action: "RECORD_PAYMENT", customer_name: string, amount: number }
- ADD_EXPENSE: Registrar gasto. Formato: { action: "ADD_EXPENSE", vendor: string, amount: number, category?: string, description?: string }
- SPEAK: Solo responder. Formato: { action: "SPEAK", text: "mensaje" }

EJEMPLOS:
Usuario: "Vende 3 productos y 2 servicios"
Respuesta: { "action": "ADD_TO_CART", "items": [{ "name": "Producto A", "quantity": 3 }, { "name": "Servicio B", "quantity": 2 }] }

Usuario: "Cuánto se vendió hoy"
Respuesta: { "action": "QUERY_SALES", "period": "hoy" }

Usuario: "Cóbrale en efectivo"
Respuesta: { "action": "PROCESS_SALE", "payment_method": "efectivo" }

Usuario: "Cuánto debe María"
Respuesta: { "action": "QUERY_CREDITS", "customer_name": "María" }

Usuario: "Llévame a gastos"
Respuesta: { "action": "NAVIGATE", "route": "/expenses" }

Usuario: "Hola, qué puedes hacer?"
Respuesta: { "action": "SPEAK", "text": "¡Hola! Puedo ayudarte a vender productos, consultar ventas, registrar gastos, y más. ¿Qué necesitas?" }

CONTEXTO DEL NEGOCIO:
`;

const RECEIPT_OCR_PROMPT = `Analiza esta imagen de factura/recibo y extrae la información estructurada.

INSTRUCCIONES:
1. Identifica el tipo de documento (factura, recibo, ticket, nota de compra)
2. Extrae TODOS los datos visibles
3. Responde ÚNICAMENTE con JSON válido

FORMATO DE RESPUESTA:
{
  "success": true,
  "document_type": "factura|recibo|ticket|nota",
  "vendor": {
    "name": "Nombre del comercio",
    "rnc": "RNC si visible",
    "address": "Dirección si visible",
    "phone": "Teléfono si visible"
  },
  "transaction": {
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "invoice_number": "Número de factura",
    "ncf": "NCF si visible"
  },
  "items": [
    {
      "description": "Descripción del producto",
      "quantity": 1,
      "unit_price": 0.00,
      "total": 0.00
    }
  ],
  "totals": {
    "subtotal": 0.00,
    "tax": 0.00,
    "tax_rate": 18,
    "discount": 0.00,
    "total": 0.00
  },
  "payment": {
    "method": "efectivo|tarjeta|transferencia",
    "amount_paid": 0.00,
    "change": 0.00
  },
  "suggested_category": "alimentos|servicios|suministros|equipos|otros",
  "confidence": 0.95
}

Si no puedes leer algún campo, usa null.
Si la imagen no es una factura/recibo, responde:
{
  "success": false,
  "error": "La imagen no parece ser una factura o recibo",
  "document_type": null
}`;

const DAMAGE_ASSESSMENT_PROMPT = `Evalúa el daño del producto en esta imagen para registro de merma/pérdida.

Responde ÚNICAMENTE en JSON:
{
  "success": true,
  "assessment": {
    "damage_type": "vencido|roto|contaminado|defectuoso|otro",
    "severity": "leve|moderado|severo|total",
    "salvageable": false,
    "description": "Descripción del daño observado",
    "recommended_action": "descartar|devolver|reparar|donar"
  },
  "product_identified": "Nombre del producto si es identificable",
  "confidence": 0.9
}`;

// ══════════════════════════════════════════════════════════════════════════════
// AI ENGINE CLASS
// ══════════════════════════════════════════════════════════════════════════════

class AIEngine {
  constructor() {
    this.provider = AI_PROVIDERS.OFFLINE;
    this.apiKey = null;
    this.model = null;
    this.conversationHistory = [];
    this.businessContext = null;
    this.maxHistoryLength = 10;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ════════════════════════════════════════════════════════════════════════════

  async loadConfig() {
    try {
      const config = await db.settings?.get('ai_config');
      if (config?.value) {
        const parsed = JSON.parse(config.value);
        this.provider = parsed.provider || AI_PROVIDERS.OFFLINE;
        this.apiKey = parsed.apiKey ? this.decrypt(parsed.apiKey) : null;
        this.model = parsed.model;
      }
    } catch (error) {
      console.error('Failed to load AI config:', error);
      this.provider = AI_PROVIDERS.OFFLINE;
    }
  }

  async saveConfig(provider, apiKey, model) {
    try {
      await db.settings?.put({
        key: 'ai_config',
        value: JSON.stringify({
          provider,
          apiKey: apiKey ? this.encrypt(apiKey) : null,
          model
        })
      });
      this.provider = provider;
      this.apiKey = apiKey;
      this.model = model;
    } catch (error) {
      console.error('Failed to save AI config:', error);
      throw error;
    }
  }

  encrypt(text) {
    return btoa(encodeURIComponent(text));
  }

  decrypt(text) {
    try {
      return decodeURIComponent(atob(text));
    } catch {
      return text;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BUSINESS CONTEXT
  // ════════════════════════════════════════════════════════════════════════════

  async loadBusinessContext() {
    try {
      const businessConfig = getBusinessConfig();
      const businessType = businessConfig.businessType || "General";
      const defaultUnit = businessConfig.defaultUnit || "unidad";
      const products = await db.products?.where('active').equals(1).limit(50).toArray() || [];
      const productList = products.map(p => `${p.name} ($${p.price})`).join(', ');
      
      const todaySales = await db.sales?.filter(s => 
        s.created_at?.startsWith(new Date().toISOString().split('T')[0])
      ).toArray() || [];
      
      const customersWithDebt = await db.customers?.filter(c => 
        c.active === 1 && (c.balance || 0) > 0
      ).toArray() || [];

      this.businessContext = `
PERFIL DEL NEGOCIO:
RUBRO: ${businessType}
UNIDAD BASE: ${defaultUnit}
MONEDA: ${businessConfig.currency}
IMPUESTO: ${businessConfig.taxRate}
PRODUCTOS DISPONIBLES: ${productList || 'No hay productos'}
VENTAS HOY: ${todaySales.length} ventas
CLIENTES CON DEUDA: ${customersWithDebt.length} clientes`;

      return this.businessContext;
    } catch (error) {
      console.error('Failed to load business context:', error);
      this.businessContext = '';
      return '';
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TEXT PROCESSING (Function Calling)
  // ════════════════════════════════════════════════════════════════════════════

  async processText(userMessage, additionalContext = '') {
    await this.loadConfig();
    await this.loadBusinessContext();

    // Add to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });

    // Trim history
    if (this.conversationHistory.length > this.maxHistoryLength * 2) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength * 2);
    }

    // Route to appropriate provider
    try {
      let result;
      
      if (this.provider === AI_PROVIDERS.OFFLINE || !this.apiKey) {
        result = await this.processOffline(userMessage);
      } else if (this.provider === AI_PROVIDERS.GEMINI) {
        result = await this.processWithGemini(userMessage, additionalContext);
      } else if (this.provider === AI_PROVIDERS.OPENAI) {
        result = await this.processWithOpenAI(userMessage, additionalContext);
      } else {
        result = await this.processOffline(userMessage);
      }

      // Add response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: JSON.stringify(result),
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      console.error('AI processing error:', error);
      // Fallback to offline
      return await this.processOffline(userMessage);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GOOGLE GEMINI
  // ════════════════════════════════════════════════════════════════════════════

  async processWithGemini(userMessage, additionalContext = '') {
    const model = this.model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const systemPrompt = FUNCTION_CALLING_PROMPT + this.businessContext + '\n' + additionalContext;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: '{"action": "SPEAK", "text": "Entendido. Estoy listo para ayudarte."}' }] },
          ...this.conversationHistory.slice(-6).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          }))
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
          topP: 0.8
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return this.parseAIResponse(text);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // OPENAI GPT
  // ════════════════════════════════════════════════════════════════════════════

  async processWithOpenAI(userMessage, additionalContext = '') {
    const model = this.model || 'gpt-4o-mini';
    
    const systemPrompt = FUNCTION_CALLING_PROMPT + this.businessContext + '\n' + additionalContext;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...this.conversationHistory.slice(-6).map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    return this.parseAIResponse(text);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VISION PROCESSING (OCR / Damage Assessment)
  // ════════════════════════════════════════════════════════════════════════════

  async analyzeReceipt(imageDataUrl) {
    await this.loadConfig();

    if (this.provider === AI_PROVIDERS.OFFLINE || !this.apiKey) {
      return {
        success: false,
        error: 'IA no configurada. Configure una API Key en Ajustes.',
        offline: true
      };
    }

    try {
      const base64Data = imageDataUrl.split(',')[1];
      const mimeType = imageDataUrl.match(/data:([^;]+)/)?.[1] || 'image/jpeg';

      if (this.provider === AI_PROVIDERS.GEMINI) {
        return await this.visionGemini(base64Data, mimeType, RECEIPT_OCR_PROMPT);
      } else if (this.provider === AI_PROVIDERS.OPENAI) {
        return await this.visionOpenAI(imageDataUrl, RECEIPT_OCR_PROMPT);
      }
    } catch (error) {
      console.error('Receipt analysis error:', error);
      return { success: false, error: error.message };
    }
  }

  async assessDamage(imageDataUrl) {
    await this.loadConfig();

    if (this.provider === AI_PROVIDERS.OFFLINE || !this.apiKey) {
      return {
        success: false,
        error: 'IA no configurada',
        offline: true
      };
    }

    try {
      const base64Data = imageDataUrl.split(',')[1];
      const mimeType = imageDataUrl.match(/data:([^;]+)/)?.[1] || 'image/jpeg';

      if (this.provider === AI_PROVIDERS.GEMINI) {
        return await this.visionGemini(base64Data, mimeType, DAMAGE_ASSESSMENT_PROMPT);
      } else if (this.provider === AI_PROVIDERS.OPENAI) {
        return await this.visionOpenAI(imageDataUrl, DAMAGE_ASSESSMENT_PROMPT);
      }
    } catch (error) {
      console.error('Damage assessment error:', error);
      return { success: false, error: error.message };
    }
  }

  async visionGemini(base64Data, mimeType, prompt) {
    const model = this.model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini Vision error');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return this.parseAIResponse(text);
  }

  async visionOpenAI(imageDataUrl, prompt) {
    const model = this.model || 'gpt-4o-mini';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } }
          ]
        }],
        max_tokens: 2000,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI Vision error');
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    return this.parseAIResponse(text);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // OFFLINE NLP (Fallback)
  // ════════════════════════════════════════════════════════════════════════════

  async processOffline(userMessage) {
    const msg = userMessage.toLowerCase().trim();

    // Ventas patterns
    if (/vend[ea]|agrega|pon|dame|quiero/.test(msg)) {
      const items = this.extractProductsFromText(msg);
      if (items.length > 0) {
        return { action: AI_ACTIONS.ADD_TO_CART, items };
      }
    }

    // Cobrar
    if (/cobra|paga|efectivo|tarjeta|credito/.test(msg)) {
      let method = 'efectivo';
      if (/tarjeta/.test(msg)) method = 'tarjeta';
      if (/credito|fiado/.test(msg)) method = 'credito';
      return { action: AI_ACTIONS.PROCESS_SALE, payment_method: method };
    }

    // Queries
    if (/cuánto|cuanto|vendió|vendio|ventas/.test(msg)) {
      return { action: AI_ACTIONS.QUERY_SALES, period: 'hoy' };
    }

    if (/inventario|stock|productos|hay/.test(msg)) {
      return { action: AI_ACTIONS.QUERY_INVENTORY };
    }

    if (/debe|crédito|credito|fiado/.test(msg)) {
      return { action: AI_ACTIONS.QUERY_CREDITS };
    }

    // Navigation
    if (/ir a|llévame|llevame|abre|abrir/.test(msg)) {
      if (/venta|pos/.test(msg)) return { action: AI_ACTIONS.NAVIGATE, route: '/pos' };
      if (/gasto/.test(msg)) return { action: AI_ACTIONS.NAVIGATE, route: '/expenses' };
      if (/cliente/.test(msg)) return { action: AI_ACTIONS.NAVIGATE, route: '/customers' };
      if (/caja/.test(msg)) return { action: AI_ACTIONS.NAVIGATE, route: '/cash' };
      if (/producto/.test(msg)) return { action: AI_ACTIONS.NAVIGATE, route: '/products' };
      if (/config|ajuste/.test(msg)) return { action: AI_ACTIONS.NAVIGATE, route: '/settings' };
    }

    // Clear cart
    if (/vacía|vacia|limpia|borra|cancela/.test(msg) && /carrito|venta/.test(msg)) {
      return { action: AI_ACTIONS.CLEAR_CART };
    }

    // Default: speak
    return {
      action: AI_ACTIONS.SPEAK,
      text: 'Lo siento, no entendí. Puedes decir cosas como "vende 2 productos", "cuánto se vendió hoy", o "llévame a gastos".'
    };
  }

  extractProductsFromText(text) {
    const items = [];
    
    // Patterns like "3 productos", "2 servicios"
    const pattern = /(\d+)\s+(\w+)/g;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      items.push({
        name: match[2],
        quantity: parseInt(match[1])
      });
    }

    // If no quantity found, try just product names
    if (items.length === 0) {
      const words = text.split(/\s+/);
      for (const word of words) {
        if (word.length > 2 && !/vend|agrega|pon|dame|quiero|y|de|el|la|un|una/.test(word)) {
          items.push({ name: word, quantity: 1 });
        }
      }
    }

    return items;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RESPONSE PARSER
  // ════════════════════════════════════════════════════════════════════════════

  parseAIResponse(text) {
    try {
      let cleaned = text.trim();
      cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
      
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        action: AI_ACTIONS.SPEAK,
        text: cleaned || 'No pude procesar la respuesta.'
      };
    } catch (error) {
      console.error('Parse error:', error);
      return {
        action: AI_ACTIONS.SPEAK,
        text: text || 'Error al procesar respuesta.'
      };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TEST CONNECTION
  // ════════════════════════════════════════════════════════════════════════════

  async testConnection(provider, apiKey, model) {
    try {
      if (provider === AI_PROVIDERS.GEMINI) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Responde solo: OK' }] }],
            generationConfig: { maxOutputTokens: 10 }
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Error de conexión');
        }
        
        return { success: true, message: 'Conexión exitosa con Gemini' };
      } 
      
      if (provider === AI_PROVIDERS.OPENAI) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Responde solo: OK' }],
            max_tokens: 10
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Error de conexión');
        }
        
        return { success: true, message: 'Conexión exitosa con OpenAI' };
      }

      return { success: true, message: 'Modo offline activo' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STATUS
  // ════════════════════════════════════════════════════════════════════════════

  async getStatus() {
    await this.loadConfig();
    return {
      provider: this.provider,
      model: this.model,
      hasApiKey: !!this.apiKey,
      isOnline: navigator.onLine,
      historyLength: this.conversationHistory.length
    };
  }

  clearHistory() {
    this.conversationHistory = [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ══════════════════════════════════════════════════════════════════════════════

export const aiEngine = new AIEngine();
export default aiEngine;
