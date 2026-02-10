// Cloudflare Worker - Proxy para operaciones internacionales
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    
    // Headers de enmascaramiento - apariencia de US
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'X-Forwarded-For': '8.8.8.8', // IP US
      'X-Real-IP': '8.8.8.8',
      'CF-IPCountry': 'US',
      'CF-Ray': crypto.randomUUID(),
      'X-RAULI-Proxy': 'v1.0',
      'X-Region': 'International'
    };
    
    // Mantener headers importantes del request original
    if (request.headers.get('Authorization')) {
      headers['Authorization'] = request.headers.get('Authorization');
    }
    if (request.headers.get('Content-Type')) {
      headers['Content-Type'] = request.headers.get('Content-Type');
    }
    
    let targetUrl;
    let logTarget = '';
    
    // Enrutamiento inteligente basado en path
    if (url.pathname.startsWith('/api/gemini')) {
      // Google Gemini API
      targetUrl = 'https://generativelanguage.googleapis.com' + url.pathname + url.search;
      logTarget = 'Gemini';
    }
    else if (url.pathname.startsWith('/api/deepseek')) {
      // DeepSeek API
      targetUrl = 'https://api.deepseek.com' + url.pathname.replace('/api/deepseek', '') + url.search;
      logTarget = 'DeepSeek';
    }
    else if (url.pathname.startsWith('/api/openai')) {
      // OpenAI API
      targetUrl = 'https://api.openai.com' + url.pathname.replace('/api/openai', '') + url.search;
      logTarget = 'OpenAI';
    }
    else if (url.pathname.startsWith('/api/ollama')) {
      // Ollama local (si tienes instancia externa)
      targetUrl = 'https://tu-ollama-server.com' + url.pathname.replace('/api/ollama', '') + url.search;
      logTarget = 'Ollama';
    }
    else if (url.pathname.startsWith('/api/health')) {
      // Health check
      return new Response(JSON.stringify({
        status: 'ok',
        proxy: 'RAULI Cuba Proxy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        endpoints: ['/api/gemini', '/api/deepseek', '/api/openai', '/api/ollama', '/api/backend']
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    else {
      // Backend por defecto (Render/Vercel)
      targetUrl = 'https://rauli-panaderia-1.onrender.com' + url.pathname + url.search;
      logTarget = 'Backend';
    }
    
    try {
      console.log(`Proxy request to ${logTarget}: ${targetUrl}`);
      
      // Crear request modificada
      const modifiedRequest = new Request(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
        redirect: 'follow'
      });
      
      // Enviar request con timeout
      const response = await fetch(modifiedRequest, {
        timeout: 30000 // 30 segundos
      });
      
      // Clonar respuesta para poder modificar headers
      const responseBody = await response.arrayBuffer();
      
      // Headers de respuesta para CORS
      const responseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Expose-Headers': 'X-Rate-Limit, X-Rate-Limit-Remaining',
        'X-Powered-By': 'RAULI-Cuba-Proxy',
        'X-Proxy-Target': logTarget,
        'X-Response-Time': Date.now().toString(),
        'X-Original-URL': targetUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      };
      
      // Mantener headers importantes de la respuesta original
      if (response.headers.get('content-type')) {
        responseHeaders['Content-Type'] = response.headers.get('content-type');
      }
      if (response.headers.get('x-rate-limit')) {
        responseHeaders['X-Rate-Limit'] = response.headers.get('x-rate-limit');
      }
      if (response.headers.get('x-rate-limit-remaining')) {
        responseHeaders['X-Rate-Limit-Remaining'] = response.headers.get('x-rate-limit-remaining');
      }
      
      // Log exitoso
      console.log(`Successful proxy to ${logTarget}: ${response.status}`);
      
      // Retornar respuesta modificada
      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
      
    } catch (error) {
      console.error(`Proxy error to ${logTarget}:`, error.message);
      
      // Error response
      const errorResponse = {
        error: 'Proxy Error',
        message: 'Failed to proxy request',
        target: logTarget,
        originalUrl: targetUrl,
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        details: error.message
      };
      
      return new Response(JSON.stringify(errorResponse, null, 2), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Proxy-Error': 'true'
        }
      });
    }
  }
};

// Para debugging local
if (typeof globalThis !== 'undefined' && globalThis.fetch) {
  globalThis.addEventListener('fetch', (event) => {
    event.respondWith(module.exports.default.fetch(event.request, event.env, event.ctx));
  });
}
