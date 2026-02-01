export const BUSINESS_CONFIG_DEFAULTS = {
  businessName: "RAULI",
  businessType: "Panaderia y Dulceria",
  currency: "CUP",
  secondaryCurrency: "",
  activeCurrency: "",
  appLanguage: "es",
  taxRate: 0.1,
  defaultUnit: "unidad",
  dateLocale: navigator.language || "es-CU",
  dateFormatOptions: { day: "2-digit", month: "short", year: "numeric" }
};

export const AUDIT_ALERT_DEFAULTS = {
  anomalyMultiplier: 2,
  anomalyMin: 3,
  entityAlertMultiplier: 2,
  entityThresholds: {},
  severityProfile: "normal",
  severityMultipliers: {
    low: 1.2,
    medium: 1.6
  },
  entitySeverityMultipliers: {},
  auditUserProfiles: {},
  auditRoleProfiles: {
    admin: "normal",
    gerente: "normal",
    cajero: "normal"
  },
  auditUserRoles: {}
};

export const FEATURE_FLAGS_DEFAULTS = {
  tables: false,
  shipping: false,
  production: true,
  inventory: true,
  cash: true,
  reports: true
};

const STORAGE_KEYS = {
  businessName: "genesis_business_name",
  businessType: "genesis_business_type",
  currency: "genesis_currency",
  secondaryCurrency: "genesis_secondary_currency",
  activeCurrency: "genesis_active_currency",
  appLanguage: "genesis_app_language",
  taxRate: "genesis_tax_rate",
  defaultUnit: "genesis_default_unit",
  dateLocale: "genesis_date_locale",
  featureFlags: "genesis_feature_flags",
  auditAlerts: "genesis_audit_alerts"
};

const LEGACY_STORAGE_KEYS = {
  businessName: "rauli_business_name",
  businessType: "rauli_business_type",
  currency: "rauli_currency",
  secondaryCurrency: "rauli_secondary_currency",
  activeCurrency: "rauli_active_currency",
  appLanguage: "rauli_app_language",
  taxRate: "rauli_tax_rate",
  defaultUnit: "rauli_default_unit",
  dateLocale: "rauli_date_locale",
  featureFlags: "rauli_feature_flags",
  auditAlerts: "rauli_audit_alerts"
};

const readWithMigration = (key, legacyKey) => {
  try {
    const current = localStorage.getItem(key);
    if (current !== null) return current;
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null) {
      localStorage.setItem(key, legacy);
      return legacy;
    }
  } catch {}
  return null;
};

export const getBusinessConfig = () => {
  const stored = {
    businessName: readWithMigration(STORAGE_KEYS.businessName, LEGACY_STORAGE_KEYS.businessName) || undefined,
    businessType: readWithMigration(STORAGE_KEYS.businessType, LEGACY_STORAGE_KEYS.businessType) || undefined,
    currency: readWithMigration(STORAGE_KEYS.currency, LEGACY_STORAGE_KEYS.currency) || undefined,
    secondaryCurrency: readWithMigration(STORAGE_KEYS.secondaryCurrency, LEGACY_STORAGE_KEYS.secondaryCurrency) || undefined,
    activeCurrency: readWithMigration(STORAGE_KEYS.activeCurrency, LEGACY_STORAGE_KEYS.activeCurrency) || undefined,
    appLanguage: readWithMigration(STORAGE_KEYS.appLanguage, LEGACY_STORAGE_KEYS.appLanguage) || undefined,
    taxRate: readWithMigration(STORAGE_KEYS.taxRate, LEGACY_STORAGE_KEYS.taxRate) || undefined,
    defaultUnit: readWithMigration(STORAGE_KEYS.defaultUnit, LEGACY_STORAGE_KEYS.defaultUnit) || undefined,
    dateLocale: readWithMigration(STORAGE_KEYS.dateLocale, LEGACY_STORAGE_KEYS.dateLocale) || undefined
  };

  const currency = stored.currency && String(stored.currency).trim()
    ? stored.currency
    : BUSINESS_CONFIG_DEFAULTS.currency;
  const secondaryCurrency = stored.secondaryCurrency && String(stored.secondaryCurrency).trim()
    ? stored.secondaryCurrency
    : BUSINESS_CONFIG_DEFAULTS.secondaryCurrency;
  const activeCurrency = stored.activeCurrency && String(stored.activeCurrency).trim()
    ? stored.activeCurrency
    : currency;
  const appLanguage = stored.appLanguage && String(stored.appLanguage).trim()
    ? stored.appLanguage
    : BUSINESS_CONFIG_DEFAULTS.appLanguage;
  const dateLocale = stored.dateLocale && String(stored.dateLocale).trim()
    ? stored.dateLocale
    : BUSINESS_CONFIG_DEFAULTS.dateLocale;

  return {
    ...BUSINESS_CONFIG_DEFAULTS,
    ...stored,
    currency,
    secondaryCurrency,
    activeCurrency,
    appLanguage,
    dateLocale,
    taxRate: stored.taxRate ? parseFloat(stored.taxRate) : BUSINESS_CONFIG_DEFAULTS.taxRate
  };
};

