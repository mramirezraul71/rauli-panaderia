/**
 * Vercel Serverless: devuelve { version, build } para que la app detecte actualizaciones.
 * Siempre responde JSON; no depende de archivos estáticos ni rewrites.
 */
const { readFileSync, existsSync } = require("fs");
const { join } = require("path");

module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json");
  const paths = [
    join(__dirname, "..", "public", "version.json"),
    join(process.cwd(), "public", "version.json"),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const data = JSON.parse(readFileSync(p, "utf8"));
        return res.status(200).json(data);
      } catch (_) {}
    }
  }
  res.status(200).json({
    version: process.env.npm_package_version || "1.0.5",
    build: new Date().toISOString(),
  });
};
