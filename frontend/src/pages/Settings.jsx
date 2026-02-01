import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { db } from "../services/dataService";
import { loadAIConfig, saveAIConfig, syncGeminiKeyToLocalStorage } from "../services/aiConfigPersistence";
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
  const [deepseekKey, setDeepseekKey] = useState("");
  const [deepseekEnabled, setDeepseekEnabled] = useState(false);
  const [showDeepseek, setShowDeepseek] = useState(false);
  const [deepseekStatus, setDeepseekStatus] = useState(null);
  const [deepseekError, setDeepseekError] = useState("");
  const [deepseekBaseUrl, setDeepseekBaseUrl] = useState("https://api.deepseek.com/v1");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiEnabled, setOpenaiEnabled] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [openaiStatus, setOpenaiStatus] = useState(null);
  const [openaiError, setOpenaiError] = useState("");
  const [ollamaEnabled, setOllamaEnabled] = useState(false);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3.1");
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [ollamaError, setOllamaError] = useState("");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const aiConfig = await loadAIConfig();
        if (aiConfig.geminiKey) { setGeminiKey(aiConfig.geminiKey); setGeminiStatus("saved"); }
        setGeminiEnabled(aiConfig.geminiEnabled);
        if (aiConfig.baseUrl) setCustomBaseUrl(aiConfig.baseUrl);
        if (aiConfig.openaiKey) setOpenaiKey(aiConfig.openaiKey);
        setOpenaiEnabled(aiConfig.openaiEnabled);
        if (aiConfig.deepseekKey) { setDeepseekKey(aiConfig.deepseekKey); setDeepseekStatus("saved"); }
        setDeepseekEnabled(aiConfig.deepseekEnabled);
        if (aiConfig.deepseekBaseUrl) setDeepseekBaseUrl(aiConfig.deepseekBaseUrl);
        syncGeminiKeyToLocalStorage(aiConfig.geminiKey);

        const dBaseUrl = await db.settings?.get("deepseek_base_url");
        const oLocalEnabled = await db.settings?.get("ollama_enabled");
        const oLocalBase = await db.settings?.get("ollama_base_url");
        const oLocalModel = await db.settings?.get("ollama_model");
        const n = await db.settings?.get("business_name");
        const bt = await db.settings?.get("business_type");
        const du = await db.settings?.get("default_unit");
        const t = await db.settings?.get("tax_rate");

        if (dBaseUrl?.value) setDeepseekBaseUrl(dBaseUrl.value);
        if (oLocalEnabled?.value !== undefined) setOllamaEnabled(oLocalEnabled.value === "true" || oLocalEnabled.value === true);
        if (oLocalBase?.value) setOllamaBaseUrl(oLocalBase.value);
        if (oLocalModel?.value) setOllamaModel(oLocalModel.value);
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
    await saveAIConfig("gemini_enabled", enabled);
    toast.success(enabled ? "Gemini activado" : "Gemini desactivado");
  };

  const saveGemini = async () => {
    await saveAIConfig("ai_api_key", geminiKey || "");
    await saveAIConfig("ai_base_url", customBaseUrl.trim());
    await saveAIConfig("gemini_enabled", true);
    setGeminiEnabled(true);
    setGeminiStatus("saved");
    syncGeminiKeyToLocalStorage(geminiKey || "");
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

  const toggleDeepseek = async (enabled) => {
    setDeepseekEnabled(enabled);
    await saveAIConfig("deepseek_enabled", enabled);
    toast.success(enabled ? "DeepSeek activado" : "DeepSeek desactivado");
  };

  const saveDeepseek = async () => {
    await saveAIConfig("deepseek_api_key", deepseekKey || "");
    await saveAIConfig("deepseek_base_url", deepseekBaseUrl.trim());
    await saveAIConfig("deepseek_enabled", true);
    setDeepseekEnabled(true);
    setDeepseekStatus("saved");
    toast.success("DeepSeek guardado");
  };

  const testDeepseek = async () => {
    if (!deepseekKey) {
      toast.error("Ingresa API Key");
      return;
    }
    setDeepseekStatus("testing");
    setDeepseekError("");
    await saveDeepseek();
    try {
      const response = await fetch(`${deepseekBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + deepseekKey
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "Responde unicamente: OK" },
            { role: "user", content: "OK" }
          ],
          max_tokens: 10,
          temperature: 0
        })
      });
      if (response.ok) {
        setDeepseekStatus("ok");
        setDeepseekError("Conectado");
        toast.success("DeepSeek conectado");
      } else {
        const data = await response.json().catch(() => ({}));
        const message = data?.error?.message || `Error ${response.status}`;
        setDeepseekStatus("error");
        setDeepseekError(message);
        toast.error(message);
      }
    } catch (e) {
      setDeepseekStatus("error");
      setDeepseekError(e.message);
      toast.error("Error: " + e.message);
    }
  };

  const deleteDeepseek = async () => {
    if (!confirm("Borrar configuracion de DeepSeek?")) return;
    setDeepseekKey("");
    setDeepseekStatus(null);
    setDeepseekError("");
    setDeepseekBaseUrl("https://api.deepseek.com/v1");
    setDeepseekEnabled(false);
    await saveAIConfig("deepseek_api_key", "");
    await saveAIConfig("deepseek_base_url", "");
    await saveAIConfig("deepseek_enabled", false);
    toast.success("DeepSeek eliminado");
  };

  const toggleOpenai = async (enabled) => {
    setOpenaiEnabled(enabled);
    await saveAIConfig("openai_enabled", enabled);
    toast.success(enabled ? "OpenAI activado" : "OpenAI desactivado");
  };

  const saveOpenai = async () => {
    await saveAIConfig("openai_api_key", openaiKey || "");
    await saveAIConfig("openai_enabled", true);
    setOpenaiEnabled(true);
    setOpenaiStatus("saved");
    toast.success("OpenAI guardado");
  };

  const testOpenai = async () => {
    if (!openaiKey) {
      toast.error("Ingresa API Key");
      return;
    }
    setOpenaiStatus("testing");
    setOpenaiError("");
    await saveOpenai();
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + openaiKey
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Responde unicamente: OK" },
            { role: "user", content: "OK" }
          ],
          max_tokens: 10,
          temperature: 0
        })
      });
      if (response.ok) {
        setOpenaiStatus("ok");
        setOpenaiError("Conectado");
        toast.success("OpenAI conectado");
      } else {
        const data = await response.json().catch(() => ({}));
        const message = data?.error?.message || `Error ${response.status}`;
        setOpenaiStatus("error");
        setOpenaiError(message);
        toast.error(message);
      }
    } catch (e) {
      setOpenaiStatus("error");
      setOpenaiError(e.message);
      toast.error("Error: " + e.message);
    }
  };

  const deleteOpenai = async () => {
    if (!confirm("Borrar configuracion de OpenAI?")) return;
    setOpenaiKey("");
    setOpenaiStatus(null);
    setOpenaiError("");
    setOpenaiEnabled(false);
    await db.settings?.put({ key: "openai_api_key", value: "" });
    await db.settings?.put({ key: "openai_enabled", value: "false" });
    toast.success("OpenAI eliminado");
  };

  const toggleOllama = async (enabled) => {
    setOllamaEnabled(enabled);
    await db.settings?.put({ key: "ollama_enabled", value: enabled.toString() });
    toast.success(enabled ? "Ollama activado" : "Ollama desactivado");
  };

  const saveOllama = async () => {
    await db.settings?.put({ key: "ollama_enabled", value: "true" });
    await db.settings?.put({ key: "ollama_base_url", value: ollamaBaseUrl.trim() });
    await db.settings?.put({ key: "ollama_model", value: ollamaModel.trim() });
    setOllamaEnabled(true);
    setOllamaStatus("saved");
    toast.success("Ollama guardado");
  };

  const testOllama = async () => {
    setOllamaStatus("testing");
    setOllamaError("");
    await saveOllama();
    try {
      const response = await fetch(`${ollamaBaseUrl.replace(/\/+$/, "")}/api/tags`);
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const firstModel = data?.models?.[0]?.name || "OK";
        setOllamaStatus("ok");
        setOllamaError(`Conectado: ${firstModel}`);
        toast.success("Ollama conectado");
      } else {
        setOllamaStatus("error");
        setOllamaError(`Error ${response.status}`);
        toast.error(`Ollama error ${response.status}`);
      }
    } catch (e) {
      setOllamaStatus("error");
      setOllamaError(e.message);
      toast.error("Error: " + e.message);
    }
  };

  const deleteOllama = async () => {
    if (!confirm("Borrar configuracion de Ollama?")) return;
    setOllamaEnabled(false);
    setOllamaBaseUrl("http://localhost:11434");
    setOllamaModel("llama3.1");
    setOllamaStatus(null);
    setOllamaError("");
    await db.settings?.put({ key: "ollama_enabled", value: "false" });
    await db.settings?.put({ key: "ollama_base_url", value: "" });
    await db.settings?.put({ key: "ollama_model", value: "" });
    toast.success("Ollama eliminado");
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
          <div className="rounded-2xl border bg-slate-900/60 border-slate-700/50 p-4 text-xs text-slate-300">
            <p className="font-semibold text-slate-100">Orden automático de modelos</p>
            <p>Gratis → Económico → Premium. Si falla uno, pasa al siguiente.</p>
            <p className="mt-1 text-slate-400">Gratis: Ollama local, Gemini · Económico: DeepSeek · Premium: OpenAI</p>
          </div>
          <div className={`rounded-2xl border overflow-hidden transition-all duration-300 shadow-lg ${ollamaEnabled ? "bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-cyan-500/30 shadow-cyan-500/20 backdrop-blur-sm" : "bg-slate-900/50 border-slate-700/50 opacity-60"}`}>
            <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-bold text-white">Ollama (local)</h3>
                  <p className="text-xs text-slate-400">http://localhost:11434</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={ollamaStatus} enabled={ollamaEnabled} />
                <Toggle enabled={ollamaEnabled} onChange={toggleOllama} />
              </div>
            </div>

            {ollamaEnabled && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">URL Base</label>
                    <input
                      type="url"
                      value={ollamaBaseUrl}
                      onChange={(e) => setOllamaBaseUrl(e.target.value)}
                      placeholder="http://localhost:11434"
                      className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Modelo</label>
                    <input
                      type="text"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      placeholder="llama3.1"
                      className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>

                {ollamaError && (
                  <div className={`p-2 rounded-lg text-xs ${ollamaStatus === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                    {ollamaError}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={saveOllama} className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg">Guardar</button>
                  <button onClick={testOllama} disabled={ollamaStatus === "testing"} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg disabled:opacity-50">Probar</button>
                  <button onClick={deleteOllama} className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm rounded-lg">Borrar</button>
                </div>
              </div>
            )}
          </div>
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
          <div className={`rounded-2xl border overflow-hidden transition-all duration-300 shadow-lg ${deepseekEnabled ? "bg-gradient-to-br from-emerald-900/20 to-teal-900/20 border-emerald-500/30 shadow-emerald-500/20 backdrop-blur-sm" : "bg-slate-900/50 border-slate-700/50 opacity-60"}`}>
            <div className="p-4 border-b border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-bold text-white">DeepSeek</h3>
                  <p className="text-xs text-slate-400">api.deepseek.com</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={deepseekStatus} enabled={deepseekEnabled} />
                <Toggle enabled={deepseekEnabled} onChange={toggleDeepseek} />
              </div>
            </div>

            {deepseekEnabled && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">API Key</label>
                  <div className="relative">
                    <input
                      type={showDeepseek ? "text" : "password"}
                      value={deepseekKey}
                      onChange={(e) => setDeepseekKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white pr-10 font-mono text-sm"
                    />
                    <button onClick={() => setShowDeepseek(!showDeepseek)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {showDeepseek ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">URL Base (opcional)</label>
                  <input
                    type="url"
                    value={deepseekBaseUrl}
                    onChange={(e) => setDeepseekBaseUrl(e.target.value)}
                    placeholder="https://api.deepseek.com/v1"
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
                  />
                </div>

                {deepseekError && (
                  <div className={`p-2 rounded-lg text-xs ${deepseekStatus === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                    {deepseekError}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={saveDeepseek} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg">Guardar</button>
                  <button onClick={testDeepseek} disabled={deepseekStatus === "testing"} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg disabled:opacity-50">Probar</button>
                  <button onClick={deleteDeepseek} className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm rounded-lg">Borrar</button>
                </div>
              </div>
            )}
          </div>
          <div className={`rounded-2xl border overflow-hidden transition-all duration-300 shadow-lg ${openaiEnabled ? "bg-gradient-to-br from-violet-900/20 to-fuchsia-900/20 border-violet-500/30 shadow-violet-500/20 backdrop-blur-sm" : "bg-slate-900/50 border-slate-700/50 opacity-60"}`}>
            <div className="p-4 border-b border-violet-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-bold text-white">OpenAI (premium)</h3>
                  <p className="text-xs text-slate-400">api.openai.com</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={openaiStatus} enabled={openaiEnabled} />
                <Toggle enabled={openaiEnabled} onChange={toggleOpenai} />
              </div>
            </div>

            {openaiEnabled && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">API Key</label>
                  <div className="relative">
                    <input
                      type={showOpenai ? "text" : "password"}
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white pr-10 font-mono text-sm"
                    />
                    <button onClick={() => setShowOpenai(!showOpenai)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {showOpenai ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                </div>

                {openaiError && (
                  <div className={`p-2 rounded-lg text-xs ${openaiStatus === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                    {openaiError}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={saveOpenai} className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg">Guardar</button>
                  <button onClick={testOpenai} disabled={openaiStatus === "testing"} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg disabled:opacity-50">Probar</button>
                  <button onClick={deleteOpenai} className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm rounded-lg">Borrar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
