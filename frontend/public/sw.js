/**
 * GENESIS - Service Worker
 * Offline-first PWA support
 */

const CACHE_NAME = 'rauli-erp-v4';
const STATIC_CACHE = 'rauli-erp-static-v4';
const API_CACHE = 'rauli-erp-api-v4';

// Archivos estáticos para cache
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Instalación del SW
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static files');
      return cache.addAll(STATIC_FILES);
    })
  );
  
  self.skipWaiting();
});

// Escuchar mensajes del cliente (skip waiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activación del SW: borrar todas las cachés antiguas para forzar actualización en móvil
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('rauli-erp-'))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Solo manejar requests de nuestro origen
  if (!url.origin.includes(self.location.origin) && !url.origin.includes('localhost:3001')) {
    return;
  }
  
  // /api/version: SIEMPRE red, nunca caché — para que "Buscar actualización" detecte la versión nueva
  if (url.pathname === '/api/version') {
    event.respondWith(fetch(request));
    return;
  }
  
  // API requests - Network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
  
  // Navegación / documento: network first para que móvil reciba siempre la versión nueva
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('index.html')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
  
  // Static files - Cache first, fallback to network
  event.respondWith(cacheFirstStrategy(request));
});

// Network first strategy (para API)
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    
    // Cache respuestas GET exitosas
    if (request.method === 'GET' && response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Retornar respuesta de error offline
    return new Response(
      JSON.stringify({ 
        error: true, 
        message: 'Sin conexión', 
        offline: true 
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Cache first strategy (para archivos estáticos)
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    // Cache respuestas exitosas
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Fetch failed:', request.url);
    
    // Para navegación, devolver index.html
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Background sync para operaciones pendientes
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-sales') {
    event.waitUntil(syncPendingSales());
  }
});

async function syncPendingSales() {
  console.log('[SW] Syncing pending sales...');
  // La sincronización real se maneja desde la app
  // El SW solo notifica que hay conexión disponible
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_AVAILABLE' });
  });
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const options = {
    body: data.body || 'Nueva notificación de GENESIS',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [100, 50, 100],
    data: data.url || '/',
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Cerrar' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'GENESIS', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      self.clients.openWindow(event.notification.data || '/')
    );
  }
});

console.log('[SW] Service Worker loaded');
