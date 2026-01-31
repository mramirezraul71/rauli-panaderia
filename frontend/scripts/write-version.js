/**
 * Genera public/version.json desde src/config/version.js para que el servidor sirva la versión actual.
 * Se ejecuta antes de "vite build".
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const versionPath = join(root, "src", "config", "version.js");
const outPath = join(root, "public", "version.json");

const src = readFileSync(versionPath, "utf-8");
const match = src.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
const version = match ? match[1] : "1.0.0";

const payload = {
  version,
  build: new Date().toISOString(),
};

writeFileSync(outPath, JSON.stringify(payload, null, 0), "utf-8");
console.log("[write-version] version.json ->", version);
