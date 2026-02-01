import { db } from "./dataService";

const KEY_STORAGE = "genesis_encryption_key_v1";
const LEGACY_KEY_STORAGE = "rauli_encryption_key_v1";
const ENC_PREFIX = "enc:v1:";

const getKeyMaterial = (raw) =>
  window.crypto.subtle.importKey(
    "raw",
    raw,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

const deriveKey = (keyMaterial, salt) =>
  window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

const getOrCreateMasterKey = async () => {
  let raw = localStorage.getItem(KEY_STORAGE);
  if (!raw) {
    const legacy = localStorage.getItem(LEGACY_KEY_STORAGE);
    if (legacy) {
      raw = legacy;
      localStorage.setItem(KEY_STORAGE, legacy);
    } else {
      const bytes = window.crypto.getRandomValues(new Uint8Array(32));
      raw = btoa(String.fromCharCode(...bytes));
      localStorage.setItem(KEY_STORAGE, raw);
    }
  }
  return Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
};

const encodeBuffer = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));

const decodeBuffer = (b64) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export const encryptString = async (value) => {
  if (value === undefined || value === null) return "";
  const masterRaw = await getOrCreateMasterKey();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await getKeyMaterial(masterRaw);
  const key = await deriveKey(keyMaterial, salt);
  const data = new TextEncoder().encode(String(value));
  const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return ENC_PREFIX + [encodeBuffer(salt), encodeBuffer(iv), encodeBuffer(encrypted)].join(".");
};

export const decryptString = async (value) => {
  if (!value || typeof value !== "string") return "";
  if (!value.startsWith(ENC_PREFIX)) return value;
  const [saltB64, ivB64, dataB64] = value.replace(ENC_PREFIX, "").split(".");
  const masterRaw = await getOrCreateMasterKey();
  const salt = decodeBuffer(saltB64);
  const iv = decodeBuffer(ivB64);
  const data = decodeBuffer(dataB64);
  const keyMaterial = await getKeyMaterial(masterRaw);
  const key = await deriveKey(keyMaterial, salt);
  const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
};

export const putSecureSetting = async (key, value) => {
  const encrypted = await encryptString(value);
  await db.settings?.put({ key, value: encrypted });
};

export const getSecureSetting = async (key) => {
  const stored = await db.settings?.get(key);
  if (!stored?.value) return "";
  return decryptString(stored.value);
};
