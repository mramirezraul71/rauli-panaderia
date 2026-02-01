/**
 * Vercel Serverless: devuelve { version, build } para que la app detecte actualizaciones.
 * Siempre responde JSON; no depende de archivos estáticos ni rewrites.
 */
const { readFileSync, existsSync } = require("fs");
const { join } = require("path");

module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json");
  const path = join(__dirname, "version.json");
  if (existsSync(path)) {
    try {
      const data = JSON.parse(readFileSync(path, "utf8"));
      return res.status(200).json(data);
    } catch (_) {}
  }
  res.status(200).json({
    version: process.env.npm_package_version || "1.0.4",
    build: new Date().toISOString(),
  });
};
