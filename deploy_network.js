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

// 1. Verificar/instalar wrangler
function ensureWrangler() {
  log('Verificando wrangler...');
  try {
    execSync('npx wrangler --version', { stdio: 'pipe' });
    log('wrangler disponible (npx)', 'ok');
    return 'npx wrangler';
  } catch {
    log('Instalando wrangler temporalmente...');
    execSync('npm install wrangler --save-dev', { cwd: ROOT, stdio: 'inherit' });
    return 'npx wrangler';
  }
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
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }
  const line = `VITE_API_BASE=${apiBase}\n`;
  if (/VITE_API_BASE=/.test(content)) {
    content = content.replace(/VITE_API_BASE=.*/g, `VITE_API_BASE=${apiBase}`);
  } else {
    content = content.trim() + (content ? '\n' : '') + line;
  }
  if (!content.endsWith('\n')) content += '\n';
  fs.writeFileSync(envPath, content);
  log(`.env actualizado: VITE_API_BASE=${apiBase}`, 'ok');
  return apiBase;
}

// 5. Crear/actualizar src/config/api.js centralizado
function ensureApiConfig() {
  const configPath = path.join(FRONTEND, 'src', 'config', 'api.js');
  const content = `/**
 * Configuración centralizada de la API
 * Usa VITE_API_BASE (o VITE_API_URL) desde .env
 */
const API_BASE = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || 'https://rauli-panaderia-1.onrender.com/api').replace(/\\/+$/, '');

export { API_BASE };
export default API_BASE;
`;
  fs.writeFileSync(configPath, content);
  log('src/config/api.js creado/actualizado', 'ok');
}

// 6. Reemplazar URLs quemadas en src/
function refactorHardcodedUrls() {
  const srcDir = path.join(FRONTEND, 'src');
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/\.(js|jsx|ts|tsx)$/.test(name)) files.push(full);
    }
  }
  walk(srcDir);

  const patterns = [
    ['https://rauli-panaderia-1.onrender.com', "import { API_BASE } from '../config/api'"],
    ['http://localhost:3001', "import { API_BASE } from '../config/api'"],
  ];

  for (const file of files) {
    let text = fs.readFileSync(file, 'utf8');
    let changed = false;
    const rel = path.relative(srcDir, path.dirname(file)).replace(/\\/g, '/');
    const importPath = rel ? Array(rel.split('/').length).fill('..').join('/') + '/config/api' : './config/api';

    if (/https:\/\/rauli-panaderia-1\.onrender\.com/.test(text) && !/from ['\"].*config\/api['\"]/.test(text)) {
      const needsImport = !/API_BASE|from.*api/.test(text);
      if (needsImport) {
        const importLine = `import { API_BASE } from '${importPath}';\n`;
        if (!text.includes("from '") && !text.includes('from "')) {
          const firstImport = text.match(/^import\s/m);
          if (firstImport) {
            text = text.replace(/^/, importLine);
          } else {
            text = importLine + text;
          }
        } else {
          const lastImport = text.match(/import[^;]+;/g);
          if (lastImport) {
            const idx = text.lastIndexOf(lastImport[lastImport.length - 1]) + lastImport[lastImport.length - 1].length;
            text = text.slice(0, idx) + '\n' + importLine.trim() + '\n' + text.slice(idx);
          }
        }
      }
      text = text.replace(/['"]https:\/\/rauli-panaderia-1\.onrender\.com\/api/g, '`${API_BASE}');
      text = text.replace(/\/api\/[^'"`)\s]+['"]/g, (m) => m.replace(/^\/api/, '').replace(/['"]$/, '`'));
      text = text.replace(/\$\{API_BASE\}([^`]*?)`/g, '`${API_BASE}$1`');
      changed = true;
    }
    if (changed) fs.writeFileSync(file, text);
  }
  log('Refactorización de URLs completada', 'ok');
}

// Refactor más preciso para los archivos con URLs quemadas
function refactorUrls() {
  const apiImport = "import { API_BASE } from '../config/api'";
  const filesToFix = [
    { file: path.join(FRONTEND, 'src', 'pages', 'Dashboard.jsx'), importPath: '../config/api' },
    { file: path.join(FRONTEND, 'src', 'components', 'Production', 'ProductionModule.jsx'), importPath: '../../config/api' },
  ];

  for (const { file, importPath } of filesToFix) {
    if (!fs.existsSync(file)) continue;
    let text = fs.readFileSync(file, 'utf8');
    if (!text.includes('rauli-panaderia-1.onrender.com')) continue;

    if (!text.includes('API_BASE')) {
      const insert = `import { API_BASE } from '${importPath}';\n`;
      const firstLine = text.indexOf('\n');
      text = text.slice(0, firstLine + 1) + insert + text.slice(firstLine + 1);
    }
    text = text.replace(/['"]https:\/\/rauli-panaderia-1\.onrender\.com\/api\/[^'"`]+['"]/g, '`${API_BASE}/$&`.replace(/\`\\$\\{API_BASE\\}\/([\'"])([^\'"]+)([\'"])\`/, \'`${API_BASE}/\' + \'$2\'.replace(/^api\\//,\'\') + \'`\')');
    text = text.replace(/fetch\(['"]https:\/\/rauli-panaderia-1\.onrender\.com\/api\/([^'"`]+)['"]\)/g, 'fetch(`${API_BASE}/$1`)');
    text = text.replace(/['"]https:\/\/rauli-panaderia-1\.onrender\.com\/api\/([^'"`]+)['"]/g, '`${API_BASE}/$1`');
    fs.writeFileSync(file, text);
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
    refactorUrls();
    console.log('\n=== ¡Listo! ===');
    console.log(`Proxy: ${workerUrl}`);
    console.log('Frontend configurado. Ejecuta: cd frontend && npm run dev\n');
  } catch (err) {
    log(err.message, 'err');
    process.exit(1);
  }
}

main();
