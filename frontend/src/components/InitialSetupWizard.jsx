import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../services/dataService";
import { setBusinessConfig } from "../config/businessConfig";
import { putSecureSetting } from "../services/secureStorage";
import toast from "react-hot-toast";
import { COUNTRIES, findCountryByInput, formatCountryOption, getCountryByCode } from "../config/countries";
import { employees as employeesApi } from "../services/api";
import DataManager from "../services/DataManager";

const ROLES = ["Cajero", "Inventario", "Gerente"];
const DRAFT_LOCAL_KEY = "setup_draft_local_v1";

const generateInviteCodes = (count, defaultRole) => {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    const code = `EMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    codes.push({
      code,
      role: defaultRole,
      name: "",
      email: "",
      status: "pending",
      sentAt: "",
      error: "",
      created_at: new Date().toISOString()
    });
  }
  return codes;
};

export default function InitialSetupWizard({ onComplete, onBack }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    businessName: "",
    legalName: "",
    taxId: "",
    country: "DO",
    currency: "DOP",
    secondaryCurrency: "",
    activeCurrency: "",
    dateLocale: "es-DO",
    isAutonomo: false,
    employees: 1,
    accountingStandard: "ifrs",
    invoiceSystem: "interno",
    invoiceSeries: "A",
    defaultUom: "ud",
    payrollCycle: "mensual",
    payrollSystem: "mensual",
    payrollSystemCustom: "",
    payrollRules: {
      hourly: false,
      overtimeMultiplier: 1.5,
      nightMultiplier: 1.25,
      weekendMultiplier: 1.5,
      performanceBonus: "none",
      profitSharePercent: 0,
      deductionsPercent: 0
    },
    ownerName: "",
    ownerEmail: "",
    ownerPhone: ""
  });
  const [defaultRole, setDefaultRole] = useState("Cajero");
  const [invitesMenuOpen, setInvitesMenuOpen] = useState(false);
  const [invites, setInvites] = useState([]);
  const [stepError, setStepError] = useState("");
  const [stepWarning, setStepWarning] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [dataBootstrapChoice, setDataBootstrapChoice] = useState("");
  const [isDbEmpty, setIsDbEmpty] = useState(false);
  const [importType, setImportType] = useState("customers");
  const [importResult, setImportResult] = useState("");
  const [importRowsCount, setImportRowsCount] = useState(1);
  const [importing, setImporting] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState({
    business: true,
    imports: false,
    hr: false,
    invites: true
  });
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
  const hasLoadedDraftRef = useRef(false);
  const autosaveTimeoutRef = useRef(null);

  const country = useMemo(() => COUNTRIES.find((c) => c.id === form.country), [form.country]);
  const customRoleOptions = useMemo(() => {
    const values = new Set();
    const addValue = (value) => {
      const trimmed = String(value || "").trim();
      if (!trimmed) return;
      if (!ROLES.includes(trimmed)) values.add(trimmed);
    };
    addValue(defaultRole);
    invites.forEach((invite) => addValue(invite.role));
    return Array.from(values);
  }, [invites, defaultRole]);

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const stored = await db.settings?.get("setup_draft");
        let draft = null;
        if (stored?.value) {
          draft = JSON.parse(stored.value);
        } else {
          const localDraft = localStorage.getItem(DRAFT_LOCAL_KEY);
          if (localDraft) {
            draft = JSON.parse(localDraft);
          }
        }
        if (!draft) return;
        if (draft?.form) setForm((prev) => ({ ...prev, ...draft.form }));
        if (draft?.invites) setInvites(draft.invites);
        if (draft?.defaultRole) setDefaultRole(draft.defaultRole);
        setDraftLoaded(true);
      } catch (e) {
        console.error("Draft load error:", e);
      }
      hasLoadedDraftRef.current = true;
    };
    loadDraft();
  }, []);

  useEffect(() => {
    if (!hasLoadedDraftRef.current) return;
    setDraftDirty(true);
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(async () => {
      setDraftSaving(true);
      const payload = { form, invites, defaultRole };
      try {
        localStorage.setItem(DRAFT_LOCAL_KEY, JSON.stringify(payload));
      } catch {}
      try {
        await db.settings?.put({ key: "setup_draft", value: JSON.stringify(payload) });
      } catch {}
      setDraftSavedAt(new Date().toLocaleTimeString());
      setDraftDirty(false);
      setDraftSaving(false);
    }, 500);
    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
  }, [form, invites, defaultRole]);

  useEffect(() => {
    const loadBootstrap = async () => {
      try {
        const stored = await db.settings?.get("data_bootstrap_choice");
        if (stored?.value) setDataBootstrapChoice(stored.value);
        const empty = await DataManager.isDatabaseEmpty();
        setIsDbEmpty(empty);
      } catch (e) {
        console.error("Bootstrap load error:", e);
      }
    };
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (form.isAutonomo) {
      setSectionsOpen((prev) => ({
        ...prev,
        imports: false,
        hr: false,
        invites: false
      }));
    }
  }, [form.isAutonomo]);

  const syncCountry = (value) => {
    const next = COUNTRIES.find((c) => c.id === value);
    setForm((prev) => ({
      ...prev,
      country: value,
      currency: next?.currencies?.includes(prev.currency) ? prev.currency : (next?.currency || prev.currency),
      secondaryCurrency: next?.currencies?.includes(prev.secondaryCurrency) ? prev.secondaryCurrency : "",
      activeCurrency: next?.currencies?.includes(prev.activeCurrency) ? prev.activeCurrency : "",
      dateLocale: next?.locale || prev.dateLocale
    }));
  };

  useEffect(() => {
    const selected = getCountryByCode(form.country);
    if (selected) setCountryQuery(formatCountryOption(selected));
  }, [form.country]);

  const handleGenerateInvites = () => {
    const count = Math.max(1, Number(form.employees || 1));
    if (invites.length > 0 && !confirm("Esto regenerará los códigos y borrará las ediciones actuales. ¿Continuar?")) {
      return;
    }
    setInvites(generateInviteCodes(count, defaultRole));
  };

  const handleAddInvite = () => {
    setInvites((prev) => [...prev, ...generateInviteCodes(1, defaultRole)]);
    setForm((prev) => ({
      ...prev,
      employees: String(Number(prev.employees || 0) + 1)
    }));
  };

  const handleRemoveInvite = (code) => {
    setInvites((prev) => prev.filter((invite) => invite.code !== code));
  };

  const handleSyncInviteCount = () => {
    const count = Math.max(1, Number(form.employees || 1));
    if (invites.length === count) {
      toast("Ya tienes el mismo número de invitaciones.");
      return;
    }
    if (invites.length < count) {
      const missing = count - invites.length;
      setInvites((prev) => [...prev, ...generateInviteCodes(missing, defaultRole)]);
      toast.success(`Se agregaron ${missing} invitaciones.`);
      return;
    }
    if (confirm(`Hay ${invites.length} invitaciones. ¿Deseas reducir a ${count}?`)) {
      setInvites((prev) => prev.slice(0, count));
    }
  };

  const handleUpdateInvite = (code, changes) => {
    setInvites((prev) => prev.map((invite) => (
      invite.code === code ? {
        ...invite,
        ...changes,
        ...(changes.email !== undefined || changes.name !== undefined || changes.role !== undefined
          ? { status: "pending", error: "" }
          : {})
      } : invite
    )));
  };

  const handleDownloadInvites = () => {
    if (!invites.length) return;
    const rows = invites.map((i) => `${i.code},${i.role},${i.name || ""},${i.email || ""},${i.status || "pending"},${i.sentAt || ""},${i.created_at}`);
    const csv = ["codigo,rol,nombre,email,estado,enviado_en,fecha", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "genesis_empleados.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSendInvites = async () => {
    if (!form.ownerEmail?.trim()) {
      toast.error("Agrega el email del dueño para enviar invitaciones.");
      return;
    }
    const recipients = invites.map((invite) => invite.email?.trim()).filter(Boolean);
    if (!recipients.length) {
      toast.error("Agrega al menos un email en las invitaciones.");
      return;
    }
    try {
      const payload = {
        ownerEmail: form.ownerEmail.trim(),
        invites,
        appUrl: window.location.origin,
        businessName: form.businessName || form.legalName,
        language: localStorage.getItem("app_language") || "es"
      };
      const { data } = await employeesApi.sendInvites(payload);
      const sentSet = new Set((data.sent || []).map((email) => String(email).toLowerCase()));
      const failedMap = new Map((data.failed || []).map((item) => [String(item.email).toLowerCase(), item.error]));
      const now = new Date().toISOString();
      setInvites((prev) => prev.map((invite) => {
        const emailKey = String(invite.email || "").toLowerCase();
        if (sentSet.has(emailKey)) {
          return { ...invite, status: "sent", sentAt: now, error: "" };
        }
        if (failedMap.has(emailKey)) {
          return { ...invite, status: "failed", error: failedMap.get(emailKey) || "Error al enviar" };
        }
        return invite;
      }));
      if (data.failed?.length) {
        const firstError = data.failed[0]?.error;
        toast.error(firstError ? `Error SMTP: ${firstError}` : `Enviadas con errores: ${data.failed.length}`);
      } else {
        toast.success("Invitaciones enviadas correctamente.");
      }
    } catch (error) {
      const message = error?.data?.message || error?.message || "No se pudieron enviar las invitaciones.";
      setInvites((prev) => prev.map((invite) => {
        if (!invite.email) return invite;
        return { ...invite, status: "failed", error: message };
      }));
      toast.error(message);
    }
  };

  const handleBootstrapChoice = async (choice) => {
    setDataBootstrapChoice(choice);
    await db.settings?.put({ key: "data_bootstrap_choice", value: choice });
    if (choice === "template") {
      const result = await DataManager.loadStandardChartOfAccounts();
      if (result?.skipped) {
        toast("Las cuentas contables ya existen.");
      } else {
        toast.success(`Plantilla cargada (${result.inserted || 0} cuentas).`);
      }
    }
    if (choice === "empty") {
      toast.success("Configuración base lista para comenzar.");
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult("");
    try {
      const result = await DataManager.importFromFile(file, { type: importType });
      const message = `Importados: ${result.inserted || 0} • Omitidos: ${result.skipped || 0}`;
      setImportResult(message);
      toast.success(message);
    } catch (error) {
      toast.error(error?.message || "No se pudo importar el archivo.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const getImportTemplateConfig = (type) => {
    if (type === "inventory") {
      return {
        filename: "plantilla_inventario.csv",
        headers: ["nombre", "codigo", "precio", "costo", "stock", "unidad", "categoria"]
      };
    }
    if (type === "categories") {
      return { filename: "plantilla_categorias.csv", headers: ["nombre"] };
    }
    if (type === "accounts") {
      return { filename: "plantilla_cuentas.csv", headers: ["codigo", "nombre", "tipo", "codigo_padre"] };
    }
    if (type === "expenses") {
      return { filename: "plantilla_gastos.csv", headers: ["proveedor", "monto", "categoria", "fecha"] };
    }
    return {
      filename: "plantilla_clientes.csv",
      headers: ["nombre", "telefono", "email", "saldo"]
    };
  };

  const handleDownloadImportTemplate = () => {
    const { filename, headers } = getImportTemplateConfig(importType);
    const rows = Math.max(1, Number(importRowsCount || 1));
    const emptyRows = Array.from({ length: rows }, () => headers.map(() => "").join(","));
    const csv = [headers.join(","), ...emptyRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSeedImportRows = async () => {
    const rows = Math.max(1, Number(importRowsCount || 1));
    try {
      if (importType === "customers") {
        const items = Array.from({ length: rows }, (_, i) => ({
          name: `Cliente ${i + 1}`,
          phone: "",
          email: "",
          balance: 0,
          active: 1,
          deleted_at: null
        }));
        await db.customers?.bulkAdd(items);
      } else if (importType === "inventory") {
        const now = Date.now();
        const items = Array.from({ length: rows }, (_, i) => ({
          id: `prod_seed_${now}_${i}`,
          name: `Producto ${i + 1}`,
          barcode: "",
          category_id: null,
          price: 0,
          cost: 0,
          stock: 0,
          uom: String(form.defaultUom || "ud"),
          active: 1,
          deleted_at: null,
          synced: 0
        }));
        await db.products?.bulkAdd(items);
      } else if (importType === "categories") {
        const now = Date.now();
        const items = Array.from({ length: rows }, (_, i) => ({
          id: `cat_seed_${now}_${i}`,
          name: `Categoría ${i + 1}`,
          active: 1,
          deleted_at: null
        }));
        await db.categories?.bulkAdd(items);
      } else if (importType === "accounts") {
        const base = 1000;
        const now = Date.now();
        const items = Array.from({ length: rows }, (_, i) => ({
          id: `acc_seed_${now}_${i}`,
          code: String(base + i),
          name: `Cuenta ${base + i}`,
          type: "asset",
          parent: null,
          active: 1
        }));
        await db.accounts?.bulkAdd(items);
      } else if (importType === "expenses") {
        const today = new Date().toISOString().slice(0, 10);
        const items = Array.from({ length: rows }, (_, i) => ({
          date: today,
          category: "otros",
          vendor: `Proveedor ${i + 1}`,
          amount: 0.01,
          status: "recorded",
          evidence_id: null,
          ai_extracted: 0,
          deleted_at: null,
          synced: 0
        }));
        await db.expenses?.bulkAdd(items);
      }
      toast.success("Registros base creados.");
    } catch (error) {
      toast.error(error?.message || "No se pudieron crear registros base.");
    }
  };

  const handleFinish = async () => {
    try {
      setStepError("");
      setStepWarning("");
      await db.settings?.put({ key: "business_name", value: form.businessName });
      await putSecureSetting("legal_name", form.legalName);
      await putSecureSetting("tax_id", form.taxId);
      await putSecureSetting("owner_name", form.ownerName);
      await putSecureSetting("owner_email", form.ownerEmail);
      await putSecureSetting("owner_phone", form.ownerPhone);
      await db.settings?.put({ key: "country", value: form.country });
      await db.settings?.put({ key: "currency", value: form.currency });
      await db.settings?.put({ key: "secondary_currency", value: form.secondaryCurrency || "" });
      await db.settings?.put({ key: "active_currency", value: form.activeCurrency || form.currency });
      await db.settings?.put({ key: "date_locale", value: form.dateLocale });
      await db.settings?.put({ key: "business_is_autonomo", value: form.isAutonomo ? "true" : "false" });
      await db.settings?.put({ key: "employees_count", value: String(form.employees) });
      await db.settings?.put({ key: "accounting_standard", value: form.accountingStandard });
      await db.settings?.put({ key: "invoice_system", value: form.invoiceSystem });
      await db.settings?.put({ key: "invoice_series", value: form.invoiceSeries });
      await db.settings?.put({ key: "default_uom", value: form.defaultUom });
      await db.settings?.put({ key: "ai_automation_enabled", value: "true" });
      await db.settings?.put({ key: "worker_invites", value: JSON.stringify(invites) });
      await db.settings?.put({ key: "setup_completed", value: "true" });
      await db.settings?.delete("setup_draft");
      try { localStorage.removeItem(DRAFT_LOCAL_KEY); } catch {}

      setBusinessConfig({
        businessName: form.businessName,
        currency: form.currency,
        secondaryCurrency: form.secondaryCurrency || "",
        activeCurrency: form.activeCurrency || form.currency,
        dateLocale: form.dateLocale
      });

      toast.success("Configuración guardada");
      onComplete();
      return true;
    } catch (e) {
      toast.error("No se pudo guardar la configuración");
      console.error("Setup error:", e);
      return false;
    }
  };

  const handleSaveDraft = async () => {
    try {
      const payload = { form, invites, defaultRole };
      await db.settings?.put({ key: "setup_draft", value: JSON.stringify(payload) });
      try { localStorage.setItem(DRAFT_LOCAL_KEY, JSON.stringify(payload)); } catch {}
      toast.success("Borrador guardado");
    } catch (e) {
      toast.error("No se pudo guardar el borrador");
    }
  };

  const handleResetDraft = async () => {
    try {
      await db.settings?.delete("setup_draft");
    } catch {}
    try { localStorage.removeItem(DRAFT_LOCAL_KEY); } catch {}
    setDraftLoaded(false);
    setForm((prev) => ({
      ...prev,
      businessName: "",
      legalName: "",
      taxId: "",
      employees: 1,
      payrollSystemCustom: "",
      ownerName: "",
      ownerEmail: "",
      ownerPhone: ""
    }));
    setInvites([]);
    setDefaultRole("cajero");
    toast.success("Borrador reiniciado");
  };

  const getStepWarnings = () => {
    const missing = [];
    if (!form.ownerName.trim()) missing.push("Nombre del dueño");
    if (!form.ownerEmail.trim()) missing.push("Email del dueño");
    if (!form.businessName.trim()) missing.push("Nombre del negocio");
    if (!form.taxId.trim()) missing.push("RNC/RUC/NIF");
    if (!form.country) missing.push("País");
    if (!form.currency.trim()) missing.push("Moneda");
    if (!form.dateLocale.trim()) missing.push("Locale");
    if (!form.employees) missing.push("Cantidad de trabajadores");
    if (!form.defaultUom.trim()) missing.push("Unidad de medida");
    if (!form.accountingStandard) missing.push("Norma contable");
    if (!form.invoiceSystem) missing.push("Tipo de comprobante");
    if (!form.invoiceSeries.trim()) missing.push("Serie de facturación");
    if (missing.length === 0) return "";
    return `Faltan: ${missing.join(", ")}. Si sales ahora, se usarán valores por defecto y podrías tener inconsistencias contables o de facturación.`;
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/95 text-white z-[70] flex items-center justify-center p-2 overflow-y-auto">
        <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl p-3 space-y-2.5 max-h-[90vh] overflow-y-auto pr-1 my-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Configuración inicial</h2>
          <div className="flex items-center gap-2">
            {draftLoaded && (
              <button
                onClick={handleResetDraft}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
              >
                Reiniciar borrador
              </button>
            )}
            <span className="text-[11px] text-slate-400">Hoja única</span>
          </div>
        </div>
        {(draftLoaded || draftSavedAt || draftDirty || draftSaving) && (
          <div
            className={`rounded-lg px-3 py-1.5 text-[11px] ${
              draftDirty || draftSaving
                ? "bg-amber-500/10 border border-amber-400/30 text-amber-300"
                : "bg-emerald-500/10 border border-emerald-400/30 text-emerald-300"
            }`}
          >
            <span className="mr-1">
              {draftSaving ? "…" : draftDirty ? "⏳" : "✓"}
            </span>
            {draftLoaded ? "Borrador cargado." : "Borrador en progreso."}{" "}
            {draftSaving
              ? "Guardando..."
              : draftSavedAt
                ? `Último guardado: ${draftSavedAt}`
                : "Sin cambios"}
          </div>
        )}

        <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-[11px] text-slate-200">
          <p className="font-semibold text-slate-100">Antes de continuar</p>
          <p className="text-slate-300 mt-1">
            Para Contabilidad y RRHH ten a mano: RNC/RUC/NIF, marco contable, serie de comprobantes,
            roles y ciclo de nómina.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              onClick={() => navigate("/accounting/advanced")}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
            >
              Ir a Contabilidad
            </button>
            <button
              type="button"
              onClick={() => navigate("/employees?tab=payroll")}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
            >
              Ir a RRHH
            </button>
            <span className="text-[11px] text-slate-400 self-center">
              También te recordaremos esto al abrir esas secciones.
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="border border-slate-700 rounded-xl">
            <button
              type="button"
              onClick={() => setSectionsOpen((prev) => ({ ...prev, business: !prev.business }))}
              className="w-full flex items-center justify-between px-4 py-1.5 text-left"
            >
              <span className="text-sm font-semibold text-slate-200">Datos del negocio</span>
              <span className="text-[11px] text-slate-400">
                {sectionsOpen.business ? "Ocultar" : "Mostrar"}
              </span>
            </button>
            {sectionsOpen.business && (
              <div className="grid gap-3 md:grid-cols-2 px-4 pb-2">
            <input
              value={form.ownerName}
              onChange={(e) => setForm((prev) => ({ ...prev, ownerName: e.target.value }))}
              placeholder="Nombre del dueño"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
            />
            <input
              type="email"
              value={form.ownerEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, ownerEmail: e.target.value }))}
              placeholder="Email del dueño"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
            />
            <input
              value={form.ownerPhone}
              onChange={(e) => setForm((prev) => ({ ...prev, ownerPhone: e.target.value }))}
              placeholder="Teléfono del dueño"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
            />
            <input
              value={form.businessName}
              onChange={(e) => setForm((prev) => ({ ...prev, businessName: e.target.value }))}
              placeholder="Nombre del negocio"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
            />
            <input
              value={form.legalName}
              onChange={(e) => setForm((prev) => ({ ...prev, legalName: e.target.value }))}
              placeholder="Razón social"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
            />
            <input
              value={form.taxId}
              onChange={(e) => setForm((prev) => ({ ...prev, taxId: e.target.value }))}
              placeholder="RNC/RUC/NIF"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
            />
            <label className="flex items-center gap-2 text-[13px] text-slate-300 md:col-span-2">
              <input
                type="checkbox"
                checked={form.isAutonomo}
                onChange={(e) => setForm((prev) => ({ ...prev, isAutonomo: e.target.checked }))}
                className="accent-violet-600"
              />
              Soy autónomo / trabajador independiente
            </label>
            {form.isAutonomo && (
              <div className="md:col-span-2 text-[11px] text-amber-300">
                Ruta simplificada activada: se priorizan flujos básicos de facturación y gastos personales.
              </div>
            )}
            {form.isAutonomo && (
              <div className="md:col-span-2 text-[11px] text-slate-400">
                Se cerraron secciones no esenciales para evitar confusión. Puedes reabrirlas cuando quieras.
              </div>
            )}
            <div className="relative">
              <input
                value={countryQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setCountryQuery(value);
                  const next = findCountryByInput(value);
                  if (next) syncCountry(next.id);
                }}
                onFocus={() => {
                  const selected = getCountryByCode(form.country);
                  if (selected && countryQuery === formatCountryOption(selected)) {
                    setCountryQuery("");
                  }
                }}
                onBlur={() => {
                  if (!countryQuery.trim()) {
                    const selected = getCountryByCode(form.country);
                    if (selected) setCountryQuery(formatCountryOption(selected));
                  }
                }}
                list="country-options"
                placeholder="Buscar país"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm w-full"
              />
              <datalist id="country-options">
                {COUNTRIES.map((c) => (
                  <option key={c.id} value={formatCountryOption(c)} />
                ))}
              </datalist>
            </div>
            {country?.currencies?.length > 1 ? (
              <select
                value={form.currency}
                onChange={(e) => setForm((prev) => ({
                  ...prev,
                  currency: e.target.value,
                  activeCurrency: e.target.value
                }))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
              >
                {country.currencies.map((curr) => (
                  <option key={curr} value={curr}>{curr}</option>
                ))}
              </select>
            ) : (
              <input
                value={form.currency}
                onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                placeholder="Moneda"
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
              />
            )}
            {country?.currencies?.length > 1 && (
              <select
                value={form.secondaryCurrency}
                onChange={(e) => setForm((prev) => ({ ...prev, secondaryCurrency: e.target.value }))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
              >
              <option value="">Moneda secundaria (opcional)</option>
                {country.currencies
                  .filter((curr) => curr !== form.currency)
                  .map((curr) => (
                    <option key={curr} value={curr}>{curr}</option>
                  ))}
              </select>
            )}
            {country?.currencies?.length > 1 && (
              <select
                value={form.activeCurrency || form.currency}
                onChange={(e) => setForm((prev) => ({ ...prev, activeCurrency: e.target.value }))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
              >
                <option value={form.currency}>Moneda activa: {form.currency}</option>
                {country.currencies
                  .filter((curr) => curr !== form.currency)
                  .map((curr) => (
                    <option key={curr} value={curr}>Moneda activa: {curr}</option>
                  ))}
              </select>
            )}
            <input
              value={form.dateLocale}
              onChange={(e) => setForm((prev) => ({ ...prev, dateLocale: e.target.value }))}
              placeholder="Locale (ej. es-DO)"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
            />
              </div>
            )}
          </div>
          <div className="border border-slate-700 rounded-xl">
            <button
              type="button"
              onClick={() => setSectionsOpen((prev) => ({ ...prev, imports: !prev.imports }))}
              className="w-full flex items-center justify-between px-4 py-1.5 text-left"
            >
              <span className="text-sm font-semibold text-slate-200">Importación de datos</span>
              <span className="text-[11px] text-slate-400">
                {sectionsOpen.imports ? "Ocultar" : "Mostrar"}
              </span>
            </button>
            {sectionsOpen.imports && (
              <div className="space-y-2 px-4 pb-2">
                {isDbEmpty && !dataBootstrapChoice && (
                  <div className="bg-amber-500/10 border border-amber-400/30 text-amber-200 text-[11px] rounded-lg px-3 py-1">
                    Base de datos vacía. Puedes cargar una plantilla contable estándar o empezar de cero.
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => handleBootstrapChoice("template")}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs"
                      >
                        Cargar plantilla estándar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBootstrapChoice("empty")}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
                      >
                        Empezar de cero
                      </button>
                    </div>
                  </div>
                )}
                {dataBootstrapChoice && (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1 text-[11px] text-slate-300">
                    Opción seleccionada: {dataBootstrapChoice === "template" ? "Plantilla estándar cargada" : "Empezar de cero"}.
                  </div>
                )}
                <div className="grid gap-2 md:grid-cols-3 items-center">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Tipo de datos</label>
                    <select
                      value={importType}
                      onChange={(e) => setImportType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
                    >
                      <option value="customers">Clientes</option>
                      <option value="inventory">Inventario / Productos</option>
                      <option value="categories">Categorías</option>
                      <option value="accounts">Cuentas contables</option>
                      <option value="expenses">Gastos</option>
                    </select>
                    <div className="mt-2">
                      <label className="block text-[11px] text-slate-400 mb-1">Cantidad de filas (editable)</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setImportRowsCount((prev) => Math.max(1, Number(prev || 1) - 1))}
                          className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={importRowsCount}
                          onChange={(e) => setImportRowsCount(e.target.value)}
                          className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setImportRowsCount((prev) => Number(prev || 0) + 1)}
                          className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Se usa para generar una plantilla con filas vacías.</p>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Archivo (.xlsx o .csv)</label>
                    <input
                      type="file"
                      accept=".xlsx,.csv"
                      disabled={importing}
                      onChange={handleImportFile}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm file:mr-3 file:px-3 file:py-1 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadImportTemplate}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs"
                      >
                        Descargar plantilla
                      </button>
                      <button
                        type="button"
                        onClick={handleSeedImportRows}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
                      >
                        Crear registros base
                      </button>
                    </div>
                  </div>
                </div>
                {importResult && (
                  <div className="text-[11px] text-emerald-300">{importResult}</div>
                )}
                <p className="text-[11px] text-slate-500">
                  Sugerencia: usa columnas estándar (nombre, teléfono, email para clientes; nombre, stock, precio, costo para inventario).
                </p>
              </div>
            )}
          </div>
          <div className="border border-slate-700 rounded-xl">
            <button
              type="button"
              onClick={() => setSectionsOpen((prev) => ({ ...prev, hr: !prev.hr }))}
              className="w-full flex items-center justify-between px-4 py-1.5 text-left"
            >
              <span className="text-sm font-semibold text-slate-200">RRHH y pagos</span>
              <span className="text-[11px] text-slate-400">
                {sectionsOpen.hr ? "Ocultar" : "Mostrar"}
              </span>
            </button>
            {sectionsOpen.hr && (
              <div className="grid gap-2.5 md:grid-cols-2 px-4 pb-2">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Cantidad de trabajadores</label>
                  <input
                    type="number"
                    value={form.employees}
                    onChange={(e) => setForm((prev) => ({ ...prev, employees: e.target.value }))}
                    placeholder="Ej. 1"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm w-full"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Se usa para generar códigos de invitación.</p>
                </div>
                <div className="md:col-span-2 text-[11px] text-slate-500">
                  Configura salarios, nóminas y reglas de pago variable dentro de RRHH para cada trabajador
                  (o en bloque si aplica a todo el equipo).
                </div>
              </div>
            )}
          </div>
          <div className="border border-slate-700 rounded-xl">
            <button
              type="button"
              onClick={() => setShowAdvancedSetup((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-1.5 text-left"
            >
              <span className="text-sm font-semibold text-slate-200">Opciones contables avanzadas</span>
              <span className="text-[11px] text-slate-400">
                {showAdvancedSetup ? "Ocultar" : "Configurar luego"}
              </span>
            </button>
            {showAdvancedSetup && (
            <div className="grid gap-2 md:grid-cols-2 px-4 pb-2 pt-2">
            <input
              value={form.defaultUom}
              onChange={(e) => setForm((prev) => ({ ...prev, defaultUom: e.target.value }))}
              placeholder="Unidad de medida por defecto (ej. ud)"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
            />
            <p className="text-[11px] text-slate-500 -mt-2">Se usa como unidad base al crear productos.</p>
            <select
              value={form.accountingStandard}
              onChange={(e) => setForm((prev) => ({ ...prev, accountingStandard: e.target.value }))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
            >
              <option value="ifrs">IFRS</option>
              <option value="local">Norma local</option>
            </select>
            <p className="text-[11px] text-slate-500 -mt-2">Define el marco contable principal.</p>
            <select
              value={form.invoiceSystem}
              onChange={(e) => setForm((prev) => ({ ...prev, invoiceSystem: e.target.value }))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
            >
              <option value="interno">Comprobante interno</option>
              <option value="fiscal">Comprobante fiscal</option>
            </select>
            <p className="text-[11px] text-slate-500 -mt-2">Tipo de comprobante que usará tu negocio.</p>
            <input
              value={form.invoiceSeries}
              onChange={(e) => setForm((prev) => ({ ...prev, invoiceSeries: e.target.value }))}
              placeholder="Serie de facturación"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
            />
            <p className="text-[11px] text-slate-500 -mt-2">Prefijo o serie para numeración de comprobantes.</p>
            <div className="md:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-2.5">
              <p className="text-[11px] text-slate-300">
                País seleccionado: <span className="text-white">{country?.label}</span> • Moneda:{" "}
                <span className="text-white">{form.currency}</span>
              </p>
            </div>
          </div>
            )}
          </div>
          <div className="border border-slate-700 rounded-xl">
            <button
              type="button"
              onClick={() => setSectionsOpen((prev) => ({ ...prev, invites: !prev.invites }))}
              className="w-full flex items-center justify-between px-4 py-1.5 text-left"
            >
              <span className="text-sm font-semibold text-slate-200">Invitaciones del equipo</span>
              <span className="text-[11px] text-slate-400">
                {sectionsOpen.invites ? "Ocultar" : "Mostrar"}
              </span>
            </button>
            {sectionsOpen.invites && (
              <div className="space-y-2 px-4 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-[200px] flex-1">
                <p className="text-[11px] text-slate-300">Rol por defecto (editable)</p>
                <input
                  value={defaultRole}
                  onChange={(e) => setDefaultRole(e.target.value)}
                  placeholder="Ej. Cajero"
                  autoComplete="off"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
                />
                <p className="text-[11px] text-slate-500 mt-1">Puedes escribir el rol como lo entiendas.</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {[...ROLES, ...customRoleOptions].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setDefaultRole(role)}
                      className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleGenerateInvites}
                  className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm"
                >
                  Generar códigos ({invites.length || form.employees})
                </button>
                <button
                  onClick={handleSyncInviteCount}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                >
                  Ajustar a cantidad
                </button>
                <button
                  onClick={handleAddInvite}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
                >
                  Sumar rol + invitación
                </button>
                <div className="relative flex items-center">
                  <p className="absolute -top-6 right-0 text-[11px] text-slate-400 whitespace-nowrap pointer-events-none">
                    Opciones en el menú
                  </p>
                  <button
                    type="button"
                    onClick={() => setInvitesMenuOpen((prev) => !prev)}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
                  >
                    Opciones
                  </button>
                  {invitesMenuOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-10">
                      <button
                        onClick={() => {
                          setInvitesMenuOpen(false);
                          handleDownloadInvites();
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded-t-lg"
                      >
                        Descargar CSV
                      </button>
                      <button
                        onClick={() => {
                          setInvitesMenuOpen(false);
                          handleSendInvites();
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded-b-lg"
                      >
                        Enviar invitaciones
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-2.5">
              {invites.length === 0 ? (
                <p className="text-[11px] text-slate-400">Genera códigos para tu equipo.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <p className="text-[11px] text-slate-400">Invitaciones creadas: {invites.length}</p>
                  {invites.map((invite) => (
                    <div key={invite.code} className="grid gap-2 md:grid-cols-5 items-center">
                      <div className="text-slate-200 font-mono">{invite.code}</div>
                      <input
                        value={invite.name || ""}
                        onChange={(e) => handleUpdateInvite(invite.code, { name: e.target.value })}
                        placeholder="Nombre"
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-xs"
                      />
                      <input
                        value={invite.email || ""}
                        onChange={(e) => handleUpdateInvite(invite.code, { email: e.target.value })}
                        placeholder="Email"
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-xs"
                      />
                      <div className="flex flex-col gap-1">
                        <select
                          value={
                            ROLES.includes(invite.role || "") || customRoleOptions.includes(invite.role || "")
                              ? invite.role
                              : "custom"
                          }
                          onChange={(e) => {
                            const value = e.target.value;
                            handleUpdateInvite(invite.code, { role: value === "custom" ? "" : value });
                          }}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-xs"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                          {customRoleOptions.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                          <option value="custom">Otro rol...</option>
                        </select>
                        {!ROLES.includes(invite.role || "") && !customRoleOptions.includes(invite.role || "") && (
                          <input
                            value={invite.role || ""}
                            onChange={(e) => handleUpdateInvite(invite.code, { role: e.target.value })}
                            placeholder="Rol personalizado"
                            autoComplete="off"
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-xs"
                          />
                        )}
                      </div>
                      <div className="text-[11px] flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleRemoveInvite(invite.code)}
                          className="text-red-300 hover:text-red-200"
                          title="Eliminar invitación"
                        >
                          Eliminar
                        </button>
                        <div className="flex items-center gap-1.5">
                          {invite.status === "sent" && (
                            <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-200">Enviado</span>
                          )}
                          {invite.status === "failed" && (
                            <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-200">Falló</span>
                          )}
                          {!invite.status || invite.status === "pending" ? (
                            <span className="px-2 py-1 rounded-full bg-slate-500/20 text-slate-200">Pendiente</span>
                          ) : null}
                          {invite.status === "failed" && invite.error ? (
                            <span className="text-[10px] text-red-300/80 max-w-[160px] truncate" title={invite.error}>
                              {invite.error}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
              </div>
            )}
          </div>
        </div>

        {stepError && (
          <p className="text-xs text-amber-300">{stepError}</p>
        )}
        {stepWarning && (
          <div className="bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs rounded-lg px-3 py-2">
            {stepWarning}
          </div>
        )}
        <div className="sticky bottom-0 -mx-4 px-4 py-1 bg-slate-900/95 backdrop-blur border-t border-slate-800/60 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setStepError("");
              const warning = getStepWarnings();
              if (warning && warning !== stepWarning) {
                setStepWarning(warning);
                return;
              }
              setStepWarning(warning);
              onBack?.();
            }}
            className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm"
          >
            Atrás
          </button>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={handleSaveDraft}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
            >
              Guardar
            </button>
            <button
              onClick={() => {
                const warning = getStepWarnings();
                if (warning && warning !== stepWarning) {
                  setStepWarning(warning);
                  return;
                }
                setStepError("");
                setStepWarning(warning);
                handleFinish();
              }}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
            >
              Finalizar configuración
            </button>
            <button
              onClick={async () => {
                const warning = getStepWarnings();
                if (warning && warning !== stepWarning) {
                  setStepWarning(warning);
                  return;
                }
                setStepError("");
                setStepWarning(warning);
                const ok = await handleFinish();
                if (ok) {
                  navigate("/employees?tab=payroll&wizard=1");
                }
              }}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"
            >
              Finalizar e ir a RRHH
            </button>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
