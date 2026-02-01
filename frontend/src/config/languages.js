export const LANGUAGES = [
  { id: "es", label: "Español", locale: "es-ES", dir: "ltr" },
  { id: "en", label: "English", locale: "en-US", dir: "ltr" },
  { id: "pt", label: "Português", locale: "pt-PT", dir: "ltr" },
  { id: "fr", label: "Français", locale: "fr-FR", dir: "ltr" },
  { id: "de", label: "Deutsch", locale: "de-DE", dir: "ltr" },
  { id: "it", label: "Italiano", locale: "it-IT", dir: "ltr" },
  { id: "ru", label: "Русский", locale: "ru-RU", dir: "ltr" },
  { id: "ar", label: "العربية", locale: "ar-SA", dir: "rtl" },
  { id: "zh", label: "中文", locale: "zh-CN", dir: "ltr" },
  { id: "ja", label: "日本語", locale: "ja-JP", dir: "ltr" },
  { id: "ko", label: "한국어", locale: "ko-KR", dir: "ltr" },
  { id: "hi", label: "हिन्दी", locale: "hi-IN", dir: "ltr" }
];

const LANGUAGE_BY_ID = new Map(LANGUAGES.map((lang) => [lang.id, lang]));

export const getLanguageConfig = (id) => LANGUAGE_BY_ID.get((id || "").toLowerCase());

export const resolveLanguage = (raw) => {
  const value = (raw || "").toLowerCase();
  if (!value) return "es";
  if (LANGUAGE_BY_ID.has(value)) return value;
  if (value.startsWith("pt")) return "pt";
  if (value.startsWith("en")) return "en";
  if (value.startsWith("fr")) return "fr";
  if (value.startsWith("de")) return "de";
  if (value.startsWith("it")) return "it";
  if (value.startsWith("ru")) return "ru";
  if (value.startsWith("ar")) return "ar";
  if (value.startsWith("zh")) return "zh";
  if (value.startsWith("ja")) return "ja";
  if (value.startsWith("ko")) return "ko";
  if (value.startsWith("hi")) return "hi";
  return "es";
};
