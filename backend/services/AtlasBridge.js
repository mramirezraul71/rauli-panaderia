const ATLAS_BASE = (process.env.ATLAS_BASE_URL || "http://127.0.0.1:8791").replace(/\/+$/, "");
const ATLAS_COMMS_ENDPOINT = `${ATLAS_BASE}/api/comms/hub/emit`;
const ATLAS_TIMEOUT_MS = Number(process.env.ATLAS_EVENT_TIMEOUT_MS || 1200);
const ATLAS_EVENTS_ENABLED = String(process.env.ATLAS_EVENTS_ENABLED || "true").toLowerCase() !== "false";

async function postJsonWithTimeout(url, payload, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    return response.ok;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function emitAtlasEvent({
  message,
  level = "info",
  subsystem = "panaderia",
  data = {},
  channels
}) {
  if (!ATLAS_EVENTS_ENABLED || !message) return false;
  try {
    const payload = { message, level, subsystem, data };
    if (Array.isArray(channels) && channels.length > 0) {
      payload.channels = channels;
    }
    return await postJsonWithTimeout(ATLAS_COMMS_ENDPOINT, payload, ATLAS_TIMEOUT_MS);
  } catch {
    return false;
  }
}
