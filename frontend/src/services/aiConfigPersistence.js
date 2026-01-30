/**
 * Persistencia dual de configuración de IA (RauliERP-Panaderia)
 * Guarda en IndexedDB Y localStorage para evitar pérdida al cerrar la app.
 */
import { db } from "./dataService";

const LS_PREFIX = "genesis_ai_";

const encode = (v) => (v ? btoa(String(v)) : "");
const decode = (v) => {
  if (!v) return null;
  try {
    return atob(v);
  } catch {
    return v;
  }
};

const API_KEYS = ["ai_api_key", "openai_api_key", "deepseek_api_key"];
const BOOL_KEYS = ["gemini_enabled", "openai_enabled", "deepseek_enabled"];

async function saveToIndexedDB(key, value) {
  try {
    await db.settings?.put({ key, value });
  } catch (e) {
    console.warn("[AIConfig] IndexedDB save failed:", key, e);
  }
}

function saveToLocalStorage(key, value) {
  try {
    const lsKey = LS_PREFIX + key;
    if (API_KEYS.includes(key)) {
      localStorage.setItem(lsKey, value ? encode(value) : "");
    } else {
      localStorage.setItem(lsKey, String(value ?? ""));
    }
  } catch (e) {
    console.warn("[AIConfig] localStorage save failed:", key, e);
  }
}

function readFromLocalStorage(key) {
  try {
    let v = localStorage.getItem(LS_PREFIX + key);
    if (key === "ai_api_key" && (!v || v === "") && localStorage.getItem("rauli_gemini_key")) {
      v = localStorage.getItem("rauli_gemini_key");
      if (v && v.startsWith("AIza")) return v;
      try { return atob(v); } catch { return v; }
    }
    if (v === null || v === "") return null;
    if (API_KEYS.includes(key)) return decode(v);
    return v;
  } catch {
    return null;
  }
}

async function loadFromStorage(key) {
  try {
    const row = await db.settings?.get(key);
    if (row?.value !== undefined && row?.value !== null && row?.value !== "") {
      if (API_KEYS.includes(key)) return decode(row.value);
      if (BOOL_KEYS.includes(key)) return row.value === "true" || row.value === true;
      return row.value;
    }
  } catch (e) {
    console.warn("[AIConfig] IndexedDB read failed:", key, e);
  }
  const local = readFromLocalStorage(key);
  if (local !== null && local !== "") {
    await saveToIndexedDB(key, API_KEYS.includes(key) ? encode(local) : local);
    return local;
  }
  return null;
}

export async function saveAIConfig(key, value) {
  const isApiKey = API_KEYS.includes(key);
  const isBool = BOOL_KEYS.includes(key);
  const str = isBool ? String(!!value) : (isApiKey && value ? encode(value) : (value ?? ""));
  await saveToIndexedDB(key, str);
  saveToLocalStorage(key, value);
}

export async function loadAIConfig() {
  const [gKey, gEnabled, oKey, oEnabled, dKey, dEnabled, baseUrl, dBaseUrl, primary] = await Promise.all([
    loadFromStorage("ai_api_key"),
    loadFromStorage("gemini_enabled"),
    loadFromStorage("openai_api_key"),
    loadFromStorage("openai_enabled"),
    loadFromStorage("deepseek_api_key"),
    loadFromStorage("deepseek_enabled"),
    loadFromStorage("ai_base_url"),
    loadFromStorage("deepseek_base_url"),
    loadFromStorage("primary_provider")
  ]);

  return {
    geminiKey: gKey || null,
    geminiEnabled: gEnabled === "true" || gEnabled === true,
    openaiKey: oKey || null,
    openaiEnabled: oEnabled === "true" || oEnabled === true,
    deepseekKey: dKey || null,
    deepseekEnabled: dEnabled === "true" || dEnabled === true,
    baseUrl: baseUrl?.trim() || null,
    deepseekBaseUrl: dBaseUrl?.trim() || "https://api.deepseek.com/v1",
    primaryProvider: primary || "gemini"
  };
}

export async function getGeminiApiKey() {
  const key = await loadFromStorage("ai_api_key");
  return key || null;
}

export function syncGeminiKeyToLocalStorage(key) {
  try {
    if (key) localStorage.setItem("rauli_gemini_key", key);
    else localStorage.removeItem("rauli_gemini_key");
  } catch {}
}
