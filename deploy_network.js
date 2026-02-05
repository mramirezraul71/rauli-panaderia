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

// Escribir URL en archivos (api_robot.txt, .env, api_copia.txt)
function writeApiEverywhere(apiBase, workerUrl) {
  updateFrontendEnv(workerUrl || apiBase.replace(/\/api$/, ''));
  ensureApiConfig();
  fs.writeFileSync(path.join(ROOT, 'api_copia.txt'),
    `# Copia API - Rauli Panadería (${new Date().toISOString().slice(0, 10)})\nCLOUDFLARE_WORKER_URL=${workerUrl || apiBase.replace(/\/api$/, '')}\nVITE_API_BASE=${apiBase}\n`);
  fs.writeFileSync(path.join(ROOT, 'api_robot.txt'), `${apiBase}\n`);
  log(`api_robot.txt actualizado (robot)`, 'ok');
}

// Main
async function main() {
  console.log('\n=== deploy_network.js - Rauli Panadería ===\n');
  const DIRECT_API = `${BACKEND_URL}/api`;
  try {
    ensureWrangler();
    generateWorker();
    let workerUrl;
    try {
      workerUrl = await deployAndCaptureUrl('npx wrangler');
      log(`Proxy desplegado: ${workerUrl}`, 'ok');
      const apiBase = `${workerUrl}/api`;
      writeApiEverywhere(apiBase, workerUrl);
      console.log('\n=== ¡Listo! ===');
      console.log(`Proxy: ${workerUrl}`);
      console.log(`API:   ${apiBase}`);
    } catch (deployErr) {
      log(`Cloudflare falló: ${deployErr.message}`, 'warn');
      log('Usando API directa (Render) como fallback', 'info');
      writeApiEverywhere(DIRECT_API, '');
      updateFrontendEnv(BACKEND_URL);
      log(`api_robot.txt y .env configurados con ${DIRECT_API}`, 'ok');
      console.log('\n=== Fallback aplicado ===');
      console.log(`API: ${DIRECT_API}`);
    }
    console.log('Robot puede leer: from robot.load_api import get_api_base\n');
  } catch (err) {
    log(err.message, 'err');
    log('Configurando fallback directo...', 'info');
    try {
      writeApiEverywhere(DIRECT_API, '');
      updateFrontendEnv(BACKEND_URL);
      log('api_robot.txt y .env configurados con API directa', 'ok');
    } catch (e) {
      process.exit(1);
    }
  }
}

main();
