import express from "express";

const router = express.Router();

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";
const ALLOWED_ENDPOINTS = new Set([
  "/v1/chat/completions",
  "/v1/responses"
]);

const buildPayload = (body) => {
  if (!body || typeof body !== "object") return null;
  if (body.payload && typeof body.payload === "object") {
    return body.payload;
  }
  const { endpoint, ...rest } = body;
  return rest;
};

router.post("/openai", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: true,
      message: "OPENAI_API_KEY no configurada en el servidor."
    });
  }

  const endpoint = typeof req.body?.endpoint === "string"
    ? req.body.endpoint
    : "/v1/chat/completions";

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return res.status(400).json({
      error: true,
      message: "Endpoint no permitido.",
      allowed: Array.from(ALLOWED_ENDPOINTS)
    });
  }

  const payload = buildPayload(req.body);
  if (!payload) {
    return res.status(400).json({
      error: true,
      message: "Payload inválido."
    });
  }

  if (payload.stream) {
    return res.status(400).json({
      error: true,
      message: "Streaming no soportado en este proxy."
    });
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
  const url = `${baseUrl}${endpoint}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const text = await response.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {}

    return res.status(response.status).json(data);
  } catch (error) {
    const message = error.name === "AbortError"
      ? "Timeout al conectar con OpenAI."
      : error.message;
    return res.status(502).json({ error: true, message });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
