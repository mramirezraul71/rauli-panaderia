/**
 * GENESIS - Backend Server
 * Sistema de Gesti�n Integral para negocios
 * Arquitectura Offline-First
 */

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

// Importar rutas
import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import salesRoutes from './routes/sales.js';
import inventoryRoutes from './routes/inventory.js';
import accountingRoutes from './routes/accounting.js';
import employeesRoutes from './routes/employees.js';
import syncRoutes from './routes/sync.js';
import reportsRoutes from './routes/reports.js';
import predictionsRoutes from './routes/predictions.js';
import sentinelRoutes from './routes/sentinel.js';
import productionRoutes from './routes/production.js';
import openaiProxyRoutes from './routes/openaiProxy.js';
import atlasAIRoutes from './routes/atlasAI.js';
import invitesRoutes from './routes/invites.js';
import feedbackBrainRoutes from './routes/feedbackBrain.js';
import atlasEventsRoutes from './routes/atlasEvents.js';
import liteRoutes from './routes/lite.js';

// Cargar variables de entorno (forzar .env del backend)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });
const smtpConfigured = Boolean(process.env.SMTP_HOST);
const smtpFromConfigured = Boolean(process.env.SMTP_FROM || process.env.SMTP_USER);
console.log(`[ENV] SMTP_HOST: ${smtpConfigured ? 'ok' : 'missing'}, SMTP_FROM/USER: ${smtpFromConfigured ? 'ok' : 'missing'}`);

// Configuraci�n
const app = express();
const PORT = process.env.PORT || 3001;
const LITE_UI_ROOT = resolve(process.env.RAULI_LITE_UI_ROOT || 'C:\\rauli-app-src');
const LITE_UI_INDEX = join(LITE_UI_ROOT, 'index.html');
const HAS_LITE_UI = fs.existsSync(LITE_UI_INDEX);

// CORS: permitir origen del frontend en producción
const corsOrigin = process.env.CORS_ORIGIN;
const explicitOrigins = corsOrigin
  ? corsOrigin.split(',').map((o) => o.trim()).filter(Boolean)
  : [];
const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    try {
      const parsed = new URL(origin);
      const host = parsed.hostname.toLowerCase();
      const allowedByEnv = explicitOrigins.includes(origin) || explicitOrigins.includes(parsed.origin);
      const allowedByHost =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.rauliatlasapp.com');
      if (allowedByEnv || allowedByHost) {
        return callback(null, true);
      }
    } catch {}
    return callback(new Error('Not allowed by CORS'));
  }
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (HAS_LITE_UI) {
  app.use(express.static(LITE_UI_ROOT, {
    index: false,
    etag: true,
    setHeaders(res, filePath) {
      if (/\.(html|json|js|css)$/i.test(String(filePath || ''))) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      res.setHeader('X-Rauli-Lite', 'backend-static');
    }
  }));
}

// Logger middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

const BACKEND_VERSION = process.env.GENESIS_BACKEND_VERSION || process.env.npm_package_version || '1.0.0';
const bootAtMs = Date.now();
let cachedTunnelAppBase = undefined;
let tunnelCfgDebug = { cfgPath: null, exists: null, hostnames: [], error: null, selected: null };

function normalizeBaseUrl(value) {
  if (!value) return '';
  try {
    const parsed = new URL(String(value).trim());
    return parsed.origin;
  } catch {
    return String(value || '').trim().replace(/\/+$/, '');
  }
}

function toHealthUrl(baseOrHealthUrl) {
  const raw = String(baseOrHealthUrl || '').trim();
  if (!raw) return '';
  if (/\/(api\/health|health)$/i.test(raw)) return raw;
  return `${raw.replace(/\/+$/, '')}/api/health`;
}

function extractVersion(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return payload.version || payload.app_version || payload.build_version || payload?.meta?.version || null;
}