export const setBusinessConfig = (partial) => {
  try {
    if (partial.businessName !== undefined) localStorage.setItem(STORAGE_KEYS.businessName, partial.businessName);
    if (partial.businessType !== undefined) localStorage.setItem(STORAGE_KEYS.businessType, partial.businessType);
    if (partial.currency !== undefined) localStorage.setItem(STORAGE_KEYS.currency, partial.currency);
    if (partial.secondaryCurrency !== undefined) localStorage.setItem(STORAGE_KEYS.secondaryCurrency, partial.secondaryCurrency);
    if (partial.activeCurrency !== undefined) localStorage.setItem(STORAGE_KEYS.activeCurrency, partial.activeCurrency);
    if (partial.appLanguage !== undefined) localStorage.setItem(STORAGE_KEYS.appLanguage, partial.appLanguage);
    if (partial.taxRate !== undefined) localStorage.setItem(STORAGE_KEYS.taxRate, String(partial.taxRate));
    if (partial.defaultUnit !== undefined) localStorage.setItem(STORAGE_KEYS.defaultUnit, partial.defaultUnit);
    if (partial.dateLocale !== undefined) localStorage.setItem(STORAGE_KEYS.dateLocale, partial.dateLocale);
  } catch {}
};

export const getFeatureFlags = () => {
  try {
    const raw = readWithMigration(STORAGE_KEYS.featureFlags, LEGACY_STORAGE_KEYS.featureFlags);
    if (raw) {
      return { ...FEATURE_FLAGS_DEFAULTS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...FEATURE_FLAGS_DEFAULTS };
};

export const setFeatureFlags = (flags) => {
  try {
    localStorage.setItem(STORAGE_KEYS.featureFlags, JSON.stringify(flags));
  } catch {}
};

export const getAuditAlertConfig = () => {
  try {
    const raw = readWithMigration(STORAGE_KEYS.auditAlerts, LEGACY_STORAGE_KEYS.auditAlerts);
    if (raw) {
      return { ...AUDIT_ALERT_DEFAULTS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...AUDIT_ALERT_DEFAULTS };
};

export const setAuditAlertConfig = (config) => {
  try {
    localStorage.setItem(STORAGE_KEYS.auditAlerts, JSON.stringify(config));
  } catch {}
};

export const formatCurrency = (amount, currencyCode) => {
  const config = getBusinessConfig();
  const currency = (currencyCode && String(currencyCode).trim()) || config.activeCurrency || config.currency || BUSINESS_CONFIG_DEFAULTS.currency;
  return new Intl.NumberFormat(config.dateLocale, {
    style: "currency",
    currency
  }).format(amount || 0);
};

export const getCurrencySymbol = (currencyCode) => {
  const config = getBusinessConfig();
  const currency = (currencyCode && String(currencyCode).trim()) || config.currency || BUSINESS_CONFIG_DEFAULTS.currency;
  return new Intl.NumberFormat(config.dateLocale, {
    style: "currency",
    currency
  })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value || "";
};

export const CURRENCY_SYMBOL = getCurrencySymbol();

export const formatDate = (date, options) => {
  if (!date) return "-";
  const config = getBusinessConfig();
  const finalOptions = options || config.dateFormatOptions;
  return new Intl.DateTimeFormat(config.dateLocale, finalOptions).format(new Date(date));
};
