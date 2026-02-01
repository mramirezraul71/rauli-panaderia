import { getBusinessConfig } from "../config/businessConfig";
import { STRINGS } from "./strings";

export const t = (key, fallback = "") => {
  const config = getBusinessConfig();
  const lang = (config.appLanguage || "es").toLowerCase();
  const entry = STRINGS[key];
  if (!entry) return fallback || key;
  return entry[lang] || entry.es || fallback || key;
};