function extractVersionFromHtml(htmlText) {
  const html = String(htmlText || '');
  const match = html.match(/window\.__APP_VERSION__\s*=\s*["']([^"']+)["']/i);
  return match?.[1] || null;
}

async function fetchJsonWithTimeout(url, timeoutMs = 2200) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    const latency_ms = Date.now() - start;
    const contentType = String(response.headers.get('content-type') || '');
    let data = null;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }
    return { ok: response.ok, status_code: response.status, latency_ms, data };
  } catch (error) {
    return {
      ok: false,
      status_code: 0,
      latency_ms: Date.now() - start,
      data: null,
      error: error?.name === 'AbortError' ? 'timeout' : (error?.message || 'network_error')
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchTextWithTimeout(url, timeoutMs = 2200) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
      signal: controller.signal
    });
    const latency_ms = Date.now() - start;
    const text = await response.text();
    return { ok: response.ok, status_code: response.status, latency_ms, text };
  } catch (error) {
    return {
      ok: false,
      status_code: 0,
      latency_ms: Date.now() - start,
      text: '',
      error: error?.name === 'AbortError' ? 'timeout' : (error?.message || 'network_error')
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function probeHealth(urlCandidates = []) {
  let lastError = null;
  for (const url of urlCandidates.filter(Boolean)) {
    const probe = await fetchJsonWithTimeout(url);
    const version = extractVersion(probe.data);
    if (probe.ok) {
      return {
        ok: true,
        url,
        latency_ms: probe.latency_ms,
        status_code: probe.status_code,
        version: version || null,
        payload_status: probe.data?.status || null
      };
    }
    lastError = {
      ok: false,
      url,
      latency_ms: probe.latency_ms,
      status_code: probe.status_code,
      version: version || null,
      error: probe.error || 'http_error'
    };
  }
  return lastError || {
    ok: false,
    url: null,
    latency_ms: null,
    status_code: 0,
    version: null,
    error: 'no_candidate_url'
  };
}

async function probeAppVersion(baseCandidates = []) {
  let lastError = null;
  for (const rawBase of baseCandidates.filter(Boolean)) {
    const base = normalizeBaseUrl(rawBase);
    if (!base) continue;

    const htmlUrl = `${base}/?t=${Date.now()}`;
    const htmlProbe = await fetchTextWithTimeout(htmlUrl, 2500);
    if (htmlProbe.ok) {
      const htmlVersion = extractVersionFromHtml(htmlProbe.text);
      if (htmlVersion) {
        return {
          ok: true,
          url: base,
          version: htmlVersion,
          source: 'html',
          latency_ms: htmlProbe.latency_ms
        };
      }
    }

    const versionUrl = `${base}/version.json?t=${Date.now()}`;
    const versionProbe = await fetchJsonWithTimeout(versionUrl, 2500);
    const jsonVersion = extractVersion(versionProbe.data);
    if (versionProbe.ok && jsonVersion) {
      return {
        ok: true,
        url: base,
        version: jsonVersion,
        source: 'version_json',
        latency_ms: versionProbe.latency_ms
      };
    }

    lastError = {
      ok: false,
      url: base,
      version: null,
      source: 'unavailable',
      latency_ms: htmlProbe.latency_ms || versionProbe.latency_ms || null,
      error: htmlProbe.error || versionProbe.error || 'http_error'
    };
  }

  return lastError || {
    ok: false,
    url: null,
    version: null,
    source: 'none',
    latency_ms: null,
    error: 'no_candidate_url'
  };
}

function deriveTunnelHealthCandidates(req) {
  const candidates = [];
  const explicitHealth = process.env.ATLAS_CLOUDFLARE_TUNNEL_HEALTH_URL || process.env.CLOUDFLARE_TUNNEL_HEALTH_URL;
  if (explicitHealth) candidates.push(String(explicitHealth).trim());

  const explicitApi = process.env.ATLAS_PANADERIA_API_URL || process.env.PANADERIA_API_URL || process.env.CLOUDFLARE_TUNNEL_URL;
  if (explicitApi) candidates.push(toHealthUrl(normalizeBaseUrl(explicitApi)));

  const publicApp = process.env.ATLAS_PANADERIA_APP_URL;
  if (publicApp) {
    try {
      const parsed = new URL(publicApp);
      if (/^panaderia\./i.test(parsed.hostname)) {
        parsed.hostname = parsed.hostname.replace(/^panaderia\./i, 'panaderia-api.');
      }
      candidates.push(toHealthUrl(parsed.origin));
    } catch {}
  }

  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').trim();
  if (forwardedHost && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(forwardedHost)) {
    candidates.push(`${forwardedProto}://${forwardedHost}/api/health`);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function deriveAtlasAppCandidates(req) {
  const candidates = [];
  const fromEnv = process.env.ATLAS_LOCAL_APP_URL || process.env.NEXUS_CHAT_URL || process.env.NEXUS_APP_URL;
  if (fromEnv) candidates.push(fromEnv);

  const origin = String(req.headers.origin || '').trim();
  if (origin && !/\/api/i.test(origin)) candidates.push(origin);

  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').trim();
  if (forwardedHost) {
    candidates.push(`${forwardedProto}://${forwardedHost}`);
  }

  candidates.push('http://127.0.0.1:5173', 'http://localhost:5173');
  return Array.from(new Set(candidates.map(normalizeBaseUrl).filter(Boolean)));
}

function deriveTunnelAppCandidates(req) {
  const candidates = [];
  const explicit = process.env.ATLAS_PANADERIA_APP_URL || process.env.CLOUDFLARE_TUNNEL_URL;
  if (explicit) candidates.push(explicit);

  if (cachedTunnelAppBase === undefined) {
    cachedTunnelAppBase = null;
    try {
      const cfgPath = join(__dirname, '..', '..', '..', 'config', 'cloudflared', 'cloudflare_atlas_config.yaml');
      tunnelCfgDebug = { cfgPath, exists: fs.existsSync(cfgPath), hostnames: [], error: null, selected: null };
      if (fs.existsSync(cfgPath)) {
        const raw = fs.readFileSync(cfgPath, 'utf8');
        const matches = [...raw.matchAll(/hostname:\s*["']?([^\s"']+)/gi)].map((m) => m?.[1]).filter(Boolean);
        tunnelCfgDebug.hostnames = matches;
        const panHost = matches.find((h) => /^panaderia\./i.test(h));
        if (panHost) {
          cachedTunnelAppBase = `https://${panHost}`;
          tunnelCfgDebug.selected = cachedTunnelAppBase;
        }
      }
    } catch (err) {
      tunnelCfgDebug.error = err?.message || 'unknown_error';
    }
  }
  if (cachedTunnelAppBase) candidates.push(cachedTunnelAppBase);

  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').trim();
  if (forwardedHost && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(forwardedHost)) {
    candidates.push(`${forwardedProto}://${forwardedHost}`);
  }

  return Array.from(new Set(candidates.map(normalizeBaseUrl).filter(Boolean)));
}

// Raíz: evitar 404 en GET / (p. ej. health checks que apuntan a la base URL)
app.get('/', (req, res) => {
  if (HAS_LITE_UI) {
    return res.sendFile(LITE_UI_INDEX);
  }
  res.status(200).json({
    message: 'GENESIS API',
    health: '/api/health',
    timestamp: new Date().toISOString()
  });
});

// Health check (versión permite verificar que el backend se actualizó)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: BACKEND_VERSION,
    name: 'GENESIS API'
  });
});

// Telemetría en tiempo real para UI (ATLAS + túnel + coherencia de versiones)
app.get('/api/runtime/bridge-status', async (req, res) => {
  const atlasBase = normalizeBaseUrl(process.env.ATLAS_BASE_URL || 'http://127.0.0.1:8791');
  const atlasCandidates = [toHealthUrl(atlasBase), `${atlasBase}/health`].filter(Boolean);
  const tunnelCandidates = deriveTunnelHealthCandidates(req);
  const atlasAppCandidates = deriveAtlasAppCandidates(req);
  const tunnelAppCandidates = deriveTunnelAppCandidates(req);

  const [atlas, tunnel, atlas_app, tunnel_app] = await Promise.all([
    probeHealth(atlasCandidates),
    probeHealth(tunnelCandidates),
    probeAppVersion(atlasAppCandidates),
    probeAppVersion(tunnelAppCandidates)
  ]);

  const atlasVersion = atlas_app.version || atlas.version || tunnel_app.version || tunnel.version || null;
  const tunnelVersion = tunnel_app.version || tunnel.version || atlas_app.version || atlas.version || null;
  const version_match = Boolean(atlasVersion && tunnelVersion && atlasVersion === tunnelVersion);
  let version_source = 'health';
  if (atlas_app.version && tunnel_app.version) {
    version_source = 'app';
  } else if (atlas_app.version && !tunnel_app.version) {
    version_source = 'app_atlas_fallback';
  } else if (!atlas_app.version && tunnel_app.version) {
    version_source = 'app_tunnel_fallback';
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    backend: {
      version: BACKEND_VERSION,
      uptime_s: Math.floor((Date.now() - bootAtMs) / 1000)
    },
    atlas,
    tunnel,
    atlas_app,
    tunnel_app,
    versions: {
      atlas: atlasVersion,
      tunnel: tunnelVersion,
      match: version_match,
      source: version_source
    },
    debug: {
      atlas_health_candidates: atlasCandidates,
      tunnel_health_candidates: tunnelCandidates,
      atlas_app_candidates: atlasAppCandidates,
      tunnel_app_candidates: tunnelAppCandidates,
      tunnel_cfg_debug: tunnelCfgDebug,
      cached_tunnel_app_base: cachedTunnelAppBase
    }
  });
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/sentinel', sentinelRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/ai', openaiProxyRoutes);
app.use('/api/ai', atlasAIRoutes);
app.use('/api/invites', invitesRoutes);
app.use('/api/feedback', feedbackBrainRoutes);
app.use('/api/atlas', atlasEventsRoutes);
app.use('/api/lite', liteRoutes);

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  if (
    HAS_LITE_UI &&
    req.method === 'GET' &&
    !String(req.path || '').startsWith('/api/') &&
    !String(req.path || '').includes('.')
  ) {
    return res.sendFile(LITE_UI_INDEX);
  }
  res.status(404).json({ error: true, message: 'Ruta no encontrada' });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
���������������������������������������������������������������ͻ
�   �����ۻ  ����ۻ �ۻ   �ۻ�ۻ     �ۻ    ������ۻ�����ۻ �����ۻ �
�   ������ۻ������ۻ�ۺ   �ۺ�ۺ     �ۺ    ������ͼ������ۻ������ۻ�
�   ������ɼ������ۺ�ۺ   �ۺ�ۺ     �ۺ    ����ۻ  ������ɼ������ɼ�
�   ������ۻ������ۺ�ۺ   �ۺ�ۺ     �ۺ    ����ͼ  ������ۻ�����ͼ �
�   �ۺ  �ۺ�ۺ  �ۺ�������ɼ������ۻ�ۺ    ������ۻ�ۺ  �ۺ�ۺ     �
�   �ͼ  �ͼ�ͼ  �ͼ �����ͼ ������ͼ�ͼ    ������ͼ�ͼ  �ͼ�ͼ     �
���������������������������������������������������������������ͼ
  Sistema de Gesti�n Integral para negocios

  [�] Servidor iniciado en puerto ${PORT}
  [�] API disponible en http://localhost:${PORT}/api
  [�] Health check: http://localhost:${PORT}/api/health

  Para acceso desde dispositivos m�viles:
  Usar IP local de este equipo (ej: 192.168.1.x:${PORT})
  `);
});

export default app;
