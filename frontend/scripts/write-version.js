/**
 * Genera public/version.json desde src/config/version.js para que el servidor sirva la versión actual.
 * Se ejecuta antes de "vite build".
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const versionPath = join(root, "src", "config", "version.js");
const outPath = join(root, "public", "version.json");

const src = readFileSync(versionPath, "utf-8");
const match = src.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
const version = match ? match[1] : "1.0.0";

const build = new Date().toISOString();
const payload = { version, build };
const json = JSON.stringify(payload, null, 0);

writeFileSync(outPath, json, "utf-8");
const apiDir = join(root, "api");
try {
  mkdirSync(apiDir, { recursive: true });
  writeFileSync(join(apiDir, "version.json"), json, "utf-8");
} catch (_) {}

const indexPath = join(root, "index.html");
let indexHtml = readFileSync(indexPath, "utf-8");
indexHtml = indexHtml
  .replace(/window\.__APP_VERSION__\s*=\s*["'][^"']*["']/, `window.__APP_VERSION__="${version}"`)
  .replace(/window\.__APP_BUILD__\s*=\s*["'][^"']*["']/, `window.__APP_BUILD__="${build}"`);
writeFileSync(indexPath, indexHtml, "utf-8");

console.log("[write-version] version.json ->", version);
