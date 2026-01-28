import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { db } from "../services/dataService";
import { BUSINESS_CONFIG_DEFAULTS, setBusinessConfig } from "../config/businessConfig";
import { HiOutlineCode, HiOutlineCog } from "react-icons/hi";
import { diagnoseGemini } from "../utils/testGeminiAPI";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState(BUSINESS_CONFIG_DEFAULTS.businessType);
  const [defaultUnit, setDefaultUnit] = useState(BUSINESS_CONFIG_DEFAULTS.defaultUnit);
  const [taxRate, setTaxRate] = useState(BUSINESS_CONFIG_DEFAULTS.taxRate);

  const [geminiKey, setGeminiKey] = useState("");
  const [geminiEnabled, setGeminiEnabled] = useState(true);
  const [showGemini, setShowGemini] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState(null);
  const [geminiError, setGeminiError] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const g = await db.settings?.get("ai_api_key");
        const gEnabled = await db.settings?.get("gemini_enabled");
        const b = await db.settings?.get("ai_base_url");
        const n = await db.settings?.get("business_name");
        const bt = await db.settings?.get("business_type");
        const du = await db.settings?.get("default_unit");
        const t = await db.settings?.get("tax_rate");

        if (g?.value) { setGeminiKey(atob(g.value)); setGeminiStatus("saved"); }
        if (gEnabled?.value !== undefined) setGeminiEnabled(gEnabled.value === "true" || gEnabled.value === true);
        if (b?.value) setCustomBaseUrl(b.value);
        if (n?.value) setBusinessName(n.value);
        if (bt?.value) setBusinessType(bt.value);
        if (du?.value) setDefaultUnit(du.value);
        if (t?.value) setTaxRate(parseFloat(t.value));

        setBusinessConfig({
          businessName: n?.value || BUSINESS_CONFIG_DEFAULTS.businessName,
          businessType: bt?.value || BUSINESS_CONFIG_DEFAULTS.businessType,
          currency: "CUP",
          defaultUnit: du?.value || BUSINESS_CONFIG_DEFAULTS.defaultUnit,
          taxRate: t?.value ? parseFloat(t.value) : BUSINESS_CONFIG_DEFAULTS.taxRate,
          appLanguage: "es",
          dateLocale: "es-CU"
        });
      } catch (e) {
        console.error("Error:", e);
      }
    };
    loadSettings();
  }, []);

  const saveGeneral = async () => {
    await db.settings?.put({ key: "business_name", value: businessName });
    await db.settings?.put({ key: "business_type", value: businessType });
    await db.settings?.put({ key: "country", value: "CU" });
    await db.settings?.put({ key: "currency", value: "CUP" });
    await db.settings?.put({ key: "secondary_currency", value: "" });
    await db.settings?.put({ key: "active_currency", value: "CUP" });
    await db.settings?.put({ key: "app_language", value: "es" });
    await db.settings?.put({ key: "tax_rate", value: String(taxRate) });
    await db.settings?.put({ key: "default_unit", value: defaultUnit });
    await db.settings?.put({ key: "date_locale", value: "es-CU" });
    setBusinessConfig({
      businessName,
      businessType,
      currency: "CUP",
      appLanguage: "es",
      taxRate,
      defaultUnit,
      dateLocale: "es-CU"
    });
    toast.success("Guardado");
  };

  const toggleGemini = async (enabled) => {
    setGeminiEnabled(enabled);
    await db.settings?.put({ key: "gemini_enabled", value: enabled.toString() });
    toast.success(enabled ? "Gemini activado" : "Gemini desactivado");
  };

  const saveGemini = async () => {
    await db.settings?.put({ key: "ai_api_key", value: geminiKey ? btoa(geminiKey) : "" });
    await db.settings?.put({ key: "ai_base_url", value: customBaseUrl.trim() });
    await db.settings?.put({ key: "gemini_enabled", value: "true" });
    setGeminiEnabled(true);
    setGeminiStatus("saved");
    toast.success("Gemini guardado");
  };

  const testGemini = async () => {
    if (!geminiKey) {
      toast.error("Ingresa API Key");
      return;
    }
    setGeminiStatus("testing");
    setGeminiError("");
    await saveGemini();
    try {
      const result = await diagnoseGemini(geminiKey);
      if (result.valid) {
        setGeminiStatus("ok");
        setGeminiError(`Conectado: ${result.workingModel}`);
        toast.success(`Conectado con ${result.workingModel}`);
      } else {
        setGeminiStatus("error");
        setGeminiError(result.message || "No se pudo conectar");
        toast.error(result.message || "No se pudo conectar");
      }
    } catch (e) {
      setGeminiStatus("error");
      setGeminiError(e.message);
      toast.error("Error: " + e.message);
    }
  };

  const deleteGemini = async () => {
    if (!confirm("Borrar configuracion de Gemini?")) return;
    setGeminiKey("");
    setGeminiStatus(null);
    setGeminiError("");
    setCustomBaseUrl("");
    setGeminiEnabled(false);
    await db.settings?.put({ key: "ai_api_key", value: "" });
    await db.settings?.put({ key: "ai_base_url", value: "" });
    await db.settings?.put({ key: "gemini_enabled", value: "false" });
    toast.success("Gemini eliminado");
  };

  const StatusBadge = ({ status, enabled }) => {
    if (!enabled) return <span className="px-2 py-1 bg-slate-700/50 text-slate-500 text-xs rounded-full">Desactivado</span>;
    if (status === "testing") return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full animate-pulse">Probando...</span>;
    if (status === "ok") return <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">Conectado</span>;
    if (status === "saved") return <span className="px-2 py-1 bg-violet-500/20 text-violet-400 text-xs rounded-full">Guardado</span>;
    if (status === "error") return <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">Error</span>;
    return <span className="px-2 py-1 bg-slate-600/50 text-slate-400 text-xs rounded-full">Sin configurar</span>;
  };

  const Toggle = ({ enabled, onChange }) => (
    <button onClick={() => onChange(!enabled)} className={`relative w-14 h-7 rounded-full transition-all ${enabled ? "bg-emerald-600" : "bg-slate-700"}`}>
      <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow ${enabled ? "left-8" : "left-1"}`}></span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 p-1.5 bg-gradient-to-r from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-lg w-fit">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-5 py-3 rounded-xl font-medium text-sm transition-all duration-300 flex items-center gap-2 ${
            activeTab === "general"
              ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-700/50"
          }`}
        >
          <HiOutlineCog className="w-4 h-4" />
          General
        </button>
        <button
          onClick={() => setActiveTab("ia")}
          className={`px-5 py-3 rounded-xl font-medium text-sm transition-all duration-300 flex items-center gap-2 ${
            activeTab === "ia"
              ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-700/50"
          }`}
        >
          <HiOutlineCode className="w-4 h-4" />
          Motor de IA
        </button>
      </div>

      {activeTab === "general" && (
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 space-y-6 shadow-lg">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-700/50">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30">
              <HiOutlineCog className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Configuración Básica</h2>
              <p className="text-xs text-slate-400">Panadería y dulcería en Cuba</p>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Nombre del Negocio</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="RAULI"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Rubro</label>
              <input
                type="text"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder="Panaderia y Dulceria"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Unidad por defecto</label>
              <select
                value={defaultUnit}
                onChange={(e) => setDefaultUnit(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
              >
                <option value="unidad">Unidad</option>
                <option value="kg">Kg</option>
                <option value="litro">Litro</option>
                <option value="paquete">Paquete</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-300">
              País fijo: Cuba
            </div>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-300">
              Moneda fija: CUP
            </div>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-300">
              Idioma fijo: Español (Cuba)
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Impuesto</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
            />
          </div>

          <button onClick={saveGeneral} className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-2xl shadow-xl shadow-violet-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-95">
            Guardar
          </button>
        </div>
      )}

      {activeTab === "ia" && (
        <div className="space-y-6">
          <div className={`rounded-2xl border overflow-hidden transition-all duration-300 shadow-lg ${geminiEnabled ? "bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border-blue-500/30 shadow-blue-500/20 backdrop-blur-sm" : "bg-slate-900/50 border-slate-700/50 opacity-60"}`}>
            <div className="p-4 border-b border-blue-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-bold text-white">Google Gemini</h3>
                  <p className="text-xs text-slate-400">aistudio.google.com/app/apikey</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={geminiStatus} enabled={geminiEnabled} />
                <Toggle enabled={geminiEnabled} onChange={toggleGemini} />
              </div>
            </div>

            {geminiEnabled && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">API Key</label>
                  <div className="relative">
                    <input
                      type={showGemini ? "text" : "password"}
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="AIza..."
                      className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white pr-10 font-mono text-sm"
                    />
                    <button onClick={() => setShowGemini(!showGemini)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {showGemini ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Proxy / URL Base (opcional)</label>
                  <input
                    type="url"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    placeholder="Vacio = URL oficial de Google"
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
                  />
                </div>

                {geminiError && (
                  <div className={`p-2 rounded-lg text-xs ${geminiStatus === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                    {geminiError}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={saveGemini} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">Guardar</button>
                  <button onClick={testGemini} disabled={geminiStatus === "testing"} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg disabled:opacity-50">Probar</button>
                  <button onClick={deleteGemini} className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm rounded-lg">Borrar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
