#!/usr/bin/env node
/**
 * deploy_network.js - Despliegue automático del proxy Cloudflare + configuración del frontend
 * Uso: node deploy_network.js
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const ROOT = path.resolve(__dirname);
const INFRA = path.join(ROOT, 'infrastructure');
const FRONTEND = path.join(ROOT, 'frontend');
const BACKEND_URL = 'https://rauli-panaderia-1.onrender.com';

function log(msg, type = 'info') {
  const prefix = { info: '[INFO]', ok: '[OK]', err: '[ERROR]', warn: '[WARN]' }[type] || '[INFO]';
  console.log(`${prefix} ${msg}`);
}

// 1. Verificar wrangler (npx lo descarga si no está)
function ensureWrangler() {
  log('Usando npx wrangler...');
  try {
    execSync('npx wrangler --version', { stdio: 'pipe', cwd: ROOT });
    log('wrangler disponible', 'ok');
  } catch {
    log('npx descargará wrangler al desplegar', 'info');
  }
  return 'npx wrangler';
}

// 2. Crear carpeta infrastructure y archivos
function generateWorker() {
  log('Generando infrastructure/...');
  if (!fs.existsSync(INFRA)) fs.mkdirSync(INFRA, { recursive: true });

  const workerCode = `/**
 * Proxy inverso Cloudflare Worker - Rauli Panadería
 * Redirige a ${BACKEND_URL}
 */
const BACKEND = '${BACKEND_URL}';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const backendUrl = BACKEND + url.pathname + url.search;
    const modifiedRequest = new Request(backendUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });
    const response = await fetch(modifiedRequest);
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', '*');
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: newHeaders });
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
`;
  fs.writeFileSync(path.join(INFRA, 'worker.js'), workerCode);

  const today = new Date().toISOString().slice(0, 10);
  const wranglerToml = `name = "puente-rauli"
main = "worker.js"
compatibility_date = "${today}"
`;
  fs.writeFileSync(path.join(INFRA, 'wrangler.toml'), wranglerToml);
  log('worker.js y wrangler.toml creados', 'ok');
}

// 3. Desplegar y capturar URL
function deployAndCaptureUrl(wranglerCmd) {
  log('Desplegando a Cloudflare...');
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = wranglerCmd.split(/\s+/);
    const child = spawn(cmd, [...args, 'deploy', '--dry-run=false'], {
      cwd: INFRA,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); process.stdout.write(d); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); process.stderr.write(d); });
    child.on('close', (code) => {
      const full = stdout + stderr;
      const match = full.match(/https:\/\/[^\s"')\]]+\.workers\.dev/);
      if (match) {
        const url = match[0].replace(/\/$/, '');
        resolve(url);
      } else if (code === 0) {
        // URL por defecto si no se captura
        resolve('https://puente-rauli.workers.dev');
      } else {
        reject(new Error(`Deploy falló (código ${code}). ¿Ejecutaste \`wrangler login\`?`));
      }
    });
  });
}

// 4. Actualizar .env del frontend
function updateFrontendEnv(workerUrl) {
  const apiBase = `${workerUrl}/api`;
  const envPath = path.join(FRONTEND, '.env');
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const keys = ['VITE_API_BASE', 'VITE_API_URL'];
  for (const key of keys) {
    if (new RegExp(`^${key}=`, 'm').test(content)) {
      content = content.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${apiBase}`);
    } else {
      content = (content.trimEnd() + (content ? '\n' : '') + `${key}=${apiBase}`).trimEnd() + '\n';
    }
  }
  fs.writeFileSync(envPath, content.trimEnd() + '\n');
  log(`.env actualizado: VITE_API_BASE=${apiBase}`, 'ok');
  return apiBase;
}

// 5. src/config/api.js ya existe (creado manualmente), usa VITE_API_BASE del .env
function ensureApiConfig() {
  const configPath = path.join(FRONTEND, 'src', 'config', 'api.js');
  if (!fs.existsSync(configPath)) {
    const content = `/**
 * Configuración centralizada de la API
 * Usa VITE_API_BASE (o VITE_API_URL) desde .env
 */
const API_BASE = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || 'https://rauli-panaderia-1.onrender.com/api').replace(/\\/+$/, '');

export { API_BASE };
export default API_BASE;
`;
    fs.writeFileSync(configPath, content);
    log('src/config/api.js creado', 'ok');
  } else {
    log('src/config/api.js ya existe', 'ok');
  }
}

// Main
async function main() {
  console.log('\n=== deploy_network.js - Rauli Panadería ===\n');
  try {
    const wranglerCmd = ensureWrangler();
    generateWorker();
    const workerUrl = await deployAndCaptureUrl(wranglerCmd);
    log(`Proxy desplegado: ${workerUrl}`, 'ok');
    updateFrontendEnv(workerUrl);
    ensureApiConfig();
    const apiBase = `${workerUrl}/api`;
    const copyPath = path.join(ROOT, 'api_copia.txt');
    const copyContent = `# Copia API - Rauli Panadería (${new Date().toISOString().slice(0, 10)})
CLOUDFLARE_WORKER_URL=${workerUrl}
VITE_API_BASE=${apiBase}
`;
    fs.writeFileSync(copyPath, copyContent);
    log(`Copia guardada en api_copia.txt`, 'ok');
    console.log('\n=== ¡Listo! ===');
    console.log(`Proxy: ${workerUrl}`);
    console.log(`API:   ${apiBase}`);
    console.log('Frontend configurado. Ejecuta: cd frontend && npm run dev\n');
  } catch (err) {
    log(err.message, 'err');
    process.exit(1);
  }
}

main();
